import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";

const authState = vi.hoisted(() => ({ userId: "hook_activity_user" as string | null }));
const apnsCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const billingState = vi.hoisted(() => ({ pro: true }));

vi.mock("../auth", () => ({
  auth: {
    handler: () => new Response("not used"),
    api: {
      getSession: async () =>
        authState.userId
          ? {
              user: {
                id: authState.userId,
                name: "Hook Activity User",
                email: "hook-activity@example.com",
                image: null,
              },
            }
          : null,
    },
  },
}));

vi.mock("../lib/billing", () => ({
  getBilling: async () => ({
    plan: billingState.pro ? "pro" : "free",
    features: { deviceRouting: billingState.pro },
    limits: {
      devices: billingState.pro ? null : 1,
      servicePerMinute: 1000,
      accountPerMinute: 1000,
    },
  }),
  checkNotificationAllowance: async () => true,
  trackNotification: async () => undefined,
  hasAutumn: () => false,
  clearBillingCache: () => undefined,
  createCheckout: async () => "https://example.test",
  createBillingPortal: async () => "https://example.test",
}));

vi.mock("../lib/apns", () => ({
  isInvalidApnsTokenReason: () => false,
  sendLiveActivityPush: async (
    token: string,
    environment: string,
    input: Record<string, unknown>,
    priority: number,
  ) => {
    apnsCalls.push({ token, environment, input, priority });
    return { status: 200, apnsId: `hook-apns-${apnsCalls.length}`, reason: null, accepted: true };
  },
}));

let app: typeof import("../app")["app"];
let db: typeof import("../db")["db"];
let schema: typeof import("../db/schema");
let encryptLiveActivityToken: typeof import("../lib/token")["encryptLiveActivityToken"];
let hashWebhookToken: typeof import("../lib/token")["hashWebhookToken"];

const TOKEN = "whk_live-activity-abcdefghijklmnop";
const OTHER_TOKEN = "whk_live-activity-other-abcdefghij";

