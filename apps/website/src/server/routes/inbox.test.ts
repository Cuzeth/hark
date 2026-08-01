import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";

const authState = vi.hoisted(() => ({ userId: "user_inbox" as string | null }));

vi.mock("../auth", () => ({
  auth: {
    handler: () => new Response("not used"),
    api: {
      getSession: async () =>
        authState.userId
          ? {
              user: {
                id: authState.userId,
                name: "Inbox User",
                email: "inbox@example.com",
                image: null,
              },
            }
          : null,
    },
  },
}));

let app: typeof import("../app")["app"];
let db: typeof import("../db")["db"];
let schema: typeof import("../db/schema");

beforeAll(async () => {
  ({ app } = await import("../app"));
  ({ db } = await import("../db"));
  schema = await import("../db/schema");
  const { runMigrations } = await import("../db/migrate");
  runMigrations();

  const now = new Date();
  await db.insert(schema.user).values([
    {
      id: "user_inbox",
      name: "Inbox User",
      email: "inbox@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user_foreign",
      name: "Foreign User",
      email: "foreign@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(schema.apiToken).values({
    id: "tok_inbox",
    userId: "user_inbox",
    name: "Release agent",
    tokenHash: "token-hash",
    prefix: "hark_inbox",
    scopes: ["notifications:send"],
    createdAt: now,
  });
  await db.insert(schema.service).values([
    {
      id: "svc_inbox",
      userId: "user_inbox",
      title: "Monitor",
      imageUrl: "https://example.com/monitor.png",
      tokenHash: "service-hash",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "svc_foreign",
      userId: "user_foreign",
      title: "Foreign",
      tokenHash: "foreign-service-hash",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const interactionBase = {
    userId: "user_inbox",
    requesterTokenId: "tok_inbox",
    title: "Production deploy",
    prompt: "Deploy version 2.4.1?",
    kind: "approval",
    choices: ["approve", "deny"],
    actionDigest: "a".repeat(64),
    acceptedCount: 1,
    createdAt: new Date(now.getTime() - 1_000),
  };
  await db.insert(schema.interaction).values([
    {
      ...interactionBase,
      id: "int_pending",
      status: "pending",
      imageUrl: "https://example.com/release.png",
      expiresAt: new Date(now.getTime() + 60_000),
    },
    {
      ...interactionBase,
      id: "int_expired",
      status: "pending",
      expiresAt: new Date(now.getTime() - 1_000),
    },
    {
      ...interactionBase,
      id: "int_answered",
      status: "approved",
      response: "approve",
      respondedAt: new Date(now.getTime() - 500),
      expiresAt: new Date(now.getTime() + 60_000),
    },
  ]);

  await db.insert(schema.event).values([
    ...Array.from({ length: 22 }, (_, index) => ({
      id: `evt_${index}`,
      serviceId: "svc_inbox",
      title: `Notification ${index}`,
      body: "Notification body",
      status: "accepted",
      deliveredCount: 1,
      createdAt: new Date(now.getTime() - 2_000 - index),
    })),
    {
      id: "evt_foreign",
      serviceId: "svc_foreign",
      title: "Foreign notification",
      body: "Must not be returned",
      status: "accepted",
      deliveredCount: 1,
      createdAt: now,
    },
  ]);
  await db.insert(schema.agentNotification).values({
    id: "ntf_inbox",
    userId: "user_inbox",
    requesterTokenId: "tok_inbox",
    title: "Build passed",
    body: "Integration tests passed",
    acceptedCount: 1,
    createdAt: new Date(now.getTime() - 1_500),
  });
  await db.insert(schema.liveActivity).values({
    id: "act_inbox",
    userId: "user_inbox",
    requesterTokenId: "tok_inbox",
    schemaVersion: 1,
    props: {
      schemaVersion: 1,
      activityId: "act_inbox",
      title: "Production deployment",
      status: "Running tests",
      updatedAt: now.toISOString(),
      symbol: "build",
      privacyMode: "standard",
    },
    status: "active",
    sequence: 1,
    expiresAt: new Date(now.getTime() + 60_000),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.liveActivityOperation).values({
    id: "op_inbox",
    activityId: "act_inbox",
    requesterTokenId: "tok_inbox",
    event: "update",
    sequence: 1,
    props: {
      title: "Production deployment",
      status: "Running tests",
    },
    createdAt: new Date(now.getTime() - 750),
  });
});

describe("mobile inbox", () => {
  it("requires a signed-in session", async () => {
    authState.userId = null;
    try {
      expect((await app.request("/api/interactions")).status).toBe(401);
      expect((await app.request("/api/activities")).status).toBe(401);
      expect((await app.request("/api/activity-feed")).status).toBe(401);
    } finally {
      authState.userId = "user_inbox";
    }
  });

  it("lists only the signed-in user's unexpired pending interactions", async () => {
    const response = await app.request("/api/interactions");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      interactions: Array<{ id: string; sourceName: string; sourceImageUrl: string | null }>;
    };
    expect(body.interactions).toEqual([
      expect.objectContaining({
        id: "int_pending",
        sourceName: "Release agent",
        sourceImageUrl: "https://example.com/release.png",
      }),
    ]);
  });

  it("lists active Live Activities with source metadata", async () => {
    const response = await app.request("/api/activities");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      activities: Array<{ id: string; sourceName: string; sourceImageUrl: string | null }>;
    };
    expect(body.activities).toEqual([
      expect.objectContaining({
        id: "act_inbox",
        sourceName: "Release agent",
        sourceImageUrl: null,
      }),
    ]);
  });

  it("merges, filters, paginates, and isolates activity", async () => {
    const first = await app.request("/api/activity-feed");
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      items: Array<{ kind: string; title: string }>;
      page: number;
      pageSize: number;
      total: number;
    };
    expect(firstBody).toMatchObject({ page: 0, pageSize: 20, total: 25 });
    expect(firstBody.items).toHaveLength(20);
    expect(firstBody.items.map((item) => item.kind)).toContain("response");
    expect(firstBody.items.map((item) => item.kind)).toContain("live_activity");
    expect(firstBody.items.some((item) => item.title === "Foreign notification")).toBe(false);

    const second = await app.request("/api/activity-feed?page=1");
    const secondBody = (await second.json()) as { items: unknown[]; total: number };
    expect(secondBody.items).toHaveLength(5);
    expect(secondBody.total).toBe(25);

    const notifications = await app.request("/api/activity-feed?filter=notification");
    const notificationBody = (await notifications.json()) as {
      items: Array<{ kind: string }>;
      total: number;
    };
    expect(notificationBody.total).toBe(23);
    expect(notificationBody.items.every((item) => item.kind === "notification")).toBe(true);
    expect((await app.request("/api/activity-feed?filter=unknown")).status).toBe(400);
  });

  it("supports a custom page size and exposes delivery status on notification rows", async () => {
    const response = await app.request("/api/activity-feed?pageSize=50");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{
        id: string;
        result: string | null;
        status: string | null;
        deliveredCount: number | null;
        error: string | null;
      }>;
      pageSize: number;
      total: number;
    };
    expect(body.pageSize).toBe(50);
    expect(body.items).toHaveLength(25);

    const webhook = body.items.find((item) => item.id === "event:evt_0");
    expect(webhook).toMatchObject({ status: "accepted", deliveredCount: 1, error: null });
    const agent = body.items.find((item) => item.id === "notification:ntf_inbox");
    expect(agent).toMatchObject({ status: "accepted", deliveredCount: 1 });
    const live = body.items.find((item) => item.id === "live_activity:op_inbox");
    expect(live).toMatchObject({ result: "Updated", status: null });
    const answered = body.items.find((item) => item.id === "response:int_answered");
    expect(answered).toMatchObject({ result: "Approved", status: null });

    expect((await app.request("/api/activity-feed?pageSize=0")).status).toBe(400);
    expect((await app.request("/api/activity-feed?pageSize=101")).status).toBe(400);
  });
});

describe("activity feed deletion", () => {
  const remove = (id: string) =>
    app.request(`/api/activity-feed/${encodeURIComponent(id)}`, { method: "DELETE" });

  it("requires a signed-in session", async () => {
    authState.userId = null;
    try {
      expect((await remove("event:evt_0")).status).toBe(401);
    } finally {
      authState.userId = "user_inbox";
    }
  });

  it("rejects foreign, pending, and malformed feed ids", async () => {
    expect((await remove("event:evt_foreign")).status).toBe(404);
    expect((await remove("response:int_pending")).status).toBe(404);
    expect((await remove("unknown:evt_0")).status).toBe(404);
    expect((await remove("event:")).status).toBe(404);
    expect((await remove("evt_0")).status).toBe(404);

    const foreign = await db
      .select({ id: schema.event.id })
      .from(schema.event)
      .where(eq(schema.event.id, "evt_foreign"));
    expect(foreign).toHaveLength(1);
    const pending = await db
      .select({ status: schema.interaction.status })
      .from(schema.interaction)
      .where(eq(schema.interaction.id, "int_pending"));
    expect(pending).toEqual([{ status: "pending" }]);
  });

  it("deletes each feed item kind for its owner", async () => {
    const before = (await (await app.request("/api/activity-feed?pageSize=50")).json()) as {
      total: number;
    };

    for (const id of [
      "event:evt_21",
      "notification:ntf_inbox",
      "response:int_answered",
      "live_activity:op_inbox",
    ]) {
      const response = await remove(id);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect((await remove(id)).status).toBe(404);
    }

    const after = (await (await app.request("/api/activity-feed?pageSize=50")).json()) as {
      items: Array<{ id: string }>;
      total: number;
    };
    expect(after.total).toBe(before.total - 4);
    expect(after.items.map((item) => item.id)).not.toContain("event:evt_21");
  });
});
