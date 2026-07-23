import { PUSH_SCHEMA_VERSION, type PushData, type WebhookRequest } from "@hark/contracts";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { env } from "../env";

export interface ServiceDefaults {
  title: string;
  imageUrl: string | null;
  url: string | null;
}

export interface ResolvedNotification {
  title: string;
  body: string;
  imageUrl?: string;
  url?: string;
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
  };
}

export interface BuildPushInput {
  to: string[];
  eventId: string;
  serviceId: string;
  resolved: ResolvedNotification;
}

export function buildPushMessages(input: BuildPushInput): ExpoPushMessage[] {
  const { to, eventId, serviceId, resolved } = input;
  const data: PushData = {
    v: PUSH_SCHEMA_VERSION,
    eventId,
    serviceId,
    sourceId: serviceId,
    sourceName: resolved.title,
    ...(resolved.imageUrl ? { avatarUrl: resolved.imageUrl } : {}),
    ...(resolved.url ? { url: resolved.url } : {}),
    conversationId: `hark-${serviceId}`,
  };

  return to.map((token) => ({
    to: token,
    title: resolved.title,
    body: resolved.body,
    priority: "high",
    mutableContent: true,
    ...(resolved.imageUrl ? { richContent: { image: resolved.imageUrl } } : {}),
    data,
  }));
}

let expoClient: Expo | undefined;
function getExpo(): Expo {
  if (!expoClient) {
    expoClient = new Expo(env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {});
  }
  return expoClient;
}

export interface SendResult {
  delivered: number;
  errors: string[];
  /** Expo push tokens that Expo reported as no longer registered. */
  staleTokens: string[];
}

export async function sendPushMessages(messages: ExpoPushMessage[]): Promise<SendResult> {
  const expo = getExpo();
  const result: SendResult = { delivered: 0, errors: [], staleTokens: [] };

  for (const chunk of expo.chunkPushNotifications(messages)) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Expo push request failed");
      continue;
    }
    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        result.delivered += 1;
        return;
      }
      result.errors.push(ticket.message ?? "Unknown push error");
      const to = chunk[index]?.to;
      if (ticket.details?.error === "DeviceNotRegistered" && typeof to === "string") {
        result.staleTokens.push(to);
      }
    });
  }

  return result;
}
