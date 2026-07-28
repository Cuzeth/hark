import type { InboxActivityDto, InboxInteractionDto, InboxLiveActivityDto } from "@hark/contracts";

export const PREVIEW_AVATAR_URL =
  "https://pbs.twimg.com/profile_images/2070959207273082880/HZoVBuA2_400x400.jpg";

const now = Date.now();

export const previewPending: InboxInteractionDto[] = [
  {
    id: "preview-deploy",
    sourceName: "Release agent",
    sourceImageUrl: PREVIEW_AVATAR_URL,
    title: "Production deploy",
    prompt: "Deploy version 2.4.1 to production?",
    kind: "approval",
    presentation: "notification",
    status: "pending",
    choices: ["approve", "deny"],
    response: null,
    imageUrl: null,
    url: null,
    actionDigest: "a".repeat(64),
    primaryLabel: null,
    secondaryLabel: null,
    accepted: 1,
    respondingDeviceId: null,
    expiresAt: new Date(now + 13 * 60_000).toISOString(),
    createdAt: new Date(now - 2 * 60_000).toISOString(),
    respondedAt: null,
    canceledAt: null,
  },
  {
    id: "preview-support",
    sourceName: "Support bot",
    sourceImageUrl: PREVIEW_AVATAR_URL,
    title: "Customer reply",
    prompt: "How should I respond to the customer's request for an extension?",
    kind: "reply",
    presentation: "notification",
    status: "pending",
    choices: ["reply"],
    response: null,
    imageUrl: null,
    url: null,
    actionDigest: "b".repeat(64),
    primaryLabel: null,
    secondaryLabel: null,
    accepted: 1,
    respondingDeviceId: null,
    expiresAt: new Date(now + 42 * 60_000).toISOString(),
    createdAt: new Date(now - 18 * 60_000).toISOString(),
    respondedAt: null,
    canceledAt: null,
  },
];

export const previewActive: InboxLiveActivityDto[] = [
  {
    id: "preview-activity",
    sourceName: "Deploy agent",
    sourceImageUrl: PREVIEW_AVATAR_URL,
    key: "production-deploy",
    props: {
      schemaVersion: 1,
      activityId: "preview-activity",
      title: "Production deployment",
      status: "Running",
      detail: "Running integration tests",
      progress: 0.72,
      updatedAt: new Date(now).toISOString(),
      symbol: "build",
      privacyMode: "standard",
    },
    status: "active",
    sequence: 4,
    accepted: 1,
    failed: 0,
    expiresAt: new Date(now + 60 * 60_000).toISOString(),
    createdAt: new Date(now - 20 * 60_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    endedAt: null,
  },
];

const activityTemplates: Array<Pick<InboxActivityDto, "kind" | "sourceName" | "title" | "result">> =
  [
    {
      kind: "response",
      sourceName: "GitHub",
      title: "Merge dependency update",
      result: "Approved",
    },
    {
      kind: "notification",
      sourceName: "Build agent",
      title: "Integration tests passed",
      result: null,
    },
    {
      kind: "live_activity",
      sourceName: "Deploy agent",
      title: "Production deployment",
      result: "Completed",
    },
    {
      kind: "response",
      sourceName: "Support bot",
      title: "Customer response sent",
      result: "Replied",
    },
  ];

export const previewActivity: InboxActivityDto[] = Array.from({ length: 24 }, (_, index) => {
  const template = activityTemplates[index % activityTemplates.length];
  if (!template) throw new Error("Missing preview activity template");
  return {
    ...template,
    id: `preview-feed-${index}`,
    sourceImageUrl: PREVIEW_AVATAR_URL,
    detail: null,
    url: null,
    createdAt: new Date(now - (index + 1) * 15 * 60_000).toISOString(),
  };
});