beforeAll(async () => {
  ({ app } = await import("../app"));
  ({ db } = await import("../db"));
  schema = await import("../db/schema");
  ({ encryptLiveActivityToken, hashWebhookToken } = await import("../lib/token"));
  const { runMigrations } = await import("../db/migrate");
  runMigrations();
  const now = new Date();
  await db.insert(schema.user).values({
    id: "hook_activity_user",
    name: "Hook Activity User",
    email: "hook-activity@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.service).values([
    {
      id: "hook_activity_service",
      userId: "hook_activity_user",
      title: "Deployments",
      tokenHash: hashWebhookToken(TOKEN),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "hook_activity_other_service",
      userId: "hook_activity_user",
      title: "Other",
      tokenHash: hashWebhookToken(OTHER_TOKEN),
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(schema.device).values({
    id: "hook_activity_device",
    userId: "hook_activity_user",
    expoPushToken: "ExponentPushToken[hook-activity]",
    platform: "ios",
    active: true,
    liveActivityPushToStartTokenCiphertext: encryptLiveActivityToken("aa".repeat(32)),
    liveActivityTokenEnvironment: "sandbox",
    liveActivitySchemaVersion: 1,
    liveActivityTokenUpdatedAt: now,
    createdAt: now,
    lastSeenAt: now,
  });
});

beforeEach(async () => {
  authState.userId = "hook_activity_user";
  apnsCalls.length = 0;
  billingState.pro = true;
  await db.delete(schema.liveActivity);
});

function activityRequest(
  token: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
  idempotencyKey?: string,
) {
  return app.request(`/hooks/${token}/live-activities${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function start(token = TOKEN, idempotencyKey?: string) {
  return activityRequest(
    token,
    "",
    "POST",
    {
      title: "Deploy #184",
      status: "Building",
      progress: 0,
      symbol: "build",
      accentColor: "#FF9F0A",
      deviceIds: ["hook_activity_device"],
    },
    idempotencyKey,
  );
}

describe("Live Activity webhook routes", () => {
  it("starts, updates, reads, and ends one stateful activity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
    try {
      const started = await start();
      expect(started.status).toBe(201);
      const startBody = (await started.json()) as { activityId: string };
      expect(startBody).toMatchObject({
        ok: true,
        sequence: 0,
        status: "active",
        accepted: 1,
        failed: 0,
        state: { accentColor: "#FF9F0A", progress: 0 },
        expiresAt: "2026-07-25T20:00:00.000Z",
        staleAt: "2026-07-25T16:00:00.000Z",
      });
      expect(apnsCalls.at(-1)).toMatchObject({
        environment: "sandbox",
        priority: 10,
        input: {
          event: "start",
          staleDate: 1_784_995_200,
          props: { activityId: startBody.activityId, accentColor: "#FF9F0A" },
          attributes: {
            tokenRegistrationURL: "http://localhost:5173/api/live-activity/update-token",
          },
        },
      });

      const updateToken = "bb".repeat(32);
      const startCall = apnsCalls.at(-1);
      if (!startCall) throw new Error("Expected a Live Activity start call");
      const attributes = (
        startCall.input as {
          attributes: { deliveryId: string; tokenRegistrationToken: string };
        }
      ).attributes;
      const wrongRegistrationToken = `${attributes.tokenRegistrationToken.slice(0, -1)}${
        attributes.tokenRegistrationToken.endsWith("A") ? "B" : "A"
      }`;
      authState.userId = null;
      const invalidRegistration = await app.request("/api/live-activity/update-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliveryId: attributes.deliveryId,
          registrationToken: wrongRegistrationToken,
          nativeActivityId: "native-background",
          updateToken,
        }),
      });
      expect(invalidRegistration.status).toBe(404);
      expect(
        (
          await app.request("/api/live-activity/update-token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              deliveryId: attributes.deliveryId,
              registrationToken: attributes.tokenRegistrationToken,
              nativeActivityId: "native-background",
              updateToken,
            }),
          })
        ).status,
      ).toBe(200);

      vi.setSystemTime(new Date("2026-07-25T13:00:00.000Z"));
      const updated = await activityRequest(
        TOKEN,
        `/${startBody.activityId}`,
        "PATCH",
        { status: "Testing", progress: 0.5, accentColor: "#64D2FF", ifSequence: 0 },
        "deploy-update-1",
      );
      expect(await updated.json()).toMatchObject({
        ok: true,
        activityId: startBody.activityId,
        sequence: 1,
        state: { status: "Testing", progress: 0.5, accentColor: "#64D2FF" },
        staleAt: "2026-07-25T17:00:00.000Z",
      });
      expect(apnsCalls.at(-1)).toMatchObject({
        token: updateToken,
        priority: 10,
        input: { event: "update", staleDate: 1_784_998_800 },
      });

      const read = await activityRequest(TOKEN, `/${startBody.activityId}`, "GET");
      expect(await read.json()).toMatchObject({
        ok: true,
        activityId: startBody.activityId,
        sequence: 1,
      });

      const ended = await activityRequest(TOKEN, `/${startBody.activityId}/end`, "POST", {
        status: "Deployed",
        progress: 1,
        symbol: "success",
        accentColor: "#5ED8B7",
        dismissAfterSeconds: 30,
        ifSequence: 1,
      });
      expect(await ended.json()).toMatchObject({
        ok: true,
        activityId: startBody.activityId,
        sequence: 2,
        status: "ended",
        state: { status: "Deployed", progress: 1, accentColor: "#5ED8B7" },
      });
      expect(apnsCalls.at(-1)).toMatchObject({
        priority: 10,
        input: { event: "end", dismissalDate: 1_784_984_430 },
      });
      expect(
        (
          await app.request("/api/live-activity/update-token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              deliveryId: attributes.deliveryId,
              registrationToken: attributes.tokenRegistrationToken,
              nativeActivityId: "native-background",
              updateToken: "cc".repeat(32),
            }),
          })
        ).status,
      ).toBe(404);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is idempotent and enforces one active activity per device", async () => {
    const first = await start(TOKEN, "deploy-start");
    const firstBody = (await first.json()) as { activityId: string };
    const replay = await start(TOKEN, "deploy-start");
    expect(await replay.json()).toMatchObject({
      ok: true,
      activityId: firstBody.activityId,
      idempotent: true,
    });
    expect(apnsCalls).toHaveLength(1);

    const conflict = await start();
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      ok: false,
      code: "ACTIVE_ACTIVITY_CONFLICT",
      activityId: firstBody.activityId,
    });
  });

  it("requires Pro to start a Live Activity", async () => {
    billingState.pro = false;
    const response = await start();
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "Live Activities require Hark Pro",
    });
    expect(apnsCalls).toHaveLength(0);
  });

  it("keeps webhook services isolated", async () => {
    expect((await start("whk_unknown")).status).toBe(404);
    const created = await start();
    const body = (await created.json()) as { activityId: string };
    expect((await activityRequest(OTHER_TOKEN, `/${body.activityId}`, "GET")).status).toBe(404);
    expect(
      (
        await activityRequest(OTHER_TOKEN, `/${body.activityId}`, "PATCH", {
          status: "Hijacked",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await activityRequest(OTHER_TOKEN, `/${body.activityId}/end`, "POST", {
          status: "Hijacked",
        })
      ).status,
    ).toBe(404);
  });
});
