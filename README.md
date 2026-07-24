# Hark

Hark turns any webhook into a source-branded iOS communication notification.
Sign in with Google, create a **service**, copy its secret webhook URL, and
every `POST` to it lands on your iPhone as a notification with the service's
name and avatar — like a message from a contact.

Hark supports a generous single-device Free plan and an $8/month Pro plan
powered by Autumn. Pro unlocks multiple devices, targeted routing, and higher
rate limits. Android, teams, browser push, transformations, and analytics are
not currently supported.

## Architecture

```
hark/
├── apps/
│   ├── website/          One deployable app:
│   │   ├── src/client/     Vite 8 + React 19 SPA (React Router, Tailwind v4)
│   │   └── src/server/     Hono API on Node 22 (Better Auth, Drizzle, SQLite)
│   └── expo/             Expo SDK 57 iOS app (Expo Router, notifications, Live Activities)
│       └── targets/notification-service/   Swift Notification Service Extension
├── packages/
│   ├── contracts/        Shared Zod schemas + inferred types
│   └── harkctl/          Publishable unscoped Node 22 CLI package
├── Dockerfile            Multi-stage production image (node:22-trixie-slim)
└── compose.yaml          Container + named volume for /data
```

- **Dev:** Vite (`:8787`) proxies `/api` and `/hooks` to the Hono server (`:8788`).
- **Prod:** one Hono process serves the API, the built SPA (history fallback),
  and runs Drizzle migrations on startup. SQLite lives at `DATABASE_URL`
  (`/data/hark.sqlite` in Docker).

### Delivery pipeline

1. `POST /hooks/:token` with
   `{ "body": "...", "title"?, "imageUrl"?, "url"?, "deviceIds"? }`.
2. The token is hashed (SHA-256) for webhook lookup and encrypted with AES-GCM
   for owner-only recovery from the dashboard. Plaintext tokens are never
   persisted.
3. Overrides win over service defaults for title/image/url.
4. A push is sent through the Expo Push Service to every active iOS device of
   the owning user by default. Pro requests can include `deviceIds` to target
   specific registered devices. Pushes use `mutableContent: true`, `priority: high`,
   `richContent.image`, and a `data` payload
   (`v`, `eventId`, `serviceId`/`sourceId`, `sourceName`, `avatarUrl`, `url`,
   `conversationId`).
5. On the device, the Swift Notification Service Extension reads the data
   (Expo nests it under `userInfo["body"]`; top-level keys are a fallback),
   downloads the avatar, builds `INPerson` + `INSendMessageIntent`, donates the
   incoming interaction, and calls `content.updating(from:)` — completing
   exactly once with a timeout fallback.

## Local setup

Requires Node ≥ 22 and pnpm 11.

```sh
pnpm install
cp .env.example .env       # fill in what you have; dev works without secrets
pnpm dev                   # Hono API :8788 + Vite :8787 (open http://localhost:8787)
```

Other root scripts: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`,
`pnpm format`.

Database migrations are generated with Drizzle Kit
(`pnpm --filter @hark/website db:generate`) and applied automatically when the
server starts.

### Webhook contract

```sh
curl -X POST "$APP_URL/hooks/whk_..." \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: deploy-184-production' \
  -d '{ "body": "Deploy finished ✅", "title": "CI", "imageUrl": "https://…", "url": "https://…" }'
