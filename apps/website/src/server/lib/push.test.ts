import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../env";

const apns = vi.hoisted(() => ({
  sent: [] as string[],
  results: new Map<string, { status: number; reason: string | null; accepted: boolean }>(),
}));

vi.mock("./apns", () => ({
  sendAlertPush: async (token: string) => {
    apns.sent.push(token);
    return {
      apnsId: null,
      ...(apns.results.get(token) ?? { status: 200, reason: null, accepted: true }),
    };
  },
}));

import {
  buildAlertPayload,
  buildInteractionPushMessages,
  buildPushMessages,
  buildWelcomePushMessages,
  resolveNotification,
  sendPushMessages,
} from "./push";

const service = {
  title: "Acme CRM",
  imageUrl: "https://example.com/default.png",
  url: "https://example.com/app",
};

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

describe("buildWelcomePushMessages", () => {
  it("builds the two-message onboarding sequence", () => {
    const messages = buildWelcomePushMessages(TOKEN_A);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: TOKEN_A,
      title: "Hark",
      body: "Welcome to Hark — this iPhone is registered.",
      conversationId: "hark-welcome",
      data: {
        v: 1,
        sourceId: "hark",
        sourceName: "Hark",
        avatarUrl: `${env.APP_URL}/favicon.png`,
        url: env.APP_URL,
        conversationId: "hark-welcome",
      },
    });
    expect(messages[1]).toMatchObject({
      body: "Create a service in the dashboard and point any webhook at it.",
      data: { url: `${env.APP_URL}/dashboard` },
    });
  });
});

describe("resolveNotification", () => {
  it("falls back to service defaults", () => {
    const resolved = resolveNotification(service, { body: "New sign-up" });
    expect(resolved).toEqual({
      title: "Acme CRM",
      body: "New sign-up",
      imageUrl: "https://example.com/default.png",
      url: "https://example.com/app",
    });
  });

  it("prefers webhook overrides", () => {
    const resolved = resolveNotification(service, {
      body: "Build failed",
      title: "CI",
      imageUrl: "https://example.com/ci.png",
      url: "https://example.com/build/1",
    });
    expect(resolved).toEqual({
      title: "CI",
      body: "Build failed",
      imageUrl: "https://example.com/ci.png",
      url: "https://example.com/build/1",
    });
  });

  it("omits image and url when neither side provides them", () => {
    const resolved = resolveNotification(
      { title: "Bare", imageUrl: null, url: null },
      { body: "hello" },
    );
    expect(resolved.imageUrl).toBeUndefined();
    expect(resolved.url).toBeUndefined();
  });
});

describe("buildInteractionPushMessages", () => {
  it("preserves fixed actionable categories and interaction metadata", () => {
    const [approval] = buildInteractionPushMessages({
      to: [TOKEN_A],
      interactionId: "int_1",
      kind: "approval",
      title: "Release",
      prompt: "Deploy production?",
      actionDigest: "a".repeat(64),
    });
    expect(approval).toMatchObject({
      categoryId: "HARK_APPROVAL_V1",
      conversationId: "hark-interaction-int_1",
      title: "Release",
      body: "Deploy production?",
      data: {
        interactionId: "int_1",
        interactionKind: "approval",
        categoryId: "HARK_APPROVAL_V1",
        actionDigest: "a".repeat(64),
      },
    });

    const [reply] = buildInteractionPushMessages({
      to: [TOKEN_A],
      interactionId: "int_2",
      kind: "reply",
      title: "Release",
      prompt: "Release note?",
      actionDigest: "b".repeat(64),
    });
    expect(reply?.categoryId).toBe("HARK_REPLY_V1");
  });
});

describe("buildPushMessages", () => {
  const resolved = {
    title: "Acme CRM",
    body: "New sign-up",
    imageUrl: "https://example.com/a.png",
    url: "https://example.com/app",
  };

  it("builds one message per device with communication-notification fields", () => {
    const messages = buildPushMessages({
      to: [TOKEN_A, TOKEN_B],
      eventId: "evt_1",
      serviceId: "svc_1",
      resolved,
    });

    expect(messages).toHaveLength(2);
    const [first] = messages;
    expect(first).toMatchObject({
      to: TOKEN_A,
      title: "Acme CRM",
      body: "New sign-up",
      conversationId: "hark-svc_1",
      data: {
        v: 1,
        eventId: "evt_1",
        serviceId: "svc_1",
        sourceId: "svc_1",
        sourceName: "Acme CRM",
        avatarUrl: "https://example.com/a.png",
        url: "https://example.com/app",
        conversationId: "hark-svc_1",
      },
    });
  });

  it("never leaks user identifiers or tokens in data", () => {
    const [message] = buildPushMessages({
      to: [TOKEN_A],
      eventId: "evt_1",
      serviceId: "svc_1",
      resolved,
    });
    const serialized = JSON.stringify(message?.data);
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("whk_");
  });

  it("omits avatarUrl without an image", () => {
    const [message] = buildPushMessages({
      to: [TOKEN_A],
      eventId: "evt_1",
      serviceId: "svc_1",
      resolved: { title: "T", body: "B" },
    });
    const data = (message?.data ?? {}) as Record<string, unknown>;
    expect(data.avatarUrl).toBeUndefined();
  });
});

