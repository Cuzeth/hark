import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a webhook token with 192 bits of entropy. The plaintext value is
 * returned to the customer exactly once; only its hash is persisted.
 */
export function generateWebhookToken(): string {
  return `whk_${randomBytes(24).toString("base64url")}`;
}

/** Deterministic SHA-256 digest used as the stored lookup key for a token. */
export function hashWebhookToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