```

| Field      | Required | Notes                                        |
| ---------- | -------- | -------------------------------------------- |
| `body`     | yes      | Notification text (≤ 2000 chars)             |
| `title`    | no       | Overrides the service title (sender name)    |
| `imageUrl` | no       | Overrides the service avatar (valid URL)     |
| `url`      | no       | Overrides the tap destination (valid URL)    |
| `deviceIds`| no       | Pro: target IDs; omit to notify all devices   |

`imageUrl` must be a public HTTPS URL. Localhost, private-network addresses,
and non-HTTPS images are rejected.

`Idempotency-Key` is optional and scoped to a service. Repeating a key with the
same payload returns the original event without another push. Reusing it with a
different payload returns `409 Conflict`.

Device IDs are listed in the dashboard. `deviceIds` must be a non-empty array
of IDs owned by the webhook's account. Unknown and cross-account IDs return
`400 Invalid device selection`; inactive targets are skipped. The parsed array
is deduplicated and sorted so target order does not alter idempotency.

Rate limits use a rolling 60-second window. Free allows 60 requests per service
and 300 per account; Pro allows 300 per service and 1,500 per account. Limited
requests return `429` with `Retry-After: 60`.

Responses: `200 { ok, eventId, delivered }`,
`200 { ok, delivered: 0, message }` when no devices are registered,
`400` invalid payload, `404` unknown token, `502` when Expo rejects delivery.
Authenticated users can inspect the latest 50 attempts in the dashboard activity
log. Public integration documentation is available at `/docs`.

## Agent approvals and replies

Hark can ask for an approval or a short text reply from a registered iPhone. The CLI uses a
device-style browser flow: the signed-in human reviews the client name, exact scopes, and expiry
before approving. Hark stores only hashes of the device code and resulting API token, and returns the
token to the polling CLI once. Dashboard token creation remains available as an advanced fallback.

Use the workspace CLI on Node 22 or newer:

```sh
pnpm --filter harkctl exec harkctl auth login
pnpm --filter harkctl exec harkctl auth status
pnpm --filter harkctl exec harkctl devices list
pnpm --filter harkctl exec harkctl ask "Deploy production?" --approval --wait --timeout 15m --json
pnpm --filter harkctl exec harkctl ask "What should the release note say?" --reply --wait --json
pnpm --filter harkctl exec harkctl auth logout
```

Login writes a mode-`0600` `config.json` in the OS application config directory. `HARK_TOKEN` is an
advanced alternative for ephemeral environments. The CLI never accepts a token on argv. `--device`
and login's `--scope` are repeatable, `--idempotency-key` suppresses duplicate asks, and durations
accept seconds or `s`/`m`/`h`/`d` suffixes. Successful stdout is one JSON object; diagnostics use
stderr.

The API records the requesting token identity and the first responding registered device. The first
valid response received before expiry wins atomically across devices. Later, canceled, or expired
responses receive a terminal conflict. Expo's successful response means the push request was
accepted for processing, not that it reached or was seen on a device.

## Agent task Live Activities

`harkctl` can start, update, inspect, and end a finite agent task on the Lock Screen and Dynamic
Island. The app ships one fixed `HarkAgentActivity` template built with `expo-widgets@57.0.6` and
`@expo/ui`; activity props are bounded text/progress values with no remote images or agent-defined
layout. Browser login requests `activities:read` and `activities:write` explicitly alongside the
existing default scopes.

```sh
harkctl activity start --key release-main --title "Release" --status "Building" --progress 0.1 \
  --stale-after 20m --idempotency-key release-start
harkctl activity update release-main --status "Testing" --progress 0.7 --if-sequence 0
harkctl activity get release-main
harkctl activity list
harkctl activity end release-main --status "Complete" --progress 1 --if-sequence 1 \
  --dismiss-after 30s
```

The server sends ActivityKit notifications directly to APNs with token-based ES256 authentication.
Set `APNS_KEY_ID`, `APPLE_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, and `APNS_ENVIRONMENT` only
on the website server. ActivityKit tokens are AES-GCM encrypted at rest and never returned by API
responses or logs. Missing APNs credentials produce a startup warning and failed activity delivery
results without affecting ordinary Expo notifications.

Ending an activity intentionally bypasses the monthly notification allowance so an authorized agent
can always remove stale task UI from the Lock Screen. End requests remain rate-limited, and accepted
end deliveries still count toward usage tracking.

