import { createHash } from "node:crypto";
import { type WebhookResponse, webhookRequestSchema } from "@hark/contracts";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
  device,
  event,
  interaction,
  liveActivity,
  liveActivityOperation,
  service as serviceTable,
  user as userTable,
} from "../db/schema";
import { checkNotificationAllowance, getBilling, trackNotification } from "../lib/billing";
import { newId } from "../lib/id";
import { buildPushMessages, resolveNotification, sendPushMessages } from "../lib/push";
import { hashWebhookToken } from "../lib/token";

type EventRow = typeof event.$inferSelect;

function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function replayResponse(row: EventRow): {
  body: WebhookResponse;
  status: 200 | 202 | 502;
} {
  if (row.status === "processing") {
    return {
      body: {
        ok: true,
        eventId: row.id,
        delivered: row.deliveredCount,
        idempotent: true,
        message: "The original request is still processing.",
      },
      status: 202,
    };
  }
  if (row.status === "failed") {
    return {
      body: {
        ok: false,
        error: row.error ?? "Push delivery failed",
      },
      status: 502,
    };
  }
  return {
    body: {
      ok: true,
      eventId: row.id,
      delivered: row.deliveredCount,
      idempotent: true,
      ...(row.status === "no_devices"
        ? { message: "No active iOS devices are registered for this account." }
        : {}),
    },
    status: 200,
  };
}

