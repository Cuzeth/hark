import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env";

const ENCRYPTION_VERSION = "v1";

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update("hark:webhook-token:v1\0", "utf8")
    .update(env.BETTER_AUTH_SECRET, "utf8")
    .digest();
}

/**
 * Generates a webhook token with 192 bits of entropy. Its hash is the lookup
 * key; an encrypted copy allows the owner to recover the URL later.
 */
export function generateWebhookToken(): string {
  return `whk_${randomBytes(24).toString("base64url")}`;
}

/** Deterministic SHA-256 digest used as the stored lookup key for a token. */
export function hashWebhookToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Encrypts a token for owner-only recovery while keeping the hash as the lookup key. */
export function encryptWebhookToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypts and authenticates a stored token. Throws if the value was modified. */
export function decryptWebhookToken(value: string): string {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== ENCRYPTION_VERSION || !iv || !tag || !ciphertext || extra) {
    throw new Error("Invalid encrypted webhook token");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
