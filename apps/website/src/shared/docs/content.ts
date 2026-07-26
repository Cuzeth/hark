/**
 * The docs prose, as data.
 *
 * This module is the single source of truth for everything on `/docs`. Two
 * consumers read it and neither owns any prose of its own:
 *
 * - `src/client/pages/docs/blocks.tsx` renders it as React (browser + the
 *   build-time prerender that puts the same HTML in the initial response).
 * - `src/shared/docs/markdown.ts` serialises it for `/docs.md` and `/agents.md`.
 *
 * Inline formatting inside every string is a tiny markdown subset — `` `code` ``
 * and `[text](href)` — parsed by `./inline.ts` for the React renderer and passed
 * through verbatim by the markdown serialiser. Keeping the source markdown-ish
 * means the two outputs cannot drift, and adding a section is a data edit.
 *
 * Headings are *not* stored here: they come from `./nav.ts` by id, so the
 * sidebar, the in-page headings, and the markdown outline always agree.
 */
import type { DocItemId, DocSectionId } from "./nav";

/** Placeholder webhook URL used throughout the docs samples. */
export const EXAMPLE_ENDPOINT = "https://hark.ryan.ceo/hooks/whk_your_token";

export interface DocFieldRow {
  name: string;
  type: string;
  detail: string;
}

export interface DocRouteRow {
  method: string;
  path: string;
  detail: string;
}

export interface DocPlanRow {
  limit: string;
  free: string;
  pro: string;
}

export type DocTableBlock =
  | { kind: "table"; variant: "field"; caption: string; rows: DocFieldRow[] }
  | { kind: "table"; variant: "route"; caption: string; rows: DocRouteRow[] }
  | { kind: "table"; variant: "plan"; caption: string; rows: DocPlanRow[] };

export type DocBlock =
  | { kind: "p"; text: string }
  /** Callout for a caveat that would get lost in a paragraph. */
  | { kind: "note"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "code"; language: "bash" | "json"; code: string }
  /** A copyable single-line value, rendered as a code block in markdown. */
  | { kind: "copy"; label: string; value: string }
  | DocTableBlock;

export interface DocSubsection {
  id: DocItemId;
  /** Marks a capability that requires a paid Hark Pro plan. */
  pro?: true;
  blocks: DocBlock[];
}

export interface DocSection {
  id: DocSectionId;
  pro?: true;
  /** Intro paragraph shown above the first subsection. */
  lead: string;
  subsections: DocSubsection[];
}

/** Page title, reused by the HTML `<h1>`, the prerendered `<title>`, and the markdown. */
export const DOCS_TITLE = "Webhooks to iPhone notifications";
export const DOCS_EYEBROW = "Documentation";
export const DOCS_URL = "https://hark.ryan.ceo/docs";
export const DOCS_MARKDOWN_URL = "https://hark.ryan.ceo/docs.md";

