import { generateKeyPairSync, verify } from "node:crypto";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  connect: vi.fn(),
  env: {
    APNS_KEY_ID: "KEY123",
    APPLE_TEAM_ID: "TEAM123",
    APNS_PRIVATE_KEY: "",
    APNS_BUNDLE_ID: "dev.abdeen.hark",
    APNS_ENVIRONMENT: "sandbox" as const,
  },
}));

vi.mock("node:http2", () => ({ connect: transport.connect }));
vi.mock("../env", () => ({ env: transport.env }));

import {
  alertHeaders,
  apnsHost,
  buildLiveActivityPayload,
  createApnsProviderJwt,
  encodeAlertPayload,
  encodeLiveActivityPayload,
  isInvalidApnsTokenReason,
  liveActivityHeaders,
  normalizeApnsPrivateKey,
  sendAlertPush,
  sendLiveActivityPush,
} from "./apns";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
transport.env.APNS_PRIVATE_KEY = pem;
const props = {
  schemaVersion: 1 as const,
  activityId: "act_1",
  title: "Release",
  status: "Building",
  progress: 0.5,
  updatedAt: "2026-07-23T12:00:00.000Z",
  symbol: "build" as const,
  privacyMode: "standard" as const,
};

/** Stands in for one `node:http2` session and its single request stream. */
function mockHttp2() {
  const request = new EventEmitter() as EventEmitter & {
    close: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  request.close = vi.fn();
  request.end = vi.fn();
  const client = new EventEmitter() as EventEmitter & {
    close: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    setTimeout: ReturnType<typeof vi.fn>;
  };
  let onTimeout: (() => void) | undefined;
  client.close = vi.fn();
  client.destroy = vi.fn();
  client.request = vi.fn(() => request);
  client.setTimeout = vi.fn((_milliseconds: number, callback: () => void) => {
    onTimeout = callback;
    return client;
  });
  transport.connect.mockReturnValue(client);
  return { client, request, timeout: () => onTimeout };
}

/** Replays an APNs response onto a mocked request stream. */
function respond(
  request: EventEmitter,
  status: number,
  body?: Record<string, unknown>,
  apnsId = "apns-id",
) {
  request.emit("response", { ":status": status, "apns-id": apnsId });
  if (body) request.emit("data", Buffer.from(JSON.stringify(body)));
  request.emit("end");
}

describe("APNs provider authentication", () => {
  it("creates a verifiable ES256 JWT with a 64-byte JOSE signature", () => {
    const jwt = createApnsProviderJwt(
      { keyId: "KEY123", teamId: "TEAM123", privateKey: pem },
      1234,
    );
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header ?? "", "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY123",
    });
    expect(JSON.parse(Buffer.from(claims ?? "", "base64url").toString())).toEqual({
      iss: "TEAM123",
      iat: 1234,
    });
    expect(Buffer.from(signature ?? "", "base64url")).toHaveLength(64);
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${claims}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature ?? "", "base64url"),
      ),
    ).toBe(true);
    expect(normalizeApnsPrivateKey(Buffer.from(pem).toString("base64"))).toBe(pem.trim());
  });

  it("selects the correct host, topic, push type, and priority", () => {
    expect(apnsHost("sandbox")).toBe("https://api.sandbox.push.apple.com");
    expect(apnsHost("production")).toBe("https://api.push.apple.com");
    expect(liveActivityHeaders({ bundleId: "dev.abdeen.hark" }, "abc", "jwt", 5)).toMatchObject({
      ":path": "/3/device/abc",
      "apns-push-type": "liveactivity",
      "apns-topic": "dev.abdeen.hark.push-type.liveactivity",
      "apns-priority": "5",
    });
  });

  it("addresses alerts to the bare bundle id", () => {
    expect(alertHeaders({ bundleId: "dev.abdeen.hark" }, "abc", "jwt")).toEqual({
      ":method": "POST",
      ":path": "/3/device/abc",
      authorization: "bearer jwt",
      "apns-push-type": "alert",
      "apns-topic": "dev.abdeen.hark",
      "apns-priority": "10",
      "apns-expiration": "0",
    });
  });
});

