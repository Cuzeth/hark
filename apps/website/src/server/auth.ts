import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { user as userTable } from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  appName: "Hark",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        // Single-account invariant: the boot-time seed fills the empty table,
        // and every later sign-up attempt is refused.
        before: async () => {
          const [existing] = await db.select({ id: userTable.id }).from(userTable).limit(1);
          if (existing) {
            throw new APIError("FORBIDDEN", { message: "Sign-ups are disabled" });
          }
        },
      },
    },
  },
  plugins: [username(), expo()],
  trustedOrigins: [env.APP_URL, "hark://", "hark://*"],
});

export type Session = typeof auth.$Infer.Session;
