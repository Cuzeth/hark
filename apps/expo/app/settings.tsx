import * as Notifications from "expo-notifications";
import { Redirect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/lib/api";
import { authClient, useSession } from "../src/lib/auth";
import { clearInteractionResponses, DEVICE_ID_KEY } from "../src/lib/interactions";
import { colors, fonts, tightTracking } from "../src/lib/theme";

const APNS_TOKEN_KEY = "hark.device.apnsToken";
/** Written by builds that registered an Expo push token; cleared alongside the APNs one. */
const LEGACY_EXPO_TOKEN_KEY = "hark.device.expoPushToken";

export default function SettingsScreen() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null);
  const [criticalAlertsAllowed, setCriticalAlertsAllowed] = useState<boolean | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [liveActivitiesCapable, setLiveActivitiesCapable] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      Notifications.getPermissionsAsync(),
      SecureStore.getItemAsync(DEVICE_ID_KEY),
      api.listDevices().catch(() => ({ devices: [] })),
    ]).then(([permission, deviceId, result]) => {
      setNotificationsAllowed(permission.granted);
      setCriticalAlertsAllowed(permission.ios?.allowsCriticalAlerts ?? false);
      setRegistered(Boolean(deviceId));
      setLiveActivitiesCapable(
        result.devices.find((registeredDevice) => registeredDevice.id === deviceId)
          ?.liveActivitiesCapable ?? false,
      );
    });
  }, []);

  if (!isPending && !session) return <Redirect href="/" />;

  const clearDevice = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(APNS_TOKEN_KEY),
      SecureStore.deleteItemAsync(LEGACY_EXPO_TOKEN_KEY),
      SecureStore.deleteItemAsync(DEVICE_ID_KEY),
      clearInteractionResponses(),
      Notifications.setBadgeCountAsync(0),
    ]);
  };

  const signOut = () => {
    Alert.alert("Sign out", "This device will stop receiving notifications.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const apnsToken = await SecureStore.getItemAsync(APNS_TOKEN_KEY);
            try {
              if (apnsToken) await api.unregisterDevice({ apnsToken });
            } catch {
              // Best effort; stale tokens are also deactivated server-side.
            }
            await clearDevice();
            await authClient.signOut();
            router.replace("/");
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <SymbolView name="chevron.left" size={18} tintColor={colors.ink} weight="semibold" />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.iconButton} />
        </View>

        <Text style={styles.sectionTitle}>Device</Text>
        <SettingsRow
          icon="bell.fill"
          label="Notifications"
          value={
            notificationsAllowed === null ? "Checking…" : notificationsAllowed ? "Allowed" : "Off"
          }
          onPress={notificationsAllowed === false ? () => void Linking.openSettings() : undefined}
        />
        <SettingsRow
          icon="bell.badge.fill"
          label="Critical alerts"
          value={
            criticalAlertsAllowed === null ? "Checking…" : criticalAlertsAllowed ? "Allowed" : "Off"
          }
          onPress={criticalAlertsAllowed === false ? () => void Linking.openSettings() : undefined}
        />
        <SettingsRow
          icon="iphone"
          label="This iPhone"
          value={registered === null ? "Checking…" : registered ? "Registered" : "Not registered"}
          onPress={registered === false ? () => router.replace("/home") : undefined}
        />
        <SettingsRow
          icon="waveform.path.ecg"
          label="Live Activities"
          value={
            liveActivitiesCapable === null
              ? "Checking…"
              : liveActivitiesCapable
                ? "Available"
                : "Not available"
          }
        />

        <Text style={styles.sectionTitle}>Account</Text>
        <SettingsRow icon="person.fill" label="Signed in as" value={session?.user.email ?? ""} />
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.accountAction}>
          <Text style={styles.accountActionText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: Parameters<typeof SymbolView>[0]["name"];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <SymbolView name={icon} size={16} tintColor={colors.accent} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <SymbolView name="chevron.right" size={12} tintColor={colors.soft} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 17,
    letterSpacing: tightTracking(17),
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 8,
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowPressed: { opacity: 0.65 },
  rowIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
  },
  rowLabel: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: tightTracking(14),
  },
  rowValue: {
    minWidth: 0,
    flex: 1,
    color: colors.soft,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "right",
    letterSpacing: tightTracking(13),
  },
  accountAction: {
    minHeight: 52,
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  accountActionText: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: tightTracking(14),
  },
  pressed: {
    backgroundColor: "#F0EFEC",
    transform: [{ scale: 0.96 }],
  },
});
