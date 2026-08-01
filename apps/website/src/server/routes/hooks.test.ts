import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";
process.env.SERVICE_RATE_LIMIT_PER_MINUTE = "60";
process.env.ACCOUNT_RATE_LIMIT_PER_MINUTE = "100";

const sent: Array<Record<string, unknown>> = [];

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const TOKEN_FOREIGN = "f".repeat(64);
const TOKEN_STALE = "c".repeat(64);

vi.mock("../lib/apns", () => ({
  sendAlertPush: async (token: string, payload: Record<string, unknown>) => {
    const aps = payload.aps as {
      alert: { title: string; body: string };
      category?: string;
      "thread-id"?: string;
      "interruption-level"?: string;
      sound: unknown;
    };
    sent.push({
      to: token,
      title: aps.alert.title,
      body: aps.alert.body,
      categoryId: aps.category,
      conversationId: aps["thread-id"],
      interruptionLevel: aps["interruption-level"],
      sound: aps.sound,
      data: payload.body,
    });
    return token === TOKEN_STALE
      ? { status: 410, apnsId: null, reason: "Unregistered", accepted: false }
      : { status: 200, apnsId: "apns-id", reason: null, accepted: true };
  },
}));

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
      token: TOKEN_A,
      platform: "ios",
      active: true,
      interactionSchemaVersion: 1,
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
      to: TOKEN_A,
      title: "CI",
      body: "Build failed",
      conversationId: "hark-svc_1",
    });
    const data = sent[0]?.data as Record<string, unknown>;
    // Falls back to the service image when the webhook has no override.
    expect(data.avatarUrl).toBe("https://example.com/default.png");
    expect(data.sourceName).toBe("CI");
    expect(data.conversationId).toBe("hark-svc_1");
    expect(JSON.stringify(sent[0])).not.toContain("user_1");
  });

  it("delivers to all active devices by default", async () => {
    const now = new Date();
    await db.insert(schema.device).values({
      id: "dev_2",
      userId: "user_1",
      token: TOKEN_B,
      platform: "ios",
      active: true,
      interactionSchemaVersion: 1,
      createdAt: now,
      lastSeenAt: now,
    });

    sent.length = 0;
    const res = await post(TOKEN, { body: "Everyone" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, delivered: 2 });
    expect(sent.map((message) => message.to).sort()).toEqual([TOKEN_A, TOKEN_B]);
  });

  it("routes a notification only to selected devices", async () => {
    sent.length = 0;
    const res = await post(TOKEN, { body: "Only A", deviceIds: ["dev_1"] });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, delivered: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(TOKEN_A);
  });

  it("stores the request priority on the event and raises the alert", async () => {
    sent.length = 0;
    const res = await post(TOKEN, {
      body: "Pager",
      priority: "critical",
      deviceIds: ["dev_1"],
    });
    expect(res.status).toBe(200);
    const { eventId } = (await res.json()) as { eventId: string };

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.event).where(eq(schema.event.id, eventId));
    expect(row?.priority).toBe("critical");
    expect(sent[0]).toMatchObject({
      interruptionLevel: "critical",
      sound: { critical: 1, name: "default", volume: 1 },
    });
  });

  it("falls back to the service priority when the request omits one", async () => {
    const now = new Date();
    const priorityToken = "whk_priority-test-abcdefghijklmnopq";
    await db.insert(schema.service).values({
      id: "svc_priority",
      userId: "user_1",
      title: "Pager duty",
      priority: "time-sensitive",
      tokenHash: hashWebhookToken(priorityToken),
      createdAt: now,
      updatedAt: now,
    });

    sent.length = 0;
    const res = await post(priorityToken, { body: "Inherited", deviceIds: ["dev_1"] });
    expect(res.status).toBe(200);
    const { eventId } = (await res.json()) as { eventId: string };

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.event).where(eq(schema.event.id, eventId));
    expect(row?.priority).toBe("time-sensitive");
    expect(sent[0]).toMatchObject({ interruptionLevel: "time-sensitive", sound: "default" });
  });

  it("leaves the alert untouched for the default priority", async () => {
    sent.length = 0;
    const res = await post(TOKEN, { body: "Quiet", deviceIds: ["dev_1"] });
    expect(res.status).toBe(200);
    expect(sent[0]).toMatchObject({ interruptionLevel: undefined, sound: "default" });
  });

  it("creates and resolves an approval through the webhook event", async () => {
    sent.length = 0;
    const created = await post(TOKEN, {
      body: "Deploy production?",
      title: "CI",
      imageUrl: "https://example.com/ci.png",
      deviceIds: ["dev_1"],
      response: {
        type: "approval",
        correlationId: "deploy-184",
        expiresInSeconds: 900,
        callback: {
          url: "https://ci.example.com/hark-response",
          token: "private-callback-token",
        },
      },
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { eventId: string };
    expect(createdBody).toMatchObject({
      ok: true,
      delivered: 1,
      response: { status: "pending" },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ categoryId: "HARK_APPROVAL_V1" });
    const data = sent[0]?.data as {
      interactionId: string;
      responseToken: string;
      avatarUrl: string;
    };
    expect(data.avatarUrl).toBe("https://example.com/ci.png");

    const callbackFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const response = await app.request(`/api/interaction-responses/${data.interactionId}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        deviceId: "dev_1",
        responseToken: data.responseToken,
      }),
    });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(callbackFetch).toHaveBeenCalledOnce());
    const callbackCall = callbackFetch.mock.calls[0];
    if (!callbackCall) throw new Error("Expected callback request");
    if (!callbackCall[1]) throw new Error("Expected callback request options");
    expect(callbackCall[0]).toBe("https://ci.example.com/hark-response");
    expect((callbackCall[1].headers as Record<string, string>).authorization).toBe(
      "Bearer private-callback-token",
    );
    callbackFetch.mockRestore();
    const status = await app.request(`/hooks/${TOKEN}/events/${createdBody.eventId}`);
    expect(await status.json()).toMatchObject({
      ok: true,
      event: {
        id: createdBody.eventId,
        response: { status: "approved", action: "approve", correlationId: "deploy-184" },
      },
    });
  });

  it("records credential text responses as replied", async () => {
    sent.length = 0;
    const created = await post(TOKEN, {
      body: "Reply?",
      deviceIds: ["dev_1"],
      response: { type: "text" },
    });
    const createdBody = (await created.json()) as { eventId: string };
    const data = sent[0]?.data as { interactionId: string; responseToken: string };
    const response = await app.request(`/api/interaction-responses/${data.interactionId}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "reply",
        response: "Build 11 works",
        deviceId: "dev_1",
        responseToken: data.responseToken,
      }),
    });
    expect(response.status).toBe(200);
    const status = await app.request(`/hooks/${TOKEN}/events/${createdBody.eventId}`);
    expect(await status.json()).toMatchObject({
      event: { response: { status: "replied", action: "reply", text: "Build 11 works" } },
    });
  });

  it("rejects device IDs owned by another account", async () => {
    const now = new Date();
    await db.insert(schema.user).values({
      id: "user_2",
      name: "Other User",
      email: "other@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.device).values({
      id: "dev_foreign",
      userId: "user_2",
      token: TOKEN_FOREIGN,
      platform: "ios",
      active: true,
      createdAt: now,
      lastSeenAt: now,
    });

    sent.length = 0;
    const res = await post(TOKEN, { body: "No leak", deviceIds: ["dev_foreign"] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Invalid device selection" });
    expect(sent).toHaveLength(0);
  });

  it("treats reordered device IDs as the same idempotent request", async () => {
    sent.length = 0;
    const first = await post(TOKEN, { body: "Both", deviceIds: ["dev_1", "dev_2"] }, "targeted-1");
    const second = await post(TOKEN, { body: "Both", deviceIds: ["dev_2", "dev_1"] }, "targeted-1");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, idempotent: true, delivered: 2 });
    expect(sent).toHaveLength(2);
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
    // One fan-out across both registered devices, not a second delivery.
    expect(sent).toHaveLength(2);
  });

  it("rejects an idempotency key reused with a different payload", async () => {
    const res = await post(TOKEN, { body: "Different body" }, "deploy-184");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Idempotency-Key was already used with a different payload",
    });
  });

  it("deactivates devices APNs reports as unregistered", async () => {
    const now = new Date();
    await db.insert(schema.device).values({
      id: "dev_stale",
      userId: "user_1",
      token: TOKEN_STALE,
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

  it("never returns provider error detail when every push fails", async () => {
    const now = new Date();
    const failToken = "whk_fail-only-abcdefghijklmnopqrstu";
    await db.insert(schema.user).values({
      id: "user_fail",
      name: "Fail User",
      email: "fail@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.service).values({
      id: "svc_fail",
      userId: "user_fail",
      title: "Fail only",
      tokenHash: hashWebhookToken(failToken),
      createdAt: now,
      updatedAt: now,
    });
    // The APNs mock only rejects this token, and it is unique across devices.
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.device).where(eq(schema.device.token, TOKEN_STALE));
    await db.insert(schema.device).values({
      id: "dev_fail_only",
      userId: "user_fail",
      token: TOKEN_STALE,
      platform: "ios",
      active: true,
      createdAt: now,
      lastSeenAt: now,
    });

    const res = await post(failToken, { body: "ping" });
    expect(res.status).toBe(502);
    const raw = await res.text();
    expect(raw).not.toContain(TOKEN_STALE);
    expect(raw).not.toContain("Unregistered");
    expect(JSON.parse(raw)).toEqual({ ok: false, error: "Push delivery failed" });
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

  it("counts recent interactions toward the webhook account rate limit", async () => {
    const now = new Date();
    await db.insert(schema.user).values({
      id: "user_hook_combined_rate",
      name: "Combined Rate",
      email: "combined-rate@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    const combinedToken = "whk_combined-rate-abcdefghijklmnopqr";
    await db.insert(schema.service).values({
      id: "svc_hook_combined_rate",
      userId: "user_hook_combined_rate",
      title: "Combined",
      tokenHash: hashWebhookToken(combinedToken),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.apiToken).values({
      id: "tok_hook_combined_rate",
      userId: "user_hook_combined_rate",
      name: "Combined",
      tokenHash: "hook_combined_hash",
      prefix: "hark_combine",
      scopes: ["interactions:create"],
      createdAt: now,
    });
    await db.insert(schema.interaction).values(
      Array.from({ length: 100 }, (_, index) => ({
        id: `int_hook_combined_rate_${index}`,
        userId: "user_hook_combined_rate",
        requesterTokenId: "tok_hook_combined_rate",
        title: "Recent",
        prompt: "Count this",
        kind: "approval",
        status: "pending",
        choices: ["approve", "deny"],
        actionDigest: `combined-rate-digest-${index}`,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
      })),
    );

    const response = await post(combinedToken, { body: "one too many" });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: "Account rate limit exceeded" });
  });
});
