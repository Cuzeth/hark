import { describe, expect, it } from "vitest";
import { generateWebhookToken, hashWebhookToken } from "./token";

describe("generateWebhookToken", () => {
  it("uses the whk_ prefix and base64url alphabet", () => {
    const token = generateWebhookToken();
    expect(token).toMatch(/^whk_[A-Za-z0-9_-]{32}$/);
  });

  it("is unique across generations", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateWebhookToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("hashWebhookToken", () => {
  it("is deterministic", () => {
    const token = generateWebhookToken();
    expect(hashWebhookToken(token)).toBe(hashWebhookToken(token));
  });

  it("produces a 64-char hex sha256 digest that differs from the token", () => {
    const token = generateWebhookToken();
    const hash = hashWebhookToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });

  it("differs for different tokens", () => {
    expect(hashWebhookToken("whk_a")).not.toBe(hashWebhookToken("whk_b"));
  });
});
