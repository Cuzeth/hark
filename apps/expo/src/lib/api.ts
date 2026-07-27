import type {
  DeviceDto,
  DeviceRegisterInput,
  DeviceUnregisterInput,
  EventDto,
  InboxActivityKind,
  InboxActivityPageDto,
  InboxInteractionDto,
  InboxLiveActivityDto,
  InteractionCredentialResponseInput,
  InteractionDto,
  InteractionResponseInput,
  LiveActivityPushToStartTokenInput,
  LiveActivityUpdateTokenInput,
} from "@hark/contracts";
import { API_URL, getCookie } from "./auth";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = getCookie();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || body === null) {
    throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
  }
  return body;
}

export const api = {
  listDevices: () => request<{ devices: DeviceDto[] }>("/api/devices"),
  registerDevice: (input: DeviceRegisterInput) =>
    request<{ device: { id: string } }>("/api/devices", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  unregisterDevice: (input: DeviceUnregisterInput) =>
    request<{ ok: true }>("/api/devices", {
      method: "DELETE",
      body: JSON.stringify(input),
    }),
  registerLiveActivityPushToStartToken: (input: LiveActivityPushToStartTokenInput) =>
    request<{ deviceId: string; updatedAt?: string }>("/api/devices/live-activity/push-to-start", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  registerLiveActivityUpdateToken: (input: LiveActivityUpdateTokenInput) =>
    request<{ activityId: string; deviceId: string }>("/api/devices/live-activity/update-token", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listEvents: (limit = 20) => request<{ events: EventDto[] }>(`/api/events?limit=${limit}`),
  listPendingInteractions: () =>
    request<{ interactions: InboxInteractionDto[] }>("/api/interactions"),
  listActiveActivities: () => request<{ activities: InboxLiveActivityDto[] }>("/api/activities"),
  listActivityFeed: (filter: "all" | InboxActivityKind, page: number) =>
    request<InboxActivityPageDto>(`/api/activity-feed?filter=${filter}&page=${page}`),
  respondToInteraction: (id: string, input: InteractionResponseInput) =>
    request<{ interaction: InteractionDto }>(`/api/interactions/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  respondToInteractionWithToken: (id: string, input: InteractionCredentialResponseInput) =>
    request<{ ok: true; status: string }>(`/api/interaction-responses/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