SDK 57's official `expo-widgets` API does not expose IDs or props from `getInstances()`. Its 57.0.6
wrapper does retain the native activity as a normal runtime property, so Hark uses one guarded,
version-pinned helper to read that object's ActivityKit ID. Existing ID associations rotate safely;
a new association is made only when exactly one delivery for that device is waiting. Ambiguous
concurrent remote starts remain unassociated rather than risking an update to the wrong activity.
Push-to-start/update-token rotation and the `input-push-token` iOS 18 path still require verification
on a signed physical device.

## Billing

The pricing catalog is defined in `autumn.config.ts` and synced to Autumn with
the `atmn` CLI:

- Free: one iPhone, 10,000 accepted notifications per month, 60 requests per
  minute per service, and 300 per minute per account.
- Pro: $8/month, unlimited iPhones, targeted device routing, 100,000 accepted
  notifications per month, 300 requests per minute per service, and 1,500 per
  minute per account.

The website server uses `AUTUMN_API_KEY`; it is never exposed to the browser or
Expo app. Authenticated users start checkout and open the Stripe customer portal
through Hark's `/api/billing` routes. Autumn customer IDs are the stable Better
Auth user IDs. If Autumn is temporarily unavailable, ordinary single-device
delivery fails open and the last known plan remains active; accounts without a
cached plan temporarily fall back to Free capabilities.

Preview and push the catalog with:

```sh
pnpm exec atmn preview
pnpm exec atmn push --prod --yes --headless
```

## Google OAuth

Create an OAuth client (type **Web application**) in the Google Cloud Console
and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Authorized redirect URIs:

- Web (dev): `http://localhost:5173/api/auth/callback/google`
- Web (prod): `https://hark.ryan.ceo/api/auth/callback/google`

The Expo app signs in through the same server flow (Better Auth Expo plugin +
`expo-secure-store`); the server redirects back to the app via the `hark://`
scheme, which is allowed through `trustedOrigins`. No separate iOS OAuth
client is needed for this MVP.

## Expo / EAS / APNs prerequisites

- Apple Developer account; set `APPLE_TEAM_ID` (used by `@bacons/apple-targets`).
- `eas init` to get an `EAS_PROJECT_ID` (required for Expo push tokens), then
  `eas credentials` to set up APNs keys.
- Enable the **Communication Notifications** capability for the app id (the
  entitlements are already configured:
  `com.apple.developer.usernotifications.communication`, Siri, and
  `NSUserActivityTypes: [INSendMessageIntent]`).
- iOS deployment target is 16.4; the extension lives in
  `apps/expo/targets/notification-service/` and is wired into the Xcode
  project by `expo prebuild -p ios`.
- `expo-widgets` adds its required widget extension and App Group, enables Live Activities and
  frequent updates, and requests ActivityKit push tokens without asking for normal notification
  permission. Direct APNs credentials remain server-only.
- Approval and reply actions open the authenticated app in the foreground so responses received
  after a terminated launch can be submitted reliably. Retryable network failures are kept in a
  small SecureStore queue and retried on launch; the server still enforces first-response-wins.
- Users must expand or long-press an interaction notification to choose Approve, Deny, or Reply.
  Tapping the notification body only opens its configured deep link and does not submit a response.
- App Store review notes should describe Hark as a user-configured notification utility. Approval
  and reply text is user-initiated, sent only to the signed-in account's interaction API, and is not
  used for advertising or tracking.
- Review notes should also explain that an explicitly authorized `harkctl` agent starts finite task
  progress Live Activities on the Lock Screen/Dynamic Island. The fixed template has a private mode
  that shows generic text; users should avoid exposing sensitive task details on their Lock Screen.
- Optionally set `EXPO_ACCESS_TOKEN` on the server so push requests to Expo
  are authenticated.

Run on a device (push tokens require real hardware):

```sh
cd apps/expo
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8787 npx expo run:ios --device
```

