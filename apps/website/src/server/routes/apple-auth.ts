import { appleNativeTokenExchangeSchema } from "@hark/contracts";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { account, appleNativeGrant } from "../db/schema";
import { env } from "../env";
import {
  AppleOAuthError,
  appleAuthConfig,
  exchangeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} from "../lib/apple";
import { newId } from "../lib/id";
import { encryptAppleRefreshToken, hashAppleAuthorizationCode } from "../lib/token";
import { type AuthedEnv, requireAuth } from "../middleware";

export const appleAuthRoute = new Hono<AuthedEnv>()
  .use("*", requireAuth)
  .post("/native-token", async (c) => {
    const parsed = appleNativeTokenExchangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid Apple token exchange request" }, 400);

    const user = c.get("user");
    const codeHash = hashAppleAuthorizationCode(parsed.data.authorizationCode);
    const replay = await db
      .select({ id: appleNativeGrant.id })
      .from(appleNativeGrant)
      .where(eq(appleNativeGrant.authorizationCodeHash, codeHash))
      .limit(1);
    if (replay.length > 0)
      return c.json({ error: "Apple authorization code was already used" }, 409);

    try {
      const subject = await verifyAppleIdentityToken(
        parsed.data.identityToken,
        env.APPLE_SIGN_IN_BUNDLE_ID,
      );
      const linkedAccount = await db
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.userId, user.id),
            eq(account.providerId, "apple"),
            eq(account.accountId, subject),
          ),
        )
        .limit(1);
      if (linkedAccount.length === 0) {
        return c.json({ error: "Apple identity does not match the signed-in account" }, 403);
      }

      const tokens = await exchangeAppleAuthorizationCode(
        parsed.data.authorizationCode,
        env.APPLE_SIGN_IN_BUNDLE_ID,
        subject,
        appleAuthConfig(),
      );
      const now = new Date();
      await db
        .insert(appleNativeGrant)
        .values({
          id: newId("apg"),
          userId: user.id,
          appleSubject: subject,
          clientId: env.APPLE_SIGN_IN_BUNDLE_ID,
          refreshTokenCiphertext: encryptAppleRefreshToken(tokens.refreshToken),
          authorizationCodeHash: codeHash,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: appleNativeGrant.userId,
          set: {
            appleSubject: subject,
            clientId: env.APPLE_SIGN_IN_BUNDLE_ID,
            refreshTokenCiphertext: encryptAppleRefreshToken(tokens.refreshToken),
            authorizationCodeHash: codeHash,
            updatedAt: now,
          },
        });
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof AppleOAuthError && error.code === "invalid_grant") {
        return c.json({ error: "Apple authorization code is expired or already used" }, 409);
      }
      console.error("[apple-auth] Native authorization-code exchange failed", error);
      return c.json({ error: "Could not secure the Apple authorization" }, 502);
    }
  });
