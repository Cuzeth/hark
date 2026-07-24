import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";

const authState = vi.hoisted(() => ({ userId: "user_device_auth" as string | null }));

vi.mock("../auth", () => ({
  auth: {
    handler: () => new Response("not used"),
    api: {
      getSession: async () =>
        authState.userId
          ? {
              user: {
                id: authState.userId,
                name: "Device Auth User",
                email: "device-auth@example.com",
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
let hashApiToken: typeof import("../lib/token")["hashApiToken"];
let hashDeviceCode: typeof import("../lib/token")["hashDeviceCode"];

beforeAll(async () => {
  ({ app } = await import("../app"));
  ({ db } = await import("../db"));
  schema = await import("../db/schema");
  ({ hashApiToken, hashDeviceCode } = await import("../lib/token"));
  const { runMigrations } = await import("../db/migrate");
  runMigrations();
  const now = new Date();
  await db.insert(schema.user).values({
    id: "user_device_auth",
    name: "Device Auth User",
    email: "device-auth@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
});

async function start(clientName = "Test CLI") {
  const response = await app.request("/api/device-authorization/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientName,
      scopes: ["services:read", "interactions:read"],
      expiresInSeconds: 3600,
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    deviceCode: string;
    userCode: string;
    interval: number;
    verificationUri: string;
  };
}

async function poll(deviceCode: string) {
  return app.request("/api/device-authorization/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceCode }),
  });
}

async function allowNextPoll(deviceCode: string) {
  const { eq } = await import("drizzle-orm");
  await db
    .update(schema.deviceAuthorizationRequest)
    .set({ lastPollAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.deviceAuthorizationRequest.deviceCodeHash, hashDeviceCode(deviceCode)));
}

describe("device authorization", () => {
  it("requires a human approval and returns the API secret exactly once", async () => {
    const started = await start("Local Agent");
    expect(started.deviceCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.userCode).toMatch(/^[23456789A-Z]{4}-[23456789A-Z]{4}$/);

    const pending = await poll(started.deviceCode);
    expect(pending.status).toBe(400);
    expect(await pending.json()).toMatchObject({ error: "authorization_pending" });

    const inspected = await app.request(
      `/api/device-authorization/requests/${started.userCode.toLowerCase().replace("-", "")}`,
    );
    expect(await inspected.json()).toMatchObject({
      request: {
        clientName: "Local Agent",
        scopes: ["interactions:read", "services:read"],
        status: "pending",
        userCode: started.userCode,
      },
    });

    const approved = await app.request(
      `/api/device-authorization/requests/${started.userCode}/approve`,
      { method: "POST" },
    );
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ request: { status: "approved" } });

    await allowNextPoll(started.deviceCode);
    const issued = await poll(started.deviceCode);
    expect(issued.status).toBe(200);
    const body = (await issued.json()) as { accessToken: string; token: { id: string } };
    expect(body.accessToken).toMatch(/^hark_/);

    const { eq } = await import("drizzle-orm");
    const storedRequest = db
      .select()
      .from(schema.deviceAuthorizationRequest)
      .where(
        eq(schema.deviceAuthorizationRequest.deviceCodeHash, hashDeviceCode(started.deviceCode)),
      )
      .get();
    const storedToken = db
      .select()
      .from(schema.apiToken)
      .where(eq(schema.apiToken.id, body.token.id))
      .get();
    expect(storedRequest?.status).toBe("consumed");
    expect(storedToken?.tokenHash).toBe(hashApiToken(body.accessToken));
    expect(JSON.stringify(storedRequest)).not.toContain(started.deviceCode);
    expect(JSON.stringify(storedToken)).not.toContain(body.accessToken);

    await allowNextPoll(started.deviceCode);
    const replay = await poll(started.deviceCode);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_grant" });
  });

  it("enforces poll timing with slow_down", async () => {
    const started = await start("Fast Poller");
    expect((await poll(started.deviceCode)).status).toBe(400);
    const response = await poll(started.deviceCode);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "slow_down", interval: 10 });
  });

  it("purges authorization requests that have been expired for over 24 hours", async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.insert(schema.deviceAuthorizationRequest).values({
      id: "dar_old_expired",
      deviceCodeHash: "old-device-code-hash",
      userCode: "ABCD-EFGH",
      clientName: "Old CLI",
      requestedScopes: ["services:read"],
      status: "expired",
      expiresAt: old,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      pollIntervalSeconds: 5,
      createdAt: old,
      resolvedAt: old,
    });
    await start("Purge Trigger");

    const { eq } = await import("drizzle-orm");
    expect(
      db
        .select({ id: schema.deviceAuthorizationRequest.id })
        .from(schema.deviceAuthorizationRequest)
        .where(eq(schema.deviceAuthorizationRequest.id, "dar_old_expired"))
        .get(),
    ).toBeUndefined();
  });

  it("returns terminal denied and expired states without creating tokens", async () => {
    const denied = await start("Denied CLI");
    expect(
      (
        await app.request(`/api/device-authorization/requests/${denied.userCode}/deny`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);
    const deniedPoll = await poll(denied.deviceCode);
    expect(await deniedPoll.json()).toEqual({ error: "access_denied" });

    const expired = await start("Expired CLI");
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.deviceAuthorizationRequest)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(
        eq(schema.deviceAuthorizationRequest.deviceCodeHash, hashDeviceCode(expired.deviceCode)),
      );
    const expiredPoll = await poll(expired.deviceCode);
    expect(await expiredPoll.json()).toEqual({ error: "expired_token" });
  });

  it("requires a signed-in session to inspect or resolve a human code", async () => {
    const started = await start("Session Required");
    authState.userId = null;
    expect(
      (await app.request(`/api/device-authorization/requests/${started.userCode}`)).status,
    ).toBe(401);
    expect(
      (
        await app.request(`/api/device-authorization/requests/${started.userCode}/approve`, {
          method: "POST",
        })
      ).status,
    ).toBe(401);
    authState.userId = "user_device_auth";
  });

  it("enforces the active API token cap at exchange time", async () => {
    const now = new Date();
    await db.insert(schema.user).values({
      id: "user_device_auth_capped",
      name: "Capped User",
      email: "device-auth-capped@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.apiToken).values(
      Array.from({ length: 25 }, (_, index) => ({
        id: `tok_device_auth_cap_${index}`,
        userId: "user_device_auth_capped",
        name: `Cap ${index}`,
        tokenHash: `device_auth_cap_hash_${index}`,
        prefix: `hark_cap_${index}`,
        scopes: ["services:read"],
        createdAt: now,
      })),
    );
    const started = await start("Capped CLI");
    authState.userId = "user_device_auth_capped";
    expect(
      (
        await app.request(`/api/device-authorization/requests/${started.userCode}/approve`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);
    const response = await poll(started.deviceCode);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "token_limit_reached" });
    authState.userId = "user_device_auth";
  });
});
