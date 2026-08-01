import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config: _config }: ConfigContext): ExpoConfig => ({
  name: "Hark",
  slug: "hark",
  version: "1.0.1",
  icon: "./assets/icon.png",
  scheme: "hark",
  orientation: "portrait",
  userInterfaceStyle: "light",
  platforms: ["ios"],
  ios: {
    bundleIdentifier: "dev.abdeen.hark",
    icon: "./assets/icon.png",
    supportsTablet: false,
    // Communication Notifications + SiriKit. `aps-environment` is declared here
    // so a local `expo prebuild` emits the push entitlement without Xcode edits.
    // `critical-alerts` is Apple-granted: signing fails until the request form at
    // developer.apple.com is approved for this bundle identifier.
    entitlements: {
      "aps-environment": "development",
      "com.apple.developer.usernotifications.communication": true,
      "com.apple.developer.usernotifications.time-sensitive": true,
      // Restore once Apple approves the critical-alerts request for dev.abdeen.hark —
      // until then the profile can't carry it and signing fails.
      // "com.apple.developer.usernotifications.critical-alerts": true,
      "com.apple.developer.siri": true,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSUserActivityTypes: ["INSendMessageIntent"],
    },
  },
  plugins: [
    "./plugins/with-ios-scene-delegate",
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#CE2020",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
    [
      "expo-widgets",
      {
        bundleIdentifier: "dev.abdeen.hark.widgets",
        groupIdentifier: "group.dev.abdeen.hark",
        enablePushNotifications: true,
        frequentUpdates: true,
      },
    ],
    [
      "@bacons/apple-targets",
      {
        appleTeamId: process.env.APPLE_TEAM_ID ?? "",
      },
    ],
  ],
});