## Docker

```sh
docker compose build
BETTER_AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d
# or: docker build -t hark . && docker run -p 8787:8787 -v hark-data:/data \
#   -e BETTER_AUTH_SECRET=... -e APP_URL=https://hark.ryan.ceo hark
```

The image builds the SPA and bundles the server, runs migrations on startup,
serves static assets with history fallback, and persists SQLite in the
`hark-data` volume mounted at `/data`. A healthcheck polls `/api/health`.
The base is `node:22-trixie-slim` (a node:22 slim variant): better-sqlite3's
prebuilt binaries require glibc ≥ 2.38, which bookworm-based `node:22-slim`
does not provide.

Expose the container port publicly only behind a trusted reverse proxy that overwrites
`X-Real-IP`/`X-Forwarded-For`; device-authorization rate limits use the first forwarded client value.

## Usage analytics

The server records aggregate product usage in three SQLite tables:
`analytics_event` (append-only, pruned after 180 days), `analytics_daily`
(idempotent `day` + `metric` rollups, kept forever) and `analytics_user_day`
(one row per user per UTC day, powering DAU/WAU/MAU). Only identifiers, event
names, coarse outcome buckets and counters are stored — never notification
content, prompts, replies, tokens, emails, IPs or user agents. Analytics writes
are wrapped so a failure can never fail a request.

Query it read-only with the bundled script, which needs no extra dependencies:

```sh
# Locally (DATABASE_URL or --db selects the file)
node apps/website/scripts/analytics.mjs summary
node apps/website/scripts/analytics.mjs dau --days 30

# In the production container
docker compose exec hark node scripts/analytics.mjs summary
docker exec hark node scripts/analytics.mjs errors --days 7
```

`node scripts/analytics.mjs --help` lists every subcommand (`summary`, `dau`,
`wau`, `mau`, `retention`, `services`, `devices`, `notifications`, `errors`,
`plans`, `events --name <name>`, `names`). Output is always JSON on stdout.

## Manual production workflows

The GitHub Actions workflows are intentionally manual-only and do not run on
push:

- **Production Update** verifies the monorepo, syncs the website to exe.dev,
  builds before downtime, snapshots SQLite, restarts Docker, and checks both
  local and public health endpoints.
- **Production Deployment** verifies the monorepo and Expo project, queues an
  iOS App Store build, and automatically submits it through EAS Submit.

Configure a GitHub `production` environment (optionally with required
reviewers) and these repository secrets:

| Secret | Used by | Description |
| --- | --- | --- |
| `EXE_DEV_SSH_PRIVATE_KEY` | Production Update | Private key registered with the `raven-cobra` exe.dev VM. |
| `EXE_DEV_KNOWN_HOSTS` | Production Update | Trusted `ssh-keyscan -H raven-cobra.exe.xyz` output. |
| `EXPO_TOKEN` | Production Deployment | Expo personal access token for `@ryanvogel/hark`. |

Run either workflow from the GitHub Actions tab or with GitHub CLI after the
repository has a remote and the workflow files are present on the default
branch.

## What cannot work without credentials

Everything builds, typechecks, and tests offline. These need real credentials:

- **Google sign-in** (web and app) — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
  Until then the server starts with a warning and `/api/*` stays locked.
- **Push delivery to a real iPhone** — an EAS project (`EAS_PROJECT_ID`), APNs
  credentials via EAS, an Apple team id, and a development build on hardware.
  The webhook endpoint itself works and records events regardless.
- **Communication-notification rendering** — requires the app (with the
  extension) installed via a development/TestFlight build; the iOS Simulator
  does not receive Expo push notifications.
- **Remote Live Activity delivery** — requires the direct APNs environment variables, the Live
  Activities/push capabilities on the signed app and widget extension, iOS 17.2+ for push-to-start,
  and a physical device. iOS 18+ is needed for the `input-push-token` start flow.
