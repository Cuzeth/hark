import { z } from "zod";

const DEV_SECRET = "hark-insecure-dev-secret-change-me";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  /** SQLite file path. Production containers should point this at /data/hark.sqlite. */
  DATABASE_URL: z.string().min(1).default("./data/hark.sqlite"),
  /** Public origin the browser uses. In dev this is the Vite server, which proxies /api. */
  APP_URL: z.url().default("http://localhost:5173"),
  BETTER_AUTH_SECRET: z.string().min(16).default(DEV_SECRET),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Optional. Enables authenticated requests to the Expo Push Service. */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  SERVICE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  ACCOUNT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

/** Startup checks that warn (dev) or fail (production) without real credentials. */
export function assertRuntimeEnv(): void {
  const problems: string[] = [];
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    problems.push(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — Google sign-in will fail until configured.",
    );
  }
  if (env.BETTER_AUTH_SECRET === DEV_SECRET) {
    problems.push("BETTER_AUTH_SECRET is using the insecure development default.");
  }
  if (!env.EXPO_ACCESS_TOKEN) {
    problems.push("EXPO_ACCESS_TOKEN is not set — push requests to Expo will be unauthenticated.");
  }

  if (env.NODE_ENV === "production" && env.BETTER_AUTH_SECRET === DEV_SECRET) {
    console.error("Refusing to start in production with the default BETTER_AUTH_SECRET.");
    process.exit(1);
  }

  for (const p of problems) {
    console.warn(`[env] ${p}`);
  }
}
