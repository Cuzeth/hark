import ActivityKit
import Foundation

/// This type name and content-state shape intentionally match the APNs payload
/// emitted by the Hark server (`attributes-type: LiveActivityAttributes`).
struct LiveActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String
        var props: String

        var decodedProps: LiveActivityProps {
            guard let data = props.data(using: .utf8),
                  let value = try? JSONDecoder.hark.decode(LiveActivityProps.self, from: data)
            else { return .placeholder }
            return value
        }
    }

    var tokenRegistrationURL: String?
    var tokenRegistrationToken: String?
    var deliveryId: String?
    var harkInteractionId: String?
    var harkInteractionCredential: String?
    var harkInteractionDeviceId: String?
}

extension Data {
    var lowercaseHex: String { map { String(format: "%02x", $0) }.joined() }
}
