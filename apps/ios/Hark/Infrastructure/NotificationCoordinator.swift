import UIKit
import UserNotifications

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        Self.registerCategories(center)
        LiveActivityCoordinator.shared.start()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .harkAPNSToken, object: deviceToken.lowercaseHex)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .harkAPNSError, object: error)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        NotificationCenter.default.post(name: .harkNotificationReceived, object: notification)
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        NotificationCenter.default.post(name: .harkNotificationResponse, object: response)
        completionHandler()
    }

    static func registerCategories(_ center: UNUserNotificationCenter = .current()) {
        let foreground: UNNotificationActionOptions = [.authenticationRequired, .foreground]
        let approval = UNNotificationCategory(
            identifier: HarkConstants.approvalCategory,
            actions: [
                UNNotificationAction(identifier: HarkConstants.approveAction, title: "Approve", options: foreground),
                UNNotificationAction(identifier: HarkConstants.denyAction, title: "Deny", options: [foreground, .destructive]),
            ],
            intentIdentifiers: [],
            options: []
        )
        let reply = UNNotificationCategory(
            identifier: HarkConstants.replyCategory,
            actions: [
                UNTextInputNotificationAction(
                    identifier: HarkConstants.replyAction,
                    title: "Reply",
                    options: foreground,
                    textInputButtonTitle: "Send",
                    textInputPlaceholder: "Reply"
                ),
            ],
            intentIdentifiers: [],
            options: []
        )
        let yesNo = UNNotificationCategory(
            identifier: HarkConstants.yesNoCategory,
            actions: [
                UNNotificationAction(identifier: HarkConstants.yesAction, title: "Yes", options: foreground),
                UNNotificationAction(identifier: HarkConstants.noAction, title: "No", options: [foreground, .destructive]),
            ],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([approval, reply, yesNo])
    }
}