export const DOC_CONTENT: DocSection[] = [
  {
    id: "quickstart",
    lead: "Hark turns an HTTP request into a source-branded iPhone notification. Create a service, then POST JSON to its secret webhook URL.",
    subsections: [
      {
        id: "what-hark-is",
        blocks: [
          {
            kind: "p",
            text: "Anything that can send an HTTP request can notify your phone: CI jobs, coding agents, cron scripts, monitors. Each service carries its own name, avatar, and tap destination, and Hark fills in any field you omit from those service defaults.",
          },
          {
            kind: "p",
            text: "There are two APIs, both authenticated by the same webhook token. The Notification API sends one-shot pushes and optional approval prompts. The Activity API drives a stateful Live Activity on the Lock Screen and in the Dynamic Island.",
          },
        ],
      },
      {
        id: "create-a-service",
        blocks: [
          {
            kind: "steps",
            items: [
              "Sign in at [hark.ryan.ceo](https://hark.ryan.ceo).",
              "Register your iPhone with the Hark app.",
              "Create a service in the dashboard and give it a title, avatar, and tap URL.",
              "Copy the secret webhook URL it returns.",
            ],
          },
        ],
      },
      {
        id: "webhook-url",
        blocks: [
          {
            kind: "p",
            text: "The plaintext token is shown when the service is created and whenever you rotate it. Treat it as a credential: anyone holding it can notify your devices.",
          },
          { kind: "copy", label: "Webhook URL", value: EXAMPLE_ENDPOINT },
          {
            kind: "p",
            text: 'An unknown or rotated token returns `404` with `{ "ok": false, "error": "Unknown webhook" }`.',
          },
        ],
      },
      {
        id: "first-notification",
        blocks: [
          {
            kind: "p",
            text: "Only `body` is required. Everything else falls back to the service defaults.",
          },
          {
            kind: "code",
            language: "bash",
            code: `curl -X POST ${EXAMPLE_ENDPOINT} \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: deploy-184-production' \\
  -d '{
    "body": "Production deployed successfully.",
    "title": "GitHub",
    "imageUrl": "https://github.com/github.png",
    "url": "https://github.com/acme/app/actions"
  }'`,
          },
        ],
      },
      {
        id: "quickstart-response",
        blocks: [
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1
}`,
          },
          {
            kind: "p",
            text: "`eventId` identifies the event in the dashboard activity log and, for interactive notifications, is the handle used to read or cancel the pending response. `delivered` is the number of push requests accepted by Expo.",
          },
          {
            kind: "note",
            text: "A request with no registered device still succeeds with `delivered: 0` and a `message` field, so an unpaired phone never fails your build.",
          },
        ],
      },
    ],
  },
  {
    id: "notification-api",
    lead: "One-shot pushes, delivered to every registered iPhone or to the devices you name. The webhook token in the URL is the only credential.",
    subsections: [
      {
        id: "notification-endpoint",
        blocks: [
          {
            kind: "table",
            variant: "route",
            caption: "Notification API routes",
            rows: [
              { method: "POST", path: "/hooks/:token", detail: "Send a notification." },
              {
                method: "GET",
                path: "/hooks/:token/events/:eventId",
                detail: "Read the state of an interactive response.",
              },
              {
                method: "POST",
                path: "/hooks/:token/events/:eventId/cancel",
                detail: "Withdraw a pending interactive response.",
              },
            ],
          },
          {
            kind: "p",
            text: "Send `Content-Type: application/json`. An unrecognised token returns `404`; a payload that fails validation returns `400` with an `issues` array describing each field.",
          },
        ],
      },
      {
        id: "notification-payload",
        blocks: [
          {
            kind: "table",
            variant: "field",
            caption: "Notification request fields",
            rows: [
              {
                name: "body",
                type: "string, required",
                detail: "Notification message, 1 to 2,000 characters after trimming.",
              },
              {
                name: "title",
                type: "string",
                detail: "Sender-name override, up to 80 characters. Defaults to the service title.",
              },
              {
                name: "imageUrl",
                type: "string",
                detail:
                  "Public HTTPS avatar URL, up to 2,048 characters. localhost, .local, loopback, link-local and private IP ranges are rejected.",
              },
              {
                name: "url",
                type: "string",
                detail:
                  "Destination opened when the notification is tapped. http and https only, so custom app schemes and javascript: or data: URLs never reach a device.",
              },
              {
                name: "deviceIds",
                type: "string[], Pro",
                detail:
                  "1 to 50 device IDs from the dashboard. Omit to notify every active device.",
              },
              {
                name: "response",
                type: "object, Pro",
                detail: "Turns the notification into an approval, yes/no, or text prompt.",
              },
            ],
          },
        ],
      },
      {
        id: "notification-idempotency",
        blocks: [
          {
            kind: "p",
            text: "Send an optional `Idempotency-Key` header of 1 to 200 characters. Keys are scoped to a single service.",
          },
          {
            kind: "bullets",
            items: [
              "Same key and payload: the original event is returned with `idempotent: true`.",
              "Same key while the first request is still in flight: `202 Accepted`.",
              "Same key with a different payload: `409 Conflict`.",
              "Blank or over-length key: `400`.",
            ],
          },
        ],
      },
      {
        id: "device-routing",
        pro: true,
        blocks: [
          {
            kind: "p",
            text: "By default a request fans out to every active iOS device on the account, most recently seen first. Free accounts are capped at one device, so extra phones are ignored until you upgrade.",
          },
          {
            kind: "p",
            text: "Hark Pro can pass a non-empty `deviceIds` array to target specific iPhones. Copy the stable device IDs from the dashboard. IDs that do not belong to the account return `400 Invalid device selection`; owned but inactive or non-iOS devices in the list are skipped silently.",
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "body": "The production deploy needs attention.",
  "deviceIds": ["dev_your_iphone_id"]
}`,
          },
          {
            kind: "p",
            text: "Sending `deviceIds` without device routing on your plan returns `402`.",
          },
        ],
      },
      {
        id: "rate-limits",
        blocks: [
          {
            kind: "table",
            variant: "plan",
            caption: "Plan limits",
            rows: [
              { limit: "Requests per minute, per service", free: "60", pro: "300" },
              { limit: "Requests per minute, per account", free: "300", pro: "1,500" },
              { limit: "Notifications per month", free: "10,000", pro: "100,000" },
              { limit: "Active devices", free: "1", pro: "Unlimited" },
            ],
          },
          {
            kind: "p",
            text: "The per-minute counters use a rolling 60-second window and are shared across notifications, interactive responses, and Live Activity operations. A limited request returns `429` with a `Retry-After: 60` header and `retryAfterSeconds` in the body. Exhausting the monthly allowance also returns `429`, without a retry hint.",
          },
        ],
      },
      {
        id: "notification-response",
        blocks: [
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1
}`,
          },
          {
            kind: "table",
            variant: "field",
            caption: "Notification status codes",
            rows: [
              { name: "200", type: "ok", detail: "Accepted, or an idempotent replay." },
              { name: "202", type: "ok", detail: "An identical request is still processing." },
              { name: "400", type: "error", detail: "Invalid payload, key, or device selection." },
              { name: "402", type: "error", detail: "The payload uses a Hark Pro feature." },
              { name: "404", type: "error", detail: "Unknown webhook token." },
              { name: "409", type: "error", detail: "Idempotency key reused with a new payload." },
              { name: "429", type: "error", detail: "Rate limit or monthly allowance exhausted." },
              { name: "502", type: "error", detail: "Every push target was rejected by Expo." },
            ],
          },
          {
            kind: "p",
            text: "Provider errors can embed a device push token, so they are recorded in the dashboard activity log rather than returned to the caller. Use that log to find devices that are no longer registered.",
          },
        ],
      },
      {
        id: "interactive-responses",
        pro: true,
        blocks: [
          {
            kind: "p",
            text: "Hark Pro can attach a fixed response type to any notification. Supported types are `approval` (Approve or Deny), `yes_no` (Yes or No), and `text` (a short free-form reply).",
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "title": "Production deploy",
  "body": "Deploy commit 8e7fc2a?",
  "response": {
    "type": "approval",
    "expiresInSeconds": 900,
    "correlationId": "deploy-184",
    "callback": {
      "url": "https://ci.example.com/hark-response",
      "token": "private-callback-token"
    }
  }
}`,
          },
          {
            kind: "table",
            variant: "field",
            caption: "Interactive response fields",
            rows: [
              {
                name: "type",
                type: "string, required",
                detail: "`approval`, `yes_no`, or `text`.",
              },
              {
                name: "expiresInSeconds",
                type: "integer",
                detail: "30 to 86,400. Defaults to 900.",
              },
              {
                name: "correlationId",
                type: "string",
                detail: "Your own identifier, up to 100 characters. Echoed back on the callback.",
              },
              {
                name: "callback.url",
                type: "string",
                detail: "Public HTTPS URL that receives the answer.",
              },
              {
                name: "callback.token",
                type: "string",
                detail: "16 to 512 characters, sent back as a bearer token so you can verify Hark.",
              },
            ],
          },
          {
            kind: "p",
            text: "The response body gains a `response` object alongside the usual fields:",
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1,
  "response": { "status": "pending", "expiresAt": "2026-07-25T18:19:04.000Z" }
}`,
          },
        ],
      },
      {
        id: "response-status",
        pro: true,
        blocks: [
          {
            kind: "p",
            text: "Poll the event with the `eventId` from the send response, or withdraw it while it is still pending.",
          },
          {
            kind: "code",
            language: "bash",
            code: `curl ${EXAMPLE_ENDPOINT}/events/evt_Cxns2IdbF4H0TJYq

curl -X POST ${EXAMPLE_ENDPOINT}/events/evt_Cxns2IdbF4H0TJYq/cancel`,
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": true,
  "event": {
    "id": "evt_Cxns2IdbF4H0TJYq",
    "response": {
      "status": "approved",
      "action": "approve",
      "text": null,
      "correlationId": "deploy-184",
      "respondedAt": "2026-07-25T18:06:52.000Z",
      "expiresAt": "2026-07-25T18:19:04.000Z"
    }
  }
}`,
          },
          {
            kind: "bullets",
            items: [
              "`status` is one of `pending`, `approved`, `denied`, `yes`, `no`, `replied`, `expired`, or `canceled`.",
              "For `text` prompts, `action` becomes `reply` and `text` holds the answer. For the other types `action` holds the chosen option and `text` is `null`.",
              "Reading a pending request after `expiresAt` settles it as `expired`.",
              "Cancel returns `404` if the response is not pending, and events belonging to another service are never visible.",
            ],
          },
        ],
      },
      {
        id: "response-callbacks",
        pro: true,
        blocks: [
          {
            kind: "p",
            text: "When a callback is configured, Hark POSTs the answer to your URL with `Authorization: Bearer <callback.token>`, `Content-Type: application/json`, and a `Hark-Callbacks/1` user agent. Redirects are not followed and the request times out after 10 seconds.",
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "type": "notification.response",
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "correlationId": "deploy-184",
  "kind": "approval",
  "status": "approved",
  "action": "approve",
  "text": null,
  "respondedAt": "2026-07-25T18:06:52.000Z"
}`,
          },
          {
            kind: "p",
            text: "`kind` is `approval`, `yes_no`, or `reply` — a `text` request arrives as `reply`.",
          },
          {
            kind: "p",
            text: "Any response outside the 2xx range is a failure. Hark makes up to five attempts: once immediately, then after 30 seconds, 2 minutes, 10 minutes, and 1 hour. After the last attempt the callback is marked failed and is not retried, so treat the callback as at-least-once and key your handler on `eventId`.",
          },
          {
            kind: "note",
            text: "Callbacks fire only when someone actually answers. Prompts that expire or are canceled never call back — poll the event route if you need to observe those outcomes.",
          },
        ],
      },
    ],
  },
  {
    id: "activity-api",
    pro: true,
    lead: "A Live Activity is a stateful card on the Lock Screen and in the Dynamic Island. Start one, push partial updates as work progresses, then end it. Same webhook token, nested routes.",
    subsections: [
      {
        id: "activity-start",
        blocks: [
          {
            kind: "table",
            variant: "route",
            caption: "Activity API routes",
            rows: [
              {
                method: "POST",
                path: "/hooks/:token/live-activities",
                detail: "Start an activity. Returns 201.",
              },
              {
                method: "GET",
                path: "/hooks/:token/live-activities/:id",
                detail: "Read the current state.",
              },
              {
                method: "PATCH",
                path: "/hooks/:token/live-activities/:id",
                detail: "Apply a partial update.",
              },
              {
                method: "POST",
                path: "/hooks/:token/live-activities/:id/end",
                detail: "Settle and dismiss the activity.",
              },
            ],
          },
          { kind: "p", text: "Only `title` and `status` are required." },
          {
            kind: "code",
            language: "bash",
            code: `curl -X POST ${EXAMPLE_ENDPOINT}/live-activities \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: deploy-184-start' \\
  -d '{
    "title": "Deploy #184",
    "status": "Building",
    "progress": 0,
    "symbol": "build",
    "accentColor": "#FF9F0A"
  }'`,
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": true,
  "activityId": "act_9Rk2wQpLm4Tz",
  "sequence": 0,
  "status": "active",
  "accepted": 1,
  "failed": 0,
  "state": { "title": "Deploy #184", "status": "Building", "progress": 0, "symbol": "build" },
  "expiresAt": "2026-07-26T02:04:11.000Z",
  "staleAt": "2026-07-25T22:04:11.000Z",
  "endedAt": null
}`,
          },
          {
            kind: "p",
            text: "Use `activityId` in the update and end routes. If you pass your own `key` when starting, that value works in the URL too, so a script can address its activity without storing the generated ID. `Idempotency-Key` works on all three write routes and is scoped to the service: a replay returns `idempotent: true`, and reusing a key with a different payload returns `409`.",
          },
          {
            kind: "note",
            text: "Live Activities need a device running a Hark build that has registered a push-to-start token. If no device qualifies, the start still returns `201` with `accepted: 0` and an explanatory `message`.",
          },
        ],
      },
      {
        id: "activity-update",
        blocks: [
          {
            kind: "p",
            text: "`PATCH` merges into the current state, so send only what changed. At least one field other than `ifSequence` is required. Each accepted update increments `sequence`.",
          },
          {
            kind: "code",
            language: "bash",
            code: `curl -X PATCH ${EXAMPLE_ENDPOINT}/live-activities/act_9Rk2wQpLm4Tz \\
  -H 'Content-Type: application/json' \\
  -d '{ "status": "Testing", "progress": 0.6, "accentColor": "#64D2FF" }'`,
          },
          {
            kind: "bullets",
            items: [
              "Pass `null` for `detail` or `progress` to clear the field.",
              "Pass `ifSequence` to make the write conditional. A mismatch returns `409 Sequence conflict` along with the current state so you can reconcile.",
              "Updating an activity that has already ended or expired returns `409 Live Activity is already terminal`.",
            ],
          },
        ],
      },
      {
        id: "activity-end",
        blocks: [
          {
            kind: "code",
            language: "bash",
            code: `curl -X POST ${EXAMPLE_ENDPOINT}/live-activities/act_9Rk2wQpLm4Tz/end \\
  -H 'Content-Type: application/json' \\
  -d '{ "status": "Deployed", "progress": 1, "symbol": "success" }'`,
          },
          {
            kind: "p",
            text: "The body is optional. `dismissAfterSeconds` (0 to 14,400, default 0) controls how long the finished card lingers on the Lock Screen before iOS removes it.",
          },
          {
            kind: "note",
            text: '`status` and `symbol` have defaults on this route, so omitting them overwrites the live values with `"Complete"` and `success`. Send them explicitly if you want the final card to read differently.',
          },
        ],
      },
      {
        id: "activity-fields",
        blocks: [
          {
            kind: "table",
            variant: "field",
            caption: "Live Activity fields",
            rows: [
              {
                name: "title",
                type: "string, required",
                detail: "Up to 80 characters. Required on start, optional on updates.",
              },
              { name: "status", type: "string, required", detail: "Short state line, up to 60." },
              { name: "detail", type: "string", detail: "Secondary line, up to 240. Nullable." },
              { name: "progress", type: "number", detail: "0 to 1 inclusive. Nullable." },
              {
                name: "symbol",
                type: "enum",
                detail:
                  "`terminal`, `code`, `build`, `success`, or `warning`. Defaults to `terminal`.",
              },
              {
                name: "accentColor",
                type: "string",
                detail: "Six-digit hex, `#RRGGBB`. Defaults to `#5ED8B7`.",
              },
              {
                name: "privacyMode",
                type: "enum",
                detail:
                  "`standard` or `private`. Private replaces the start alert text with a generic line so the title and status stay off a locked screen.",
              },
              {
                name: "key",
                type: "string, start only",
                detail:
                  "Your own alias, up to 100 characters, usable in place of the activity ID. A key becomes reusable once its activity ends.",
              },
              {
                name: "replace",
                type: "boolean, start only",
                detail:
                  "End any Live Activity occupying a target device, and any of your own still holding the same `key`, before starting. Defaults to `false`. The response reports the displaced count as `replaced`.",
              },
              {
                name: "deviceIds",
                type: "string[], Pro",
                detail: "1 to 50 device IDs. Omit to target every capable device.",
              },
            ],
          },
        ],
      },
      {
        id: "activity-lifetime",
        blocks: [
          {
            kind: "p",
            text: "`expiresInSeconds` accepts 60 to 28,800 and defaults to 28,800 — eight hours. Once an activity passes its expiry it is marked `expired` and stops accepting updates.",
          },
          {
            kind: "p",
            text: "`staleAfterSeconds` accepts 0 to 28,800 and defaults to 14,400 — four hours. Past that deadline iOS treats the content as possibly out of date, but the card stays visible and updateable. Every update rolls the deadline forward from now, clamped to the expiry. An update that omits `staleAfterSeconds` reuses the previous window.",
          },
        ],
      },
      {
        id: "activity-conflicts",
        blocks: [
          {
            kind: "p",
            text: "A device can host one Hark Live Activity at a time. Starting another while one is still live on a target device returns `409`:",
          },
          {
            kind: "code",
            language: "json",
            code: `{
  "ok": false,
  "error": "A Live Activity is already active on a target device",
  "code": "ACTIVE_ACTIVITY_CONFLICT",
  "activityId": "act_9Rk2wQpLm4Tz"
}`,
          },
          {
            kind: "p",
            text: "The `activityId` is included only when the blocking activity belongs to the same service, so you can update it instead of starting over. Branch on `code` rather than the message text.",
          },
          {
            kind: "p",
            text: "To take the slot instead, pass `replace: true` in the start payload. Hark silently ends whatever occupies each target device — the old card is dismissed immediately, showing its last state — and then starts your activity. The success response reports how many activities were displaced as `replaced`; with nothing to displace the start behaves normally and `replaced` is `0`.",
          },
          {
            kind: "p",
            text: "`replace` also displaces activities started by your other services or API tokens, so a stale card from another integration cannot deadlock a device, though a foreign `activityId` is never disclosed. When the start carries a `key`, your live activity holding that key is ended everywhere — even on devices the start does not target — so the key always transfers to the new run. The implicit ends are not billed against your notification allowance. Combined with reusable keys this makes `key` plus `replace: true` a fixed-key restart you can send on every run.",
          },
        ],
      },
      {
        id: "activity-alerts",
        blocks: [
          {
            kind: "p",
            text: "A start carries an alert, so it may notify the user like a normal notification. Updates and ends carry no alert and are silent. Hark sends every Live Activity push at high APNs priority, which affects delivery speed only, not sound or haptics.",
          },
          {
            kind: "p",
            text: "Live Activity operations count against the same per-minute and monthly limits as notifications, so a chatty progress loop consumes the same budget. Throttle to meaningful state changes.",
          },
        ],
      },
    ],
  },
];
