import ActivityKit
import Foundation

@MainActor
final class LiveActivityCoordinator {
    static let shared = LiveActivityCoordinator(api: APIClient())

    private let api: APIClient
    private let keychain: KeychainStore
    private var rootTasks: [Task<Void, Never>] = []
    private var tokenTasks: [String: Task<Void, Never>] = [:]
    private var uploaded: [String: String] = [:]
    private var started = false

    init(api: APIClient, keychain: KeychainStore = KeychainStore()) {
        self.api = api
        self.keychain = keychain
    }

    func start() {
        guard !started else { return }
        started = true
        for activity in Activity<LiveActivityAttributes>.activities { observe(activity) }
        if let token = Activity<LiveActivityAttributes>.pushToStartToken {
            Task { await uploadPushToStart(token) }
        }

        rootTasks.append(Task { [weak self] in
            for await activity in Activity<LiveActivityAttributes>.activityUpdates {
                guard !Task.isCancelled else { return }
                self?.observe(activity)
            }
        })
        rootTasks.append(Task { [weak self] in
            for await token in Activity<LiveActivityAttributes>.pushToStartTokenUpdates {
                guard !Task.isCancelled else { return }
                await self?.uploadPushToStart(token)
            }
        })
    }

    func resync() {
        if let token = Activity<LiveActivityAttributes>.pushToStartToken {
            Task { await uploadPushToStart(token) }
        }
        for activity in Activity<LiveActivityAttributes>.activities {
            observe(activity)
            if let token = activity.pushToken { Task { await uploadUpdateToken(token, for: activity) } }
        }
    }

    private func observe(_ activity: Activity<LiveActivityAttributes>) {
        guard tokenTasks[activity.id] == nil else { return }
        tokenTasks[activity.id] = Task { [weak self] in
            if let token = activity.pushToken { await self?.uploadUpdateToken(token, for: activity) }
            for await token in activity.pushTokenUpdates {
                guard !Task.isCancelled else { return }
                await self?.uploadUpdateToken(token, for: activity)
            }
        }
    }

    private func uploadPushToStart(_ token: Data) async {
        guard let deviceID = keychain.string(for: .deviceID) else { return }
        try? await api.registerPushToStartToken(token.lowercaseHex, deviceID: deviceID)
    }

    private func uploadUpdateToken(_ token: Data, for activity: Activity<LiveActivityAttributes>) async {
        let hex = token.lowercaseHex
        guard uploaded[activity.id] != hex else { return }

        var succeeded = false
        if let urlString = activity.attributes.tokenRegistrationURL,
           let url = URL(string: urlString),
           let registrationToken = activity.attributes.tokenRegistrationToken,
           let deliveryID = activity.attributes.deliveryId {
            let payload = BackgroundActivityTokenBody(
                deliveryId: deliveryID,
                registrationToken: registrationToken,
                nativeActivityId: activity.id,
                updateToken: hex
            )
            if let body = try? JSONEncoder().encode(payload) {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.httpBody = body
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                for attempt in 0..<5 {
                    do {
                        let (_, response) = try await URLSession.shared.data(for: request)
                        if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                            succeeded = true
                            break
                        }
                    } catch { }
                    try? await Task.sleep(nanoseconds: UInt64(1 << attempt) * 500_000_000)
                }
            }
        }

        if let deviceID = keychain.string(for: .deviceID) {
            do {
                try await api.registerActivityUpdateToken(hex, activityID: activity.id, deviceID: deviceID)
                succeeded = true
            } catch { }
        }
        if succeeded { uploaded[activity.id] = hex }
    }
}

private struct BackgroundActivityTokenBody: Encodable {
    let deliveryId: String
    let registrationToken: String
    let nativeActivityId: String
    let updateToken: String
}
