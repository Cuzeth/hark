# Hark

Hark turns any webhook into a source-branded iOS communication notification.
Sign in with Google, create a **service**, copy its secret webhook URL, and
every `POST` to it lands on your iPhone as a notification with the service's
name and avatar — like a message from a contact.

This MVP proves notification delivery only. No Android, billing, teams,
browser push, transformations, or analytics.

## Architecture

```
hark/
├── apps/
│   ├── website/          One deployable app:
│   │   ├── src/client/     Vite 8 + React 19 SPA (React Router, Tailwind v4)
│   │   └── src/server/     Hono API on Node 22 (Better Auth, Drizzle, SQLite)
│   └── expo/             Expo SDK 57 iOS app (Expo Router, expo-notifications)
│       └── targets/notification-service/   Swift Notification Service Extension
├── packages/
│   └── contracts/        Shared Zod schemas + inferred types
├── Dockerfile            Multi-stage production image (node:22-trixie-slim)
└── compose.yaml          Container + named volume for /data
```

- **Dev:** Vite (`:8787`) proxies `/api` and `/hooks` to the Hono server (`:8788`).
- **Prod:** one Hono process serves the API, the built SPA (history fallback),
  and runs Drizzle migrations on startup. SQLite lives at `DATABASE_URL`
  (`/data/hark.sqlite` in Docker).

### Delivery pipeline

1. `POST /hooks/:token` with `{ "body": "...", "title"?, "imageUrl"?, "url"? }`.
2. The token is hashed (SHA-256) and matched against the stored hash — the
   plaintext token is never persisted and is shown exactly once at creation
   or rotation.
3. Overrides win over service defaults for title/image/url.
4. A push is sent through the Expo Push Service to every active iOS device of
   the owning user: `mutableContent: true`, `priority: high`,
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

`imageUrl` must be a public HTTPS URL. Localhost, private-network addresses,
and non-HTTPS images are rejected.

`Idempotency-Key` is optional and scoped to a service. Repeating a key with the
same payload returns the original event without another push. Reusing it with a
different payload returns `409 Conflict`.

Rate limits use a rolling 60-second window: 60 requests per service and 300
requests per account. Limited requests return `429` with `Retry-After: 60`.

Responses: `200 { ok, eventId, delivered }`,
`200 { ok, delivered: 0, message }` when no devices are registered,
`400` invalid payload, `404` unknown token, `502` when Expo rejects delivery.
Authenticated users can inspect the latest 50 attempts in the dashboard activity
log. Public integration documentation is available at `/docs`.

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
