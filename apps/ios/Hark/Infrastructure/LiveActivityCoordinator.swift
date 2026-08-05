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
    private var firstSeen: [String: Date] = [:]
    private var started = false

    /// A server list can race a start push that already put the activity on screen,
    /// so an activity is only reconciled once it has been around this long.
    private let reconcileGrace: TimeInterval = 60

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
            // observe() uploads the current token itself, so only already-observed
            // activities need the explicit re-upload.
            let alreadyObserved = tokenTasks[activity.id] != nil
            observe(activity)
            if alreadyObserved, let token = activity.pushToken {
                Task { await uploadUpdateToken(token, for: activity) }
            }
        }
    }

    /// Ends Live Activities the server no longer lists as active. An APNs end push can
    /// be lost — the server sends it before the device has registered a per-activity
    /// update token — which otherwise strands the card on the Lock Screen until it
    /// goes stale hours later.
    func reconcile(activeServerIDs: Set<String>, pendingInteractionIDs: Set<String>) {
        let live = Activity<LiveActivityAttributes>.activities
        let localIDs = Set(live.map(\.id))
        for id in tokenTasks.keys.filter({ !localIDs.contains($0) }) {
            tokenTasks.removeValue(forKey: id)?.cancel()
        }
        uploaded = uploaded.filter { localIDs.contains($0.key) }
        firstSeen = firstSeen.filter { localIDs.contains($0.key) }

        let now = Date()
        for activity in live {
            guard activity.activityState == .active || activity.activityState == .stale else { continue }
            let props = activity.content.state.decodedProps
            // A failed decode yields the placeholder, whose id matches nothing server-side.
            guard props.activityId != LiveActivityProps.placeholder.activityId else { continue }
            guard let seen = firstSeen[activity.id] else {
                firstSeen[activity.id] = now
                continue
            }
            guard now.timeIntervalSince(seen) >= reconcileGrace else { continue }
            if activeServerIDs.contains(props.activityId) { continue }
            // Interaction-backed activities are filtered out of the active list by the
            // server, so they reconcile against the pending interactions instead.
            if let interactionID = activity.attributes.harkInteractionId ?? props.interaction?.id,
               pendingInteractionIDs.contains(interactionID) { continue }
            endLocally(activity)
        }
    }

    private func endLocally(_ activity: Activity<LiveActivityAttributes>) {
        tokenTasks.removeValue(forKey: activity.id)?.cancel()
        uploaded[activity.id] = nil
        firstSeen[activity.id] = nil
        let content = ActivityContent(state: activity.content.state, staleDate: nil)
        Task { await activity.end(content, dismissalPolicy: .immediate) }
    }

    private func observe(_ activity: Activity<LiveActivityAttributes>) {
        if firstSeen[activity.id] == nil { firstSeen[activity.id] = Date() }
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

        // Two independent channels: the retrying delivery callback must not hold
        // up the cookie-authenticated device API call, so both run concurrently.
        async let delivery = registerThroughDelivery(hex: hex, activity: activity)
        async let deviceAPI = registerThroughDeviceAPI(hex: hex, activity: activity)
        let deliveryDone = await delivery
        let deviceAPIDone = await deviceAPI
        if deliveryDone || deviceAPIDone { uploaded[activity.id] = hex }
    }

    private func registerThroughDelivery(hex: String, activity: Activity<LiveActivityAttributes>) async -> Bool {
        guard let urlString = activity.attributes.tokenRegistrationURL,
              let url = URL(string: urlString),
              let registrationToken = activity.attributes.tokenRegistrationToken,
              let deliveryID = activity.attributes.deliveryId else { return false }
        let payload = BackgroundActivityTokenBody(
            deliveryId: deliveryID,
            registrationToken: registrationToken,
            nativeActivityId: activity.id,
            updateToken: hex
        )
        guard let body = try? JSONEncoder().encode(payload) else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for attempt in 0..<5 {
            if attempt > 0 {
                try? await Task.sleep(nanoseconds: UInt64(1 << (attempt - 1)) * 500_000_000)
            }
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                    return true
                }
            } catch { }
        }
        return false
    }

    private func registerThroughDeviceAPI(hex: String, activity: Activity<LiveActivityAttributes>) async -> Bool {
        guard let deviceID = keychain.string(for: .deviceID) else { return false }
        do {
            try await api.registerActivityUpdateToken(hex, activityID: activity.id, deviceID: deviceID)
            return true
        } catch { return false }
    }
}

private struct BackgroundActivityTokenBody: Encodable {
    let deliveryId: String
    let registrationToken: String
    let nativeActivityId: String
    let updateToken: String
}
