import Intents
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?
    private let completionLock = NSLock()
    private var didComplete = false

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        let content = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
        bestAttemptContent = content
        DispatchQueue.global().asyncAfter(deadline: .now() + 25) { [weak self] in
            self?.completeOnce(with: self?.bestAttemptContent ?? content)
        }

        guard let data = Self.extractHarkData(from: request.content.userInfo),
              let sourceName = data["sourceName"] as? String,
              !sourceName.isEmpty else {
            completeOnce(with: content)
            return
        }
        let conversationID = (data["conversationId"] as? String) ?? (data["serviceId"] as? String) ?? "hark"
        let avatarURL = (data["avatarUrl"] as? String).flatMap(URL.init(string:))
        downloadAvatar(avatarURL) { [weak self] avatar in
            self?.applyCommunicationStyle(to: content, sourceName: sourceName, conversationID: conversationID, avatar: avatar)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        completeOnce(with: bestAttemptContent ?? UNMutableNotificationContent())
    }

    static func extractHarkData(from userInfo: [AnyHashable: Any]) -> [String: Any]? {
        if let body = userInfo["body"] as? [String: Any], body["sourceName"] != nil { return body }
        if let bodyString = userInfo["body"] as? String,
           let bodyData = bodyString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any],
           parsed["sourceName"] != nil { return parsed }
        guard userInfo["sourceName"] != nil else { return nil }
        return userInfo.reduce(into: [String: Any]()) { result, pair in
            if let key = pair.key as? String { result[key] = pair.value }
        }
    }

    private func downloadAvatar(_ url: URL?, completion: @escaping (INImage?) -> Void) {
        guard let url else { completion(nil); return }
        URLSession.shared.dataTask(with: url) { data, response, _ in
            guard let data,
                  let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else { completion(nil); return }
            completion(INImage(imageData: data))
        }.resume()
    }

    private func applyCommunicationStyle(
        to content: UNMutableNotificationContent,
        sourceName: String,
        conversationID: String,
        avatar: INImage?
    ) {
        let handle = INPersonHandle(value: "hark:\(conversationID)", type: .unknown)
        let sender = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: sourceName,
            image: avatar,
            contactIdentifier: nil,
            customIdentifier: "hark:\(conversationID)"
        )
        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: nil,
            conversationIdentifier: conversationID,
            serviceName: "Hark",
            sender: sender,
            attachments: nil
        )
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate { [weak self] error in
            guard let self, error == nil else { self?.completeOnce(with: content); return }
            do {
                let updated = try content.updating(from: intent)
                let actionable = (updated.mutableCopy() as? UNMutableNotificationContent) ?? content
                actionable.categoryIdentifier = content.categoryIdentifier
                actionable.interruptionLevel = content.interruptionLevel
                actionable.sound = content.sound
                self.completeOnce(with: actionable)
            } catch { self.completeOnce(with: content) }
        }
    }

    private func completeOnce(with content: UNNotificationContent) {
        completionLock.lock()
        guard !didComplete, let handler = contentHandler else { completionLock.unlock(); return }
        didComplete = true
        completionLock.unlock()
        handler(content)
    }
}
