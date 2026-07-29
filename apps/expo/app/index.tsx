import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient, useSession } from "../src/lib/auth";
import { colors, fonts, tightTracking } from "../src/lib/theme";

export default function SignInScreen() {
  const { data: session, isPending } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/home" />;

  const submit = async () => {
    if (busy) return;
    if (!username || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.username({ username, password });
      if (result.error) throw new Error(result.error.message ?? "Sign-in failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
        <View style={styles.header}>
          <View style={styles.brandMark} />
          <Text style={styles.brand}>Hark</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            A private instance. Use the account credentials for this server.
          </Text>
        </View>

        <View style={styles.footer}>
          {isPending ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <TextInput
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={colors.soft}
                returnKeyType="next"
                style={styles.input}
                textContentType="username"
                value={username}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                placeholder="Password"
                placeholderTextColor={colors.soft}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  (pressed || busy) && styles.submitButtonPressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Sign in</Text>
                )}
              </Pressable>
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.paper,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandMark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  brand: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 18,
    letterSpacing: tightTracking(18),
  },
  hero: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    maxWidth: 330,
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: tightTracking(40),
  },
  subtitle: {
    maxWidth: 330,
    marginTop: 20,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: tightTracking(16),
  },
  footer: {
    paddingBottom: 16,
    gap: 10,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 26,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
    letterSpacing: tightTracking(16),
  },
  submitButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 26,
    backgroundColor: colors.accent,
  },
  submitButtonPressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 16,
    letterSpacing: tightTracking(16),
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: tightTracking(13),
  },
});
