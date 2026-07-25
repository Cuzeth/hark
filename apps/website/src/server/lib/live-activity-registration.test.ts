import { describe, expect, it } from "vitest";
import {
  createLiveActivityRegistrationToken,
  verifyLiveActivityRegistrationToken,
} from "./live-activity-registration";

describe("Live Activity background registration tokens", () => {
  it("binds a token to one delivery, activity, and expiry", () => {
    const expiresAt = new Date("2026-07-25T20:00:00.000Z");
    const token = createLiveActivityRegistrationToken("lad_1", "act_1", expiresAt);
    expect(token).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(verifyLiveActivityRegistrationToken(token, "lad_1", "act_1", expiresAt)).toBe(true);
    expect(verifyLiveActivityRegistrationToken(token, "lad_2", "act_1", expiresAt)).toBe(false);
    expect(verifyLiveActivityRegistrationToken(token, "lad_1", "act_2", expiresAt)).toBe(false);
    expect(
      verifyLiveActivityRegistrationToken(
        token,
        "lad_1",
        "act_1",
        new Date(expiresAt.getTime() + 1),
      ),
    ).toBe(false);
  });
});
