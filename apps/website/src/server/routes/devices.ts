import { type DeviceDto, deviceRegisterSchema, deviceUnregisterSchema } from "@hark/contracts";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { device } from "../db/schema";
import { getBilling } from "../lib/billing";
import { newId } from "../lib/id";
import { type AuthedEnv, requireAuth } from "../middleware";

function toDto(row: typeof device.$inferSelect): DeviceDto {
  return {
    id: row.id,
    platform: "ios",
    deviceName: row.deviceName,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

export const devicesRoute = new Hono<AuthedEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const user = c.get("user");
    const rows = await db
      .select()
      .from(device)
      .where(eq(device.userId, user.id))
      .orderBy(desc(device.lastSeenAt));
    return c.json({ devices: rows.map(toDto) });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const parsed = deviceRegisterSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Invalid device registration", issues: parsed.error.issues }, 400);
    }
    const [existing, activeDevices, billing] = await Promise.all([
      db
        .select({ id: device.id, userId: device.userId, active: device.active })
        .from(device)
        .where(eq(device.expoPushToken, parsed.data.expoPushToken))
        .limit(1),
      db
        .select({ id: device.id })
        .from(device)
        .where(and(eq(device.userId, user.id), eq(device.active, true))),
      getBilling(user),
    ]);
    const isAlreadyActiveForUser = existing[0]?.userId === user.id && existing[0].active;
    if (
      !isAlreadyActiveForUser &&
      billing.limits.devices !== null &&
      activeDevices.length >= billing.limits.devices
    ) {
      return c.json({ error: "This account has reached its active device limit." }, 402);
    }
    const now = new Date();
    const [row] = await db
      .insert(device)
      .values({
        id: newId("dev"),
        userId: user.id,
        expoPushToken: parsed.data.expoPushToken,
        apnsToken: parsed.data.apnsToken ?? null,
        platform: "ios",
        deviceName: parsed.data.deviceName ?? null,
        active: true,
        createdAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: device.expoPushToken,
        set: {
          userId: user.id,
          apnsToken: parsed.data.apnsToken ?? null,
          deviceName: parsed.data.deviceName ?? null,
          active: true,
          lastSeenAt: now,
        },
      })
      .returning();
    if (!row) {
      return c.json({ error: "Failed to register device" }, 500);
    }
    return c.json({ device: toDto(row) }, 201);
  })
  .delete("/:id", async (c) => {
    const user = c.get("user");
    await db
      .delete(device)
      .where(and(eq(device.userId, user.id), eq(device.id, c.req.param("id"))));
    return c.json({ ok: true });
  })
  .delete("/", async (c) => {
    const user = c.get("user");
    const parsed = deviceUnregisterSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.issues }, 400);
    }
    await db
      .delete(device)
      .where(and(eq(device.userId, user.id), eq(device.expoPushToken, parsed.data.expoPushToken)));
    return c.json({ ok: true });
  });
