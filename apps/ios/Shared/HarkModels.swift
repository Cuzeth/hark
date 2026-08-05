import Foundation

enum HarkConstants {
    static let interactionSchemaVersion = 1
    static let liveActivitySchemaVersion = 1

    static let approvalCategory = "HARK_APPROVAL_V1"
    static let replyCategory = "HARK_REPLY_V1"
    static let yesNoCategory = "HARK_YES_NO_V1"
    static let approveAction = "HARK_APPROVE"
    static let denyAction = "HARK_DENY"
    static let replyAction = "HARK_REPLY"
    static let yesAction = "HARK_YES"
    static let noAction = "HARK_NO"

    static let appGroup = "group.dev.abdeen.hark"
}

struct EmptyResponse: Decodable {}
struct OkayResponse: Decodable { let ok: Bool }

struct SessionEnvelope: Decodable {
    let user: SessionUser
}

struct SessionUser: Codable, Equatable {
    let id: String
    let name: String
    let email: String
    let image: String?
}

struct SignInEnvelope: Decodable {
    let user: SessionUser?
}

struct DeviceEnvelope: Decodable { let devices: [DeviceDTO] }
struct DeviceRegistrationEnvelope: Decodable { let device: RegisteredDevice }
struct RegisteredDevice: Decodable { let id: String }

struct DeviceDTO: Codable, Identifiable {
    let id: String
    let platform: String
    let deviceName: String?
    let active: Bool
    let liveActivitiesCapable: Bool
    let liveActivityTokenEnvironment: String?
    let liveActivityTokenUpdatedAt: String?
    let interactiveLiveActivitiesCapable: Bool
    let createdAt: String
    let lastSeenAt: String
}

struct DeviceRegisterInput: Encodable {
    let apnsToken: String
    let platform = "ios"
    let deviceName: String?
    let interactionSchemaVersion = HarkConstants.interactionSchemaVersion
    let liveActivityInteractionVersion: Int?
}

struct DeviceUnregisterInput: Encodable { let apnsToken: String }

struct EventsEnvelope: Decodable { let events: [EventDTO] }

struct EventDTO: Codable, Identifiable {
    let id: String
    let serviceId: String
    let serviceTitle: String
    let title: String
    let body: String
    let imageUrl: String?
    let url: String?
    let priority: String
    let status: String
    let deliveredCount: Int
    let error: String?
    let createdAt: String
}

struct InteractionsEnvelope: Decodable { let interactions: [InboxInteractionDTO] }
struct ActivitiesEnvelope: Decodable { let activities: [InboxLiveActivityDTO] }

struct InteractionDTO: Codable, Identifiable {
    let id: String
    let title: String
    let prompt: String
    let kind: String
    let presentation: String
    let status: String
    let choices: [String]
    let response: String?
    let imageUrl: String?
    let url: String?
    let actionDigest: String
    let primaryLabel: String?
    let secondaryLabel: String?
    let accepted: Int
    let respondingDeviceId: String?
    let expiresAt: String
    let createdAt: String
    let respondedAt: String?
    let canceledAt: String?
}

struct InboxInteractionDTO: Codable, Identifiable {
    let id: String
    let title: String
    let prompt: String
    let kind: String
    let presentation: String
    let status: String
    let choices: [String]
    let response: String?
    let imageUrl: String?
    let url: String?
    let actionDigest: String
    let primaryLabel: String?
    let secondaryLabel: String?
    let accepted: Int
    let respondingDeviceId: String?
    let expiresAt: String
    let createdAt: String
    let respondedAt: String?
    let canceledAt: String?
    let sourceName: String
    let sourceImageUrl: String?
}

struct LiveActivityInteractionDTO: Codable, Hashable {
    let id: String
    let kind: String
    let prompt: String
    let primaryLabel: String
    let secondaryLabel: String
    let primaryAction: String
    let secondaryAction: String
    let state: String
}

struct LiveActivityProps: Codable, Hashable {
    let schemaVersion: Int
    let activityId: String
    let title: String
    let status: String
    let detail: String?
    let progress: Double?
    let updatedAt: String
    let symbol: String
    let privacyMode: String
    let accentColor: String?
    let style: String?
    let interaction: LiveActivityInteractionDTO?

    static let placeholder = LiveActivityProps(
        schemaVersion: 1,
        activityId: "preview",
        title: "Hark",
        status: "Working",
        detail: "Waiting for an update",
        progress: nil,
        updatedAt: ISO8601DateFormatter().string(from: Date()),
        symbol: "terminal",
        privacyMode: "standard",
        accentColor: "#E13B3B",
        style: "standard",
        interaction: nil
    )
}

struct InboxLiveActivityDTO: Codable, Identifiable {
    let id: String
    let key: String?
    let props: LiveActivityProps
    let status: String
    let sequence: Int
    let accepted: Int
    let failed: Int
    let expiresAt: String
    let createdAt: String
    let updatedAt: String
    let endedAt: String?
    let sourceName: String
    let sourceImageUrl: String?
}

struct ActivityFeedPageDTO: Decodable {
    let items: [InboxActivityDTO]
    let page: Int
    let pageSize: Int
    let total: Int
}

struct InboxActivityDTO: Codable, Identifiable {
    let id: String
    let kind: String
    let sourceName: String
    let sourceImageUrl: String?
    let title: String
    let detail: String?
    let url: String?
    let result: String?
    let createdAt: String
    let status: String?
    let deliveredCount: Int?
    let error: String?
    let priority: String?
}

struct InteractionResponseInput: Codable, Equatable {
    let action: String
    let response: String?
    let actionDigest: String
}

struct QueuedInteractionResponse: Codable, Identifiable, Equatable {
    var id: String { interactionId }
    let interactionId: String
    let input: InteractionResponseInput
    let responseToken: String?
}

struct AuthenticatedInteractionResponse: Encodable {
    let action: String
    let response: String?
    let actionDigest: String
    let deviceId: String
}

struct CredentialInteractionResponse: Encodable {
    let action: String
    let response: String?
    let responseToken: String
    let deviceId: String
}

struct PushToStartTokenInput: Encodable {
    let deviceId: String
    let pushToStartToken: String
    let environment: String
    let schemaVersion = HarkConstants.liveActivitySchemaVersion
}

struct ActivityUpdateTokenInput: Encodable {
    let deviceId: String
    let updateToken: String
    let nativeActivityId: String?
    let environment: String
    let schemaVersion = HarkConstants.liveActivitySchemaVersion
}

extension JSONDecoder {
    static let hark = JSONDecoder()
}

extension Date {
    static func harkParse(_ value: String) -> Date? {
        if let date = ISO8601DateFormatter.harkFractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }
}

extension ISO8601DateFormatter {
    static let harkFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
