import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

function registrationToken(deliveryId: string, activityId: string, expiresAt: Date): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update("hark:live-activity-registration:v1\0", "utf8")
    .update(deliveryId, "utf8")
    .update("\0", "utf8")
    .update(activityId, "utf8")
    .update("\0", "utf8")
    .update(String(expiresAt.getTime()), "utf8")
    .digest("base64url");
}

export function createLiveActivityRegistrationToken(
  deliveryId: string,
  activityId: string,
  expiresAt: Date,
): string {
  return registrationToken(deliveryId, activityId, expiresAt);
}

export function verifyLiveActivityRegistrationToken(
  supplied: string,
  deliveryId: string,
  activityId: string,
  expiresAt: Date,
): boolean {
  const expected = registrationToken(deliveryId, activityId, expiresAt);
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
