import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";

const sent: Array<Record<string, unknown>> = [];

vi.mock("expo-server-sdk", () => {
  class Expo {
    // biome-ignore lint/complexity/noUselessConstructor: mock parity with the SDK
    constructor(_options?: unknown) {}
    chunkPushNotifications(messages: Array<Record<string, unknown>>) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: Array<Record<string, unknown>>) {
      sent.push(...chunk);
      return chunk.map((message) =>
        message.to === "ExponentPushToken[stale]"
          ? {
              status: "error",
              message: "device gone",
              details: { error: "DeviceNotRegistered" },
            }
          : { status: "ok", id: "ticket" },
      );
    }
  }
  return { Expo, default: Expo };
});

let app: typeof import("../app")["app"];
let db: typeof import("../db")["db"];
let schema: typeof import("../db/schema");
let hashWebhookToken: typeof import("../lib/token")["hashWebhookToken"];

const TOKEN = "whk_test-token-abcdefghijklmnopqrstuv";

beforeAll(async () => {
  ({ app } = await import("../app"));
  ({ db } = await import("../db"));
  schema = await import("../db/schema");
  ({ hashWebhookToken } = await import("../lib/token"));
  const { runMigrations } = await import("../db/migrate");
  runMigrations();

  const now = new Date();
  await db.insert(schema.user).values({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.service).values({
    id: "svc_1",
    userId: "user_1",
    title: "Acme CRM",
    imageUrl: "https://example.com/default.png",
    url: "https://example.com/app",
    tokenHash: hashWebhookToken(TOKEN),
    createdAt: now,
    updatedAt: now,
  });
});

async function post(token: string, body: unknown, idempotencyKey?: string) {
  return app.request(`/hooks/${token}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /hooks/:token", () => {
  it("404s on an unknown token without leaking details", async () => {
    const res = await post("whk_wrong", { body: "hi" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Unknown webhook" });
  });

  it("400s on an invalid payload", async () => {
    const res = await post(TOKEN, { title: "no body" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Invalid payload");
  });

  it("reports no devices when none are registered", async () => {
    const res = await post(TOKEN, { body: "hello" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; delivered: number; message?: string };
    expect(json.ok).toBe(true);
    expect(json.delivered).toBe(0);
    expect(json.message).toContain("No active iOS devices");
  });

  it("delivers to active devices and resolves overrides", async () => {
    const now = new Date();
    await db.insert(schema.device).values({
      id: "dev_1",
      userId: "user_1",
      expoPushToken: "ExponentPushToken[a]",
      platform: "ios",
      active: true,
      createdAt: now,
      lastSeenAt: now,
    });

    sent.length = 0;
    const res = await post(TOKEN, { body: "Build failed", title: "CI" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; delivered: number; eventId: string };
    expect(json.ok).toBe(true);
    expect(json.delivered).toBe(1);
    expect(json.eventId).toMatch(/^evt_/);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "ExponentPushToken[a]",
      title: "CI",
      body: "Build failed",
      mutableContent: true,
      priority: "high",
      // Falls back to the service image when the webhook has no override.
      richContent: { image: "https://example.com/default.png" },
    });
    const data = sent[0]?.data as Record<string, unknown>;
    expect(data.sourceName).toBe("CI");
    expect(data.conversationId).toBe("hark-svc_1");
    expect(JSON.stringify(sent[0])).not.toContain("user_1");
  });

  it("suppresses duplicate requests with the same idempotency key", async () => {
    sent.length = 0;
    const first = await post(TOKEN, { body: "Only once", title: "CI" }, "deploy-184");
    const firstJson = (await first.json()) as { eventId: string; delivered: number };
    const second = await post(TOKEN, { body: "Only once", title: "CI" }, "deploy-184");
    const secondJson = (await second.json()) as {
      eventId: string;
      delivered: number;
      idempotent: boolean;
    };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondJson.eventId).toBe(firstJson.eventId);
    expect(secondJson.idempotent).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("rejects an idempotency key reused with a different payload", async () => {
    const res = await post(TOKEN, { body: "Different body" }, "deploy-184");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Idempotency-Key was already used with a different payload",
    });
  });

  it("deactivates devices Expo reports as unregistered", async () => {
    const now = new Date();
    await db.insert(schema.device).values({
      id: "dev_stale",
      userId: "user_1",
      expoPushToken: "ExponentPushToken[stale]",
      platform: "ios",
      active: true,
      createdAt: now,
      lastSeenAt: now,
    });

    const res = await post(TOKEN, { body: "ping" });
    expect(res.status).toBe(200);

    const { eq } = await import("drizzle-orm");
    const [stale] = await db.select().from(schema.device).where(eq(schema.device.id, "dev_stale"));
    expect(stale?.active).toBe(false);
  });

  it("rejects unauthenticated access to the services API", async () => {
    const res = await app.request("/api/services");
    expect(res.status).toBe(401);
  });

  it("enforces the per-service rate limit", async () => {
    const now = new Date();
    const limitToken = "whk_limit-test-abcdefghijklmnopqrst";
    await db.insert(schema.service).values({
      id: "svc_limit",
      userId: "user_1",
      title: "Limited",
      tokenHash: hashWebhookToken(limitToken),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.event).values(
      Array.from({ length: 60 }, (_, index) => ({
        id: `evt_limit_${index}`,
        serviceId: "svc_limit",
        title: "Limited",
        body: "test",
        status: "accepted",
        deliveredCount: 1,
        createdAt: now,
      })),
    );

    const res = await post(limitToken, { body: "one too many" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Service rate limit exceeded",
      retryAfterSeconds: 60,
    });
  });
});