export const hooksRoute = new Hono().post("/:token", async (c) => {
  const token = c.req.param("token");
  const [match] = await db
    .select({ service: serviceTable, owner: userTable })
    .from(serviceTable)
    .innerJoin(userTable, eq(serviceTable.userId, userTable.id))
    .where(eq(serviceTable.tokenHash, hashWebhookToken(token)))
    .limit(1);
  if (!match) {
    return c.json<WebhookResponse>({ ok: false, error: "Unknown webhook" }, 404);
  }
  const svc = match.service;
  const owner = match.owner;

  const json = await c.req.json().catch(() => null);
  const parsed = webhookRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json<WebhookResponse>(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      400,
    );
  }

  const rawIdempotencyKey = c.req.header("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey?.trim() || undefined;
  if (rawIdempotencyKey !== undefined && (!idempotencyKey || idempotencyKey.length > 200)) {
    return c.json<WebhookResponse>(
      { ok: false, error: "Idempotency-Key must contain between 1 and 200 characters" },
      400,
    );
  }

  const requestHash = hashRequest(parsed.data);
  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(event)
      .where(and(eq(event.serviceId, svc.id), eq(event.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return c.json<WebhookResponse>(
          { ok: false, error: "Idempotency-Key was already used with a different payload" },
          409,
        );
      }
      const replay = replayResponse(existing);
      return c.json(replay.body, replay.status);
    }
  }

  const billing = await getBilling(owner, true);
  if (parsed.data.deviceIds && !billing.features.deviceRouting) {
    return c.json<WebhookResponse>({ ok: false, error: "Device routing requires Hark Pro" }, 402);
  }

  let targetedDevices: (typeof device.$inferSelect)[] | undefined;
  if (parsed.data.deviceIds) {
    const selected = await db
      .select()
      .from(device)
      .where(and(eq(device.userId, svc.userId), inArray(device.id, parsed.data.deviceIds)));
    if (selected.length !== parsed.data.deviceIds.length) {
      return c.json<WebhookResponse>({ ok: false, error: "Invalid device selection" }, 400);
    }
    targetedDevices = selected.filter(
      (registeredDevice) => registeredDevice.active && registeredDevice.platform === "ios",
    );
  }

  const since = new Date(Date.now() - 60_000);
  const [[serviceUsage], [accountEventUsage], [accountInteractionUsage], [accountActivityUsage]] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(event)
        .where(and(eq(event.serviceId, svc.id), gte(event.createdAt, since))),
      db
        .select({ value: count() })
        .from(event)
        .innerJoin(serviceTable, eq(event.serviceId, serviceTable.id))
        .where(and(eq(serviceTable.userId, svc.userId), gte(event.createdAt, since))),
      db
        .select({ value: count() })
        .from(interaction)
        .where(and(eq(interaction.userId, svc.userId), gte(interaction.createdAt, since))),
      db
        .select({ value: count() })
        .from(liveActivityOperation)
        .innerJoin(liveActivity, eq(liveActivity.id, liveActivityOperation.activityId))
        .where(
          and(eq(liveActivity.userId, svc.userId), gte(liveActivityOperation.createdAt, since)),
        ),
    ]);

  if ((serviceUsage?.value ?? 0) >= billing.limits.servicePerMinute) {
    c.header("Retry-After", "60");
    return c.json<WebhookResponse>(
      { ok: false, error: "Service rate limit exceeded", retryAfterSeconds: 60 },
      429,
    );
  }
  if (
    (accountEventUsage?.value ?? 0) +
      (accountInteractionUsage?.value ?? 0) +
      (accountActivityUsage?.value ?? 0) >=
    billing.limits.accountPerMinute
  ) {
    c.header("Retry-After", "60");
    return c.json<WebhookResponse>(
      { ok: false, error: "Account rate limit exceeded", retryAfterSeconds: 60 },
      429,
    );
  }

  if (!(await checkNotificationAllowance(svc.userId))) {
    return c.json<WebhookResponse>({ ok: false, error: "Monthly notification limit reached" }, 429);
  }

  const resolved = resolveNotification(svc, parsed.data);
  const eventId = newId("evt");
  const eventValues: typeof event.$inferInsert = {
    id: eventId,
    serviceId: svc.id,
    title: resolved.title,
    body: resolved.body,
    imageUrl: resolved.imageUrl ?? null,
    url: resolved.url ?? null,
    status: "processing",
    deliveredCount: 0,
    error: null,
    idempotencyKey: idempotencyKey ?? null,
    requestHash: idempotencyKey ? requestHash : null,
    createdAt: new Date(),
  };

  try {
    await db.insert(event).values(eventValues);
  } catch (error) {
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(event)
        .where(and(eq(event.serviceId, svc.id), eq(event.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (existing?.requestHash === requestHash) {
        const replay = replayResponse(existing);
        return c.json(replay.body, replay.status);
      }
    }
    throw error;
  }

  let devices: (typeof device.$inferSelect)[];
  if (targetedDevices) {
    devices = targetedDevices;
  } else {
    const activeDevices = await db
      .select()
      .from(device)
      .where(
        and(eq(device.userId, svc.userId), eq(device.active, true), eq(device.platform, "ios")),
      )
      .orderBy(desc(device.lastSeenAt));
    devices =
      billing.limits.devices === null
        ? activeDevices
        : activeDevices.slice(0, billing.limits.devices);
  }

  if (devices.length === 0) {
    await db.update(event).set({ status: "no_devices" }).where(eq(event.id, eventId));
    return c.json<WebhookResponse>({
      ok: true,
      eventId,
      delivered: 0,
      message: "No active iOS devices are registered for this account.",
    });
  }

  const messages = buildPushMessages({
    to: devices.map((registeredDevice) => registeredDevice.expoPushToken),
    eventId,
    serviceId: svc.id,
    resolved,
  });
  const result = await sendPushMessages(messages);

  if (result.staleTokens.length > 0) {
    await db
      .update(device)
      .set({ active: false })
      .where(inArray(device.expoPushToken, result.staleTokens));
  }

  const status =
    result.accepted === messages.length ? "accepted" : result.accepted > 0 ? "partial" : "failed";
  const pushError = result.errors.length > 0 ? result.errors.join("; ").slice(0, 1000) : null;

  await db
    .update(event)
    .set({ status, deliveredCount: result.accepted, error: pushError })
    .where(eq(event.id, eventId));

  if (result.accepted === 0) {
    return c.json<WebhookResponse>(
      { ok: false, error: "Push delivery failed", issues: result.errors },
      502,
    );
  }

  await trackNotification(svc.userId, eventId);

  return c.json<WebhookResponse>({ ok: true, eventId, delivered: result.accepted });
});
