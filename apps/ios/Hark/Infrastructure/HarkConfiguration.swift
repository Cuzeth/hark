import Foundation

enum HarkConfiguration {
    static var apiBaseURL: URL {
        if let override = UserDefaults.standard.string(forKey: "hark.apiURL"),
           let url = URL(string: override) {
            return url
        }
        if let configured = Bundle.main.object(forInfoDictionaryKey: "HARK_API_URL") as? String,
           !configured.isEmpty,
           !configured.contains("$("),
           let url = URL(string: configured) {
            return url
        }
        return URL(string: "https://hark.abdeen.dev")!
    }

    static var apnsEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}

extension Notification.Name {
    static let harkAPNSToken = Notification.Name("hark.apnsToken")
    static let harkAPNSError = Notification.Name("hark.apnsError")
    static let harkNotificationResponse = Notification.Name("hark.notificationResponse")
    static let harkNotificationReceived = Notification.Name("hark.notificationReceived")
}
