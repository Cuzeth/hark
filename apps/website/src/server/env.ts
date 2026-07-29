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
  /** Username of the single account, seeded at boot when the user table is empty. */
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  /** Password for the seeded account. Without it nobody can sign in. */
  ADMIN_PASSWORD: z.string().min(8).optional(),
  /** Better Auth stores an email internally; defaults to `${ADMIN_USERNAME}@hark.local`. */
  ADMIN_EMAIL: z.string().optional(),
  /** Direct APNs provider credentials. Every push Hark sends needs them. */
  APNS_KEY_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APNS_PRIVATE_KEY: z.string().optional(),
  APNS_BUNDLE_ID: z.string().min(1).default("dev.abdeen.hark"),
  APNS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  /**
   * Header carrying the real client IP, set (and overwritten) by a trusted edge.
   * Leave unset when the edge does not provide one: client-supplied forwarded
   * headers are spoofable and would let a caller reset its own rate-limit bucket.
   */
  /** Empty means unset, matching how compose passes absent optional values. */
  TRUSTED_CLIENT_IP_HEADER: z.string().trim().optional(),
  SERVICE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  ACCOUNT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(1500),
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
  if (!env.ADMIN_PASSWORD) {
    problems.push(
      "ADMIN_PASSWORD is not set — the admin account cannot be created and nobody can sign in.",
    );
  }
  if (env.BETTER_AUTH_SECRET === DEV_SECRET) {
    problems.push("BETTER_AUTH_SECRET is using the insecure development default.");
  }
  if (!env.APNS_KEY_ID || !env.APPLE_TEAM_ID || !env.APNS_PRIVATE_KEY) {
    problems.push(
      "APNS_KEY_ID / APPLE_TEAM_ID / APNS_PRIVATE_KEY are not all set — no notifications can be delivered, neither alerts nor Live Activities.",
    );
  }

  if (env.NODE_ENV === "production" && env.BETTER_AUTH_SECRET === DEV_SECRET) {
    console.error("Refusing to start in production with the default BETTER_AUTH_SECRET.");
    process.exit(1);
  }

  for (const p of problems) {
    console.warn(`[env] ${p}`);
  }
}