describe("Live Activity APNs payloads", () => {
  it("builds the expo-widgets start content state exactly", () => {
    const payload = buildLiveActivityPayload({
      event: "start",
      props,
      timestamp: 100,
      staleDate: 200,
    });
    expect(payload).toEqual({
      aps: {
        timestamp: 100,
        event: "start",
        "content-state": { name: "HarkAgentActivity", props: JSON.stringify(props) },
        "attributes-type": "LiveActivityAttributes",
        attributes: {},
        alert: { title: "Release", body: "Building" },
        "input-push-token": 1,
        "stale-date": 200,
      },
    });
  });

  it("includes background token registration attributes on remote starts", () => {
    const attributes = {
      tokenRegistrationURL: "https://hark.example/api/live-activity/update-token",
      tokenRegistrationToken: "x".repeat(43),
      deliveryId: "lad_1",
    };
    expect(
      buildLiveActivityPayload({ event: "start", props, timestamp: 100, attributes }),
    ).toMatchObject({ aps: { event: "start", attributes } });
  });

  it("adds dismissal only to terminal payloads and enforces APNs size", () => {
    const end = buildLiveActivityPayload({
      event: "end",
      props,
      timestamp: 100,
      dismissalDate: 120,
    });
    expect(end).toMatchObject({ aps: { event: "end", "dismissal-date": 120 } });
    expect(() =>
      encodeLiveActivityPayload({
        event: "update",
        props: { ...props, detail: "x".repeat(5000) },
        timestamp: 100,
      }),
    ).toThrow(/4096/);
    expect(isInvalidApnsTokenReason("Unregistered")).toBe(true);
    expect(isInvalidApnsTokenReason("TooManyRequests")).toBe(false);
  });

  it("closes the request and destroys the HTTP/2 client on timeout", async () => {
    const { client, request, timeout } = mockHttp2();

    const pending = sendLiveActivityPush(
      "aa".repeat(32),
      "sandbox",
      {
        event: "update",
        props,
        timestamp: 100,
      },
      5,
    );
    timeout()?.();

    await expect(pending).resolves.toMatchObject({ accepted: false, reason: "Timeout" });
    expect(request.close).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
    expect(client.destroy).toHaveBeenCalledOnce();
  });
});

describe("alert APNs delivery", () => {
  const token = "aa".repeat(32);
  const payload = { aps: { alert: { title: "CI", body: "Build failed" } } };

  it("posts the alert to the device with alert headers", async () => {
    const { client, request } = mockHttp2();

    const pending = sendAlertPush(token, payload);
    respond(request, 200);

    await expect(pending).resolves.toEqual({
      status: 200,
      apnsId: "apns-id",
      reason: null,
      accepted: true,
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        ":path": `/3/device/${token}`,
        "apns-push-type": "alert",
        "apns-topic": "dev.abdeen.hark",
        "apns-priority": "10",
      }),
    );
    expect(request.end).toHaveBeenCalledWith(Buffer.from(JSON.stringify(payload)));
  });

  it("surfaces the rejection reason for gone and failed tokens", async () => {
    const gone = mockHttp2();
    const pendingGone = sendAlertPush(token, payload);
    respond(gone.request, 410, { reason: "Unregistered" });
    await expect(pendingGone).resolves.toMatchObject({
      status: 410,
      reason: "Unregistered",
      accepted: false,
    });

    const failed = mockHttp2();
    const pendingFailed = sendAlertPush(token, payload);
    respond(failed.request, 500, { reason: "InternalServerError" });
    await expect(pendingFailed).resolves.toMatchObject({
      status: 500,
      reason: "InternalServerError",
      accepted: false,
    });
  });

  it("refuses payloads above the APNs size limit", () => {
    expect(() => encodeAlertPayload({ ...payload, blob: "x".repeat(5000) })).toThrow(/4096/);
  });
});
