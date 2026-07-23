/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "notification-service",
  name: "HarkNotificationService",
  deploymentTarget: "16.4",
  frameworks: ["UserNotifications", "Intents"],
  entitlements: {
    "com.apple.developer.usernotifications.communication": true,
  },
};
