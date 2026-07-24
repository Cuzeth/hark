import { describe, expect, it } from "vitest";
import {
  deviceRegisterSchema,
  pushDataSchema,
  serviceCreateSchema,
  webhookRequestSchema,
} from "./index";

describe("webhookRequestSchema", () => {
  it("accepts a minimal payload", () => {
    const result = webhookRequestSchema.safeParse({ body: "Deploy finished" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing body", () => {
    expect(webhookRequestSchema.safeParse({}).success).toBe(false);
    expect(webhookRequestSchema.safeParse({ body: "" }).success).toBe(false);
    expect(webhookRequestSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(webhookRequestSchema.safeParse({ body: "x", imageUrl: "not-a-url" }).success).toBe(
      false,
    );
    expect(webhookRequestSchema.safeParse({ body: "x", url: "also nope" }).success).toBe(false);
  });

  it("only accepts public HTTPS image URLs", () => {
    expect(
      webhookRequestSchema.safeParse({ body: "x", imageUrl: "http://example.com/a.png" }).success,
    ).toBe(false);
    expect(
      webhookRequestSchema.safeParse({ body: "x", imageUrl: "https://127.0.0.1/a.png" }).success,
    ).toBe(false);
    expect(
      webhookRequestSchema.safeParse({ body: "x", imageUrl: "https://192.168.1.8/a.png" }).success,
    ).toBe(false);
    expect(
      webhookRequestSchema.safeParse({ body: "x", imageUrl: "https://example.com/a.png" }).success,
    ).toBe(true);
  });

  it("accepts full overrides", () => {
    const result = webhookRequestSchema.safeParse({
      body: "3 new sign-ups",
      title: "Acme CRM",
      imageUrl: "https://example.com/logo.png",
      url: "https://example.com/dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes device routing targets for stable idempotency", () => {
    const result = webhookRequestSchema.safeParse({
      body: "Targeted",
      deviceIds: ["dev_b", "dev_a", "dev_b"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deviceIds).toEqual(["dev_a", "dev_b"]);
  });

  it("rejects an empty device routing list", () => {
    expect(webhookRequestSchema.safeParse({ body: "Targeted", deviceIds: [] }).success).toBe(false);
  });
});

describe("serviceCreateSchema", () => {
  it("requires a title", () => {
    expect(serviceCreateSchema.safeParse({}).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ title: "CI Alerts" }).success).toBe(true);
  });

  it("allows nullable optional fields", () => {
    const result = serviceCreateSchema.safeParse({ title: "CI", imageUrl: null, url: null });
    expect(result.success).toBe(true);
  });
});

describe("deviceRegisterSchema", () => {
  it("constrains platform to ios", () => {
    expect(
      deviceRegisterSchema.safeParse({ expoPushToken: "ExponentPushToken[x]", platform: "ios" })
        .success,
    ).toBe(true);
    expect(
      deviceRegisterSchema.safeParse({
        expoPushToken: "ExponentPushToken[x]",
        platform: "android",
      }).success,
    ).toBe(false);
  });
});

describe("pushDataSchema", () => {
  it("round-trips a full payload", () => {
    const result = pushDataSchema.safeParse({
      v: 1,
      eventId: "evt_1",
      serviceId: "svc_1",
      sourceId: "svc_1",
      sourceName: "Acme CRM",
      avatarUrl: "https://example.com/a.png",
      url: "https://example.com",
      conversationId: "hark-svc_1",
    });
    expect(result.success).toBe(true);
  });
});
