import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";

const sent = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const apns = vi.hoisted(() => ({ staleToken: null as string | null }));

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const TOKEN_STALE = "c".repeat(64);

vi.mock("../auth", () => ({
  auth: {
    handler: () => new Response("not used"),
    api: {
      getSession: async () => ({
        user: {
          id: "welcome_user",
          name: "Welcome User",
          email: "welcome@example.com",
          image: null,
        },
      }),
    },
  },
}));

vi.mock("../lib/apns", () => ({
  sendAlertPush: async (token: string, payload: Record<string, unknown>) => {
    const aps = payload.aps as { alert: { title: string; body: string } };
    sent.push({ to: token, title: aps.alert.title, body: aps.alert.body, data: payload.body });
    return token === apns.staleToken
      ? { status: 410, apnsId: null, reason: "Unregistered", accepted: false }
      : { status: 200, apnsId: "apns-id", reason: null, accepted: true };
  },
}));

let app: typeof import("../app")["app"];
let db: typeof import("../db")["db"];
let schema: typeof import("../db/schema");
let env: typeof import("../env")["env"];

beforeAll(async () => {
  ({ app } = await import("../app"));
  ({ db } = await import("../db"));
  ({ env } = await import("../env"));
  schema = await import("../db/schema");
  const { runMigrations } = await import("../db/migrate");
  runMigrations();
  const now = new Date();
  await db.insert(schema.user).values({
    id: "welcome_user",
    name: "Welcome User",
    email: "welcome@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
});

beforeEach(async () => {
  vi.useFakeTimers();
  sent.length = 0;
  apns.staleToken = null;
  await db.delete(schema.device);
  await db
    .update(schema.user)
    .set({ welcomeNotificationSentAt: null })
    .where(eq(schema.user.id, "welcome_user"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function register(apnsToken: string) {
  return app.request("/api/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apnsToken, platform: "ios", deviceName: "iPhone" }),
  });
}

describe("POST /api/devices onboarding", () => {
  it("sends the welcome once for the account's first registered phone", async () => {
    const firstRequest = register(TOKEN_A);
    await vi.advanceTimersByTimeAsync(4_000);
    const first = await firstRequest;
    expect(first.status).toBe(201);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      to: TOKEN_A,
      title: "Hark",
      body: "Welcome to Hark — this iPhone is registered.",
      data: {
        sourceName: "Hark",
        url: env.APP_URL,
      },
    });
    expect(sent[1]).toMatchObject({
      body: "Create a service in the dashboard and point any webhook at it.",
      data: { url: `${env.APP_URL}/dashboard` },
    });

    const refresh = await register(TOKEN_A);
    const secondPhone = await register(TOKEN_B);
    expect(refresh.status).toBe(201);
    expect(secondPhone.status).toBe(201);
    expect(sent).toHaveLength(2);

    const [account] = await db.select().from(schema.user);
    expect(account?.welcomeNotificationSentAt).toBeInstanceOf(Date);
  });

  it("stores the APNs token and rejects anything that is not one", async () => {
    const request = register(TOKEN_A.toUpperCase());
    await vi.advanceTimersByTimeAsync(4_000);
    expect((await request).status).toBe(201);
    const [row] = await db.select().from(schema.device);
    // Registration lowercases so the same phone never registers twice.
    expect(row?.token).toBe(TOKEN_A);

    const rejected = await register("ExponentPushToken[a]");
    expect(rejected.status).toBe(400);
  });

  it("deactivates a device APNs reports as unregistered during the welcome", async () => {
    apns.staleToken = TOKEN_STALE;
    const request = register(TOKEN_STALE);
    await vi.advanceTimersByTimeAsync(4_000);
    const res = await request;

    expect(res.status).toBe(201);
    expect((await res.json()) as { device: { active: boolean } }).toMatchObject({
      device: { active: false },
    });
    // The sequence stops at the first rejection instead of sending the second.
    expect(sent).toHaveLength(1);
    const [row] = await db.select().from(schema.device);
    expect(row?.active).toBe(false);
  });
});
