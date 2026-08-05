import Foundation
import UIKit
import UserNotifications

@MainActor
final class InteractionQueue {
    private let api: APIClient
    private let keychain: KeychainStore
    private var flushing = false
    private var flushRequested = false
    private let maxQueued = 20

    init(api: APIClient, keychain: KeychainStore = KeychainStore()) {
        self.api = api
        self.keychain = keychain
    }

    func submit(
        interactionID: String,
        action: String,
        response: String? = nil,
        actionDigest: String,
        responseToken: String? = nil
    ) async {
        var queue = readQueue()
        guard !queue.contains(where: { $0.interactionId == interactionID }) else {
            await flush()
            return
        }
        queue.append(QueuedInteractionResponse(
            interactionId: interactionID,
            input: InteractionResponseInput(action: action, response: response?.trimmingCharacters(in: .whitespacesAndNewlines), actionDigest: actionDigest),
            responseToken: responseToken
        ))
        writeQueue(Array(queue.suffix(maxQueued)))
        flushRequested = true
        await flush()
    }

    func handle(_ response: UNNotificationResponse) async {
        let data = Self.pushData(response.notification.request.content.userInfo)
        if response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            if let value = data["url"] as? String,
               let url = URL(string: value),
               ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                await UIApplication.shared.open(url)
            }
            return
        }

        guard let interactionID = data["interactionId"] as? String,
              let digest = data["actionDigest"] as? String
        else { return }

        let action: String?
        var reply: String?
        switch response.actionIdentifier {
        case HarkConstants.approveAction: action = "approve"
        case HarkConstants.denyAction: action = "deny"
        case HarkConstants.yesAction: action = "yes"
        case HarkConstants.noAction: action = "no"
        case HarkConstants.replyAction:
            action = "reply"
            reply = (response as? UNTextInputNotificationResponse)?.userText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard reply?.isEmpty == false else { return }
        default: action = nil
        }
        guard let action else { return }
        await submit(
            interactionID: interactionID,
            action: action,
            response: reply,
            actionDigest: digest,
            responseToken: data["responseToken"] as? String
        )
    }

    func flush() async {
        if flushing {
            flushRequested = true
            return
        }
        flushing = true
        defer { flushing = false }

        repeat {
            flushRequested = false
            guard let deviceID = keychain.string(for: .deviceID) else { return }
            let queue = readQueue()
            if queue.isEmpty { continue }
            var completed = Set<String>()
            for item in queue {
                do {
                    if item.responseToken != nil {
                        try await api.respondWithCredential(item, deviceID: deviceID)
                    } else {
                        guard api.hasSessionCookie else { continue }
                        try await api.respondAuthenticated(item, deviceID: deviceID)
                    }
                    completed.insert(item.interactionId)
                } catch let error as APIError where error.isTerminalInteractionError {
                    completed.insert(item.interactionId)
                } catch {
                    // Offline, unauthorized, and server failures remain durable.
                }
            }
            if !completed.isEmpty {
                writeQueue(readQueue().filter { !completed.contains($0.interactionId) })
                flushRequested = true
            }
        } while flushRequested
    }

    func clear() { keychain.remove(.interactionQueue) }

    private func readQueue() -> [QueuedInteractionResponse] {
        guard let data = keychain.data(for: .interactionQueue),
              let values = try? JSONDecoder.hark.decode([QueuedInteractionResponse].self, from: data)
        else { return [] }
        return values
    }

    private func writeQueue(_ values: [QueuedInteractionResponse]) {
        guard !values.isEmpty else {
            keychain.remove(.interactionQueue)
            return
        }
        guard let data = try? JSONEncoder().encode(values) else { return }
        try? keychain.set(data, for: .interactionQueue)
    }

    static func pushData(_ userInfo: [AnyHashable: Any]) -> [String: Any] {
        if let body = userInfo["body"] as? [String: Any] { return body }
        if let string = userInfo["body"] as? String,
           let data = string.data(using: .utf8),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { return object }
        return userInfo.reduce(into: [String: Any]()) { result, value in
            if let key = value.key as? String { result[key] = value.value }
        }
    }
}
