import ActivityKit
import AppIntents
import Foundation

private final class NoRedirectSessionDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

/// Sends an approval directly from the Lock Screen or Dynamic Island without
/// opening the app. The short-lived credential arrives in the start push's
/// immutable Activity attributes, so the intent does not depend on login state.
@available(iOS 17.0, *)
struct HarkLiveActivityResponseIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Respond to Hark"
    static var description = IntentDescription("Respond to an agent request from a Live Activity.")
    static var openAppWhenRun = false

    @Parameter(title: "Activity ID") var activityID: String
    @Parameter(title: "Action") var action: String
    @Parameter(title: "Interaction ID") var interactionID: String
    @Parameter(title: "Credential") var credential: String
    @Parameter(title: "Device ID") var deviceID: String
    @Parameter(title: "Delivery ID") var deliveryID: String
    @Parameter(title: "Registration URL") var registrationURL: String

    init() {
        activityID = ""
        action = ""
        interactionID = ""
        credential = ""
        deviceID = ""
        deliveryID = ""
        registrationURL = ""
    }

    init(
        activityID: String,
        action: String,
        interactionID: String,
        credential: String,
        deviceID: String,
        deliveryID: String,
        registrationURL: String
    ) {
        self.activityID = activityID
        self.action = action
        self.interactionID = interactionID
        self.credential = credential
        self.deviceID = deviceID
        self.deliveryID = deliveryID
        self.registrationURL = registrationURL
    }

    func perform() async throws -> some IntentResult {
        guard ["approve", "deny", "yes", "no"].contains(action),
              let registration = URL(string: registrationURL),
              var components = URLComponents(url: registration, resolvingAgainstBaseURL: false)
        else { throw HarkIntentError.invalidPayload }

        components.path = "/api/live-activity-interactions/\(interactionID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? interactionID)/respond"
        components.query = nil
        components.fragment = nil
        guard let url = components.url else { throw HarkIntentError.invalidPayload }

        let body = try JSONEncoder().encode(LiveActivityCredentialBody(
            action: action,
            credential: credential,
            deviceId: deviceID,
            deliveryId: deliveryID
        ))
        var request = URLRequest(url: url, timeoutInterval: 8)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let session = URLSession(
            configuration: .ephemeral,
            delegate: NoRedirectSessionDelegate(),
            delegateQueue: nil
        )
        defer { session.invalidateAndCancel() }

        var responseStatus: String?
        for attempt in 0..<2 {
            do {
                let (data, response) = try await session.data(for: request)
                responseStatus = try? JSONDecoder().decode(LiveActivityCredentialResult.self, from: data).status
                if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                    break
                }
                if responseStatus != nil { break }
            } catch {
                if attempt == 1 { throw error }
            }
        }
        guard let responseStatus else { throw HarkIntentError.serverRejected }

        for activity in Activity<LiveActivityAttributes>.activities where activity.id == activityID {
            var props = activity.content.state.decodedProps
            let outcome: String
            switch responseStatus {
            case "approved": outcome = "Approved"
            case "denied": outcome = "Denied"
            case "yes": outcome = "Yes"
            case "no": outcome = "No"
            default: outcome = responseStatus.capitalized
            }
            let updatedInteraction = props.interaction.map {
                LiveActivityInteractionDTO(
                    id: $0.id,
                    kind: $0.kind,
                    prompt: $0.prompt,
                    primaryLabel: $0.primaryLabel,
                    secondaryLabel: $0.secondaryLabel,
                    primaryAction: $0.primaryAction,
                    secondaryAction: $0.secondaryAction,
                    state: responseStatus
                )
            }
            props = LiveActivityProps(
                schemaVersion: props.schemaVersion,
                activityId: props.activityId,
                title: props.title,
                status: outcome,
                detail: "Sent to the agent.",
                progress: props.progress,
                updatedAt: ISO8601DateFormatter().string(from: Date()),
                symbol: props.symbol,
                privacyMode: props.privacyMode,
                accentColor: props.accentColor,
                style: props.style,
                interaction: updatedInteraction
            )
            guard let encoded = try? JSONEncoder().encode(props),
                  let propsString = String(data: encoded, encoding: .utf8)
            else { continue }
            let content = ActivityContent(
                state: LiveActivityAttributes.ContentState(name: activity.content.state.name, props: propsString),
                staleDate: nil
            )
            await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(30)))
        }

        return .result()
    }
}

private struct LiveActivityCredentialBody: Encodable {
    let action: String
    let credential: String
    let deviceId: String
    let deliveryId: String
}

private struct LiveActivityCredentialResult: Decodable { let status: String }

private enum HarkIntentError: Error {
    case invalidPayload
    case serverRejected
}
