import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { useSession, signOut } = authClient;

export function signInWithUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authClient.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });
}