describe("buildAlertPayload", () => {
  it("emits the exact APNs alert envelope, with data in both slots", () => {
    const [message] = buildPushMessages({
      to: [TOKEN_A],
      eventId: "evt_1",
      serviceId: "svc_1",
      resolved: {
        title: "Acme CRM",
        body: "New sign-up",
        imageUrl: "https://example.com/a.png",
        url: "https://example.com/app",
      },
    });
    if (!message) throw new Error("expected a message");

    const data = {
      v: 1,
      eventId: "evt_1",
      serviceId: "svc_1",
      sourceId: "svc_1",
      sourceName: "Acme CRM",
      avatarUrl: "https://example.com/a.png",
      url: "https://example.com/app",
      conversationId: "hark-svc_1",
    };
    expect(buildAlertPayload(message)).toEqual({
      aps: {
        alert: { title: "Acme CRM", body: "New sign-up" },
        sound: "default",
        "mutable-content": 1,
        "thread-id": "hark-svc_1",
      },
      // The notification-service extension reads `body`; expo-notifications
      // surfaces the top-level keys. Both carry the same object.
      body: data,
      ...data,
    });
  });

  it("carries the actionable category on interaction alerts", () => {
    const [message] = buildInteractionPushMessages({
      to: [TOKEN_A],
      interactionId: "int_1",
      kind: "approval",
      title: "Release",
      prompt: "Deploy production?",
      actionDigest: "a".repeat(64),
    });
    if (!message) throw new Error("expected a message");

    const payload = buildAlertPayload(message);
    expect(payload.aps).toEqual({
      alert: { title: "Release", body: "Deploy production?" },
      sound: "default",
      "mutable-content": 1,
      category: "HARK_APPROVAL_V1",
      "thread-id": "hark-interaction-int_1",
    });
    expect(payload.body).toEqual(message.data);
    expect(payload.interactionId).toBe("int_1");
  });

  it("omits category and thread-id when the message carries neither", () => {
    expect(
      buildAlertPayload({
        to: TOKEN_A,
        title: "T",
        body: "B",
        data: {
          v: 1,
          eventId: "evt_1",
          serviceId: "svc_1",
          sourceId: "svc_1",
          sourceName: "Acme CRM",
          conversationId: "hark-svc_1",
        },
      }).aps,
    ).toEqual({
      alert: { title: "T", body: "B" },
      sound: "default",
      "mutable-content": 1,
    });
  });
});

describe("sendPushMessages", () => {
  beforeEach(() => {
    apns.sent.length = 0;
    apns.results.clear();
  });

  it("counts accepted pushes and separates gone tokens from other failures", async () => {
    apns.results.set(TOKEN_B, { status: 410, reason: "Unregistered", accepted: false });
    const gone = "d".repeat(64);
    apns.results.set(gone, { status: 400, reason: "BadDeviceToken", accepted: false });
    const throttled = "e".repeat(64);
    apns.results.set(throttled, { status: 429, reason: "TooManyRequests", accepted: false });

    const result = await sendPushMessages(
      buildPushMessages({
        to: [TOKEN_A, TOKEN_B, gone, throttled],
        eventId: "evt_1",
        serviceId: "svc_1",
        resolved: { title: "T", body: "B" },
      }),
    );

    expect(apns.sent).toHaveLength(4);
    expect(result.accepted).toBe(1);
    expect(result.staleTokens.sort()).toEqual([TOKEN_B, gone].sort());
    expect(result.errors).toContain("APNs 429 TooManyRequests");
    expect(result.errors).toHaveLength(3);
  });

  it("fails soft when the APNs provider is not configured", async () => {
    apns.results.set(TOKEN_A, { status: 0, reason: "ProviderNotConfigured", accepted: false });

    const result = await sendPushMessages(buildWelcomePushMessages(TOKEN_A));

    expect(result.accepted).toBe(0);
    expect(result.staleTokens).toEqual([]);
    expect(result.errors).toEqual([
      "APNs request failed: ProviderNotConfigured",
      "APNs request failed: ProviderNotConfigured",
    ]);
  });
});
