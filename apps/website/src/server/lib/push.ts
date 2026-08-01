import {
  HARK_APPROVAL_CATEGORY_ID,
  HARK_REPLY_CATEGORY_ID,
  HARK_YES_NO_CATEGORY_ID,
  type InteractionKind,
  type InteractionPushData,
  type NotificationPriority,
  PUSH_SCHEMA_VERSION,
  type PushData,
  type WebhookRequest,
} from "@hark/contracts";
import { env } from "../env";
import { type ApnsResult, sendAlertPush } from "./apns";

/** One alert push, addressed to a raw APNs device token. */
export interface ApnsAlertMessage {
  to: string;
  title: string;
  body: string;
  categoryId?: string;
  conversationId?: string;
  priority?: NotificationPriority;
  data: PushData | InteractionPushData;
}

export interface ServiceDefaults {
  title: string;
  imageUrl: string | null;
  url: string | null;
  priority: string;
}

export interface ResolvedNotification {
  title: string;
  body: string;
  imageUrl?: string;
  url?: string;
  priority: NotificationPriority;
}

/** Webhook overrides win; otherwise fall back to the service defaults. */
export function resolveNotification(
  service: ServiceDefaults,
  request: WebhookRequest,
): ResolvedNotification {
  return {
    title: request.title ?? service.title,
    body: request.body,
    imageUrl: request.imageUrl ?? service.imageUrl ?? undefined,
    url: request.url ?? service.url ?? undefined,
    // The column is constrained to the enum by the API surface that writes it.
    priority: request.priority ?? (service.priority as NotificationPriority),
  };
}

export interface BuildPushInput {
  to: string[];
  eventId: string;
  serviceId: string;
  /** Overrides the thread grouping; defaults to the service so each service is one conversation. */
  conversationKey?: string;
  resolved: ResolvedNotification;
}

const WELCOME_AVATAR_URL = `${env.APP_URL}/favicon.png`;
const WELCOME_MESSAGES = [
  {
    body: "Welcome to Hark — this iPhone is registered.",
    url: env.APP_URL,
  },
  {
    body: "Create a service in the dashboard and point any webhook at it.",
    url: `${env.APP_URL}/dashboard`,
  },
] as const;

export function buildWelcomePushMessages(to: string): ApnsAlertMessage[] {
  return WELCOME_MESSAGES.map((message, index) => {
    const data: PushData = {
      v: PUSH_SCHEMA_VERSION,
      eventId: `hark-welcome-${index + 1}`,
      serviceId: "hark-welcome",
      sourceId: "hark",
      sourceName: "Hark",
      avatarUrl: WELCOME_AVATAR_URL,
      url: message.url,
      conversationId: "hark-welcome",
    };
    return {
      to,
      title: "Hark",
      body: message.body,
      conversationId: data.conversationId,
      data,
    };
  });
}

export function buildPushMessages(input: BuildPushInput): ApnsAlertMessage[] {
  const { to, eventId, serviceId, conversationKey, resolved } = input;
  const data: PushData = {
    v: PUSH_SCHEMA_VERSION,
    eventId,
    serviceId,
    sourceId: serviceId,
    sourceName: resolved.title,
    ...(resolved.imageUrl ? { avatarUrl: resolved.imageUrl } : {}),
    ...(resolved.url ? { url: resolved.url } : {}),
    conversationId: `hark-${conversationKey ?? serviceId}`,
  };

  return to.map((token) => ({
    to: token,
    title: resolved.title,
    body: resolved.body,
    conversationId: data.conversationId,
    priority: resolved.priority,
    data,
  }));
}

export interface BuildInteractionPushInput {
  to: string[];
  interactionId: string;
  kind: InteractionKind;
  title: string;
  prompt: string;
  actionDigest: string;
  responseToken?: string;
  eventId?: string;
  imageUrl?: string;
  url?: string;
  priority?: NotificationPriority;
}

export function buildInteractionPushMessages(input: BuildInteractionPushInput): ApnsAlertMessage[] {
  const categoryId =
    input.kind === "approval"
      ? HARK_APPROVAL_CATEGORY_ID
      : input.kind === "yes_no"
        ? HARK_YES_NO_CATEGORY_ID
        : HARK_REPLY_CATEGORY_ID;
  const data: InteractionPushData = {
    v: PUSH_SCHEMA_VERSION,
    interactionId: input.interactionId,
    ...(input.eventId ? { eventId: input.eventId } : {}),
    interactionKind: input.kind,
    sourceName: input.title,
    conversationId: `hark-interaction-${input.interactionId}`,
    categoryId,
    actionDigest: input.actionDigest,
    ...(input.responseToken ? { responseToken: input.responseToken } : {}),
    ...(input.imageUrl ? { avatarUrl: input.imageUrl } : {}),
    ...(input.url ? { url: input.url } : {}),
  };
  return input.to.map((to) => ({
    to,
    title: input.title,
    body: input.prompt,
    categoryId,
    conversationId: data.conversationId,
    ...(input.priority ? { priority: input.priority } : {}),
    data,
  }));
}

/**
 * The notification-service extension reads `userInfo["body"]` first and falls
 * back to the top-level keys, and expo-notifications surfaces `body` as the
 * on-device `content.data`. Both slots carry the same object.
 */
export function buildAlertPayload(message: ApnsAlertMessage): Record<string, unknown> {
  const priority = message.priority ?? "normal";
  return {
    aps: {
      alert: { title: message.title, body: message.body },
      // A critical alert only sounds if the app ships the critical alert
      // entitlement and the user has granted it; otherwise iOS drops the level.
      sound: priority === "critical" ? { critical: 1, name: "default", volume: 1.0 } : "default",
      "mutable-content": 1,
      ...(priority === "normal" ? {} : { "interruption-level": priority }),
      ...(message.categoryId ? { category: message.categoryId } : {}),
      ...(message.conversationId ? { "thread-id": message.conversationId } : {}),
    },
    body: message.data,
    ...message.data,
  };
}

/** APNs rejections that mean the token will never work again. */
const STALE_APNS_REASONS = new Set(["Unregistered", "BadDeviceToken", "ExpiredToken"]);

/** Parallel APNs streams. Each message opens its own short-lived connection. */
const PUSH_CONCURRENCY = 10;

export interface SendResult {
  /** Requests APNs accepted. This is not a device-delivery receipt. */
  accepted: number;
  errors: string[];
  /** APNs device tokens Apple reported as no longer registered. */
  staleTokens: string[];
}

function describeApnsFailure(result: ApnsResult): string {
  if (result.status > 0) {
    return result.reason ? `APNs ${result.status} ${result.reason}` : `APNs ${result.status}`;
  }
  return `APNs request failed: ${result.reason ?? "unknown error"}`;
}

export async function sendPushMessages(messages: ApnsAlertMessage[]): Promise<SendResult> {
  const result: SendResult = { accepted: 0, errors: [], staleTokens: [] };
  let cursor = 0;

  const worker = async () => {
    while (cursor < messages.length) {
      const message = messages[cursor++];
      if (!message) return;
      const outcome = await sendAlertPush(message.to, buildAlertPayload(message));
      if (outcome.accepted) {
        result.accepted += 1;
        continue;
      }
      result.errors.push(describeApnsFailure(outcome));
      if (outcome.status === 410 || STALE_APNS_REASONS.has(outcome.reason ?? "")) {
        result.staleTokens.push(message.to);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PUSH_CONCURRENCY, messages.length) }, () => worker()),
  );

  return result;
}
