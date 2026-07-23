import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

export function signInWithGoogle(): Promise<unknown> {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
}
