# Hark

Hark turns webhooks into clean, source-branded iPhone notifications. This is a private, single-user
fork running at [hark.abdeen.dev](https://hark.abdeen.dev): one account seeded from the environment,
no sign-up, no social login, and no plans or quotas — every feature is on. It is meant to be
self-hosted as a single container in the spirit of [gotify](https://gotify.net) and
[ntfy](https://ntfy.sh), with a native iOS app instead of a generic push client. Forked from
[R44VC0RP/hark](https://github.com/R44VC0RP/hark), whose
[PolyForm Noncommercial License 1.0.0](./LICENSE) carries over to this fork.

Each source gets its own branded webhook service; the dashboard tracks services, delivery attempts,
and registered devices. Beyond plain notifications, Hark can ask for approvals or short text
replies, show stateful task progress in Live Activities on the Lock Screen and Dynamic Island, and
route to specific devices when more than one iPhone is registered.

## Self-hosting

Copy `.env.example` to `.env`, which documents every variable. At minimum set `ADMIN_USERNAME` and
`ADMIN_PASSWORD` (the single account, seeded on first boot, 8+ characters), `BETTER_AUTH_SECRET`
(`openssl rand -base64 32`), `APP_URL` (the public origin, used for sign-in and webhook URLs), and
the APNs credentials Live Activities need (`APNS_KEY_ID`, `APPLE_TEAM_ID`, `APNS_PRIVATE_KEY`).
`EXPO_ACCESS_TOKEN` is optional and authenticates requests to the Expo Push Service. Then bring it
up:

```sh
docker compose up -d
```

SQLite persists in the `hark-data` volume and migrations run inside the server process at startup.
Publish the port only behind a trusted proxy, and set `TRUSTED_CLIENT_IP_HEADER` to a header that
proxy overwrites — auth rate limits read the client IP from it.

For local development instead, with [Node.js 22 or newer](https://nodejs.org/) and pnpm:

```sh
pnpm install
pnpm dev
```

Sign in with the admin credentials at [hark.abdeen.dev](https://hark.abdeen.dev), or at
`http://localhost:5173` in development. Register your iPhone with the Hark app, then create a
service and copy its secret webhook URL.

## Send a notification

```sh
curl -X POST 'https://hark.abdeen.dev/hooks/whk_your_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "GitHub",
    "body": "Production deployed successfully.",
    "url": "https://github.com/acme/app/actions"
  }'
```

Only `body` is required.

| Field | Description |
| --- | --- |
| `body` | Notification text. |
| `title` | Optional sender-name override. |
| `imageUrl` | Optional public HTTPS avatar URL. |
| `url` | Optional destination opened when tapped. |
| `deviceIds` | Optional. Route to specific devices instead of every registered one. |

Successful requests return `{ "ok": true, "eventId": "evt_...", "delivered": 1 }`. Use an
`Idempotency-Key` header when retrying requests to prevent duplicate notifications.

## Live Activities

The same service token starts and drives stateful task activities:

```text
POST  /hooks/:token/live-activities
PATCH /hooks/:token/live-activities/:activityId
POST  /hooks/:token/live-activities/:activityId/end
```

A start accepts `title`, `status`, `detail`, `progress`, `symbol`, `accentColor`, and `style`, and
returns an `activityId`; updates accept the same fields partially. Hark allows one active task Live
Activity per device — pass `replace: true` on start to silently end whatever task occupies the
device and take the slot. Interactive approval activities may coexist with that task. Starting an
activity may alert the user, but progress updates are silent by default. To add a new layout, see
[Contributing a Live Activity template](./CONTRIBUTING_LIVE_ACTIVITY_TEMPLATES.md).

## harkctl

The [`harkctl`](./packages/harkctl) CLI sends one-shot notifications, asks for approvals or short
replies, and manages Live Activities from scripts and AI agents. It is not published to npm; install
it from a checkout of this repo:

```sh
npm install -g ./packages/harkctl
harkctl auth login
```

`auth login` starts a browser device-authorization flow and stores a scoped token locally. Requests
go to `https://hark.abdeen.dev` unless `HARK_API_URL` points somewhere else.

```sh
harkctl notify "Deploy finished ✅" --title "Deploy bot"
harkctl notify ask "Deploy production?" --approval --wait
harkctl activity start --title "Release" --status "Building" --progress 0.1
```

The [`hark` agent skill](./skills/hark/SKILL.md) follows the open Agent Skills format. Copy or
symlink `skills/hark` into your agent's skills directory to teach Claude Code, OpenCode, Codex,
Cursor, or another compatible agent how to drive the CLI.

## iOS app

The app in [`apps/expo`](./apps/expo) is not on the App Store — build and install it yourself with
Expo/EAS under bundle id `dev.abdeen.hark`.

- Set `APPLE_TEAM_ID` to your own Apple Developer team, and run `eas init` to get `EAS_PROJECT_ID`.
- Point `EXPO_PUBLIC_API_URL` at this instance, or at your machine's LAN IP in development so a
  physical iPhone can reach the dev server.
- The APNs key the server uses must belong to the same team, and `APNS_BUNDLE_ID` must match.
- Keep `APNS_ENVIRONMENT` and `EXPO_PUBLIC_APNS_ENVIRONMENT` on `sandbox` for development builds and
  `production` for release builds.

## License

Hark is source-available under the
[PolyForm Noncommercial License 1.0.0](./LICENSE). Commercial use is not permitted without a
separate license from the licensor.
