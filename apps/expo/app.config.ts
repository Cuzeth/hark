import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config: _config }: ConfigContext): ExpoConfig => ({
  name: "Hark",
  slug: "hark",
  version: "1.0.0",
  icon: "./assets/icon.png",
  scheme: "hark",
  orientation: "portrait",
  userInterfaceStyle: "light",
  platforms: ["ios"],
  ios: {
    bundleIdentifier: "dev.abdeen.hark",
    icon: "./assets/icon.png",
    supportsTablet: false,
    // Communication Notifications + SiriKit. `aps-environment` is managed by
    // EAS capability sync but included so bare prebuilds get push entitlements.
    entitlements: {
      "aps-environment": "development",
      "com.apple.developer.usernotifications.communication": true,
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
        backgroundColor: "#035B49",
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
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
  },
});
