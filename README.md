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
the APNs credentials every notification needs (`APNS_KEY_ID`, `APPLE_TEAM_ID`, `APNS_PRIVATE_KEY`).
Delivery runs from your server straight to Apple's APNs with your own `.p8` key — no push relay
sits in between, so Apple is the only third party involved. Then bring it up:

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

`harkctl` can also route permission requests from Claude Code, Codex, OpenCode V1, and OpenCode V2
to Hark with one setup command:

```sh
harkctl auth login --client-name "Coding agent permissions"
harkctl permissions setup all
```

Only an explicit phone approval allows a request. Other outcomes deny it, and raw commands, patches,
prompts, file contents, and absolute paths are not sent to Hark.

## iOS app

The app in [`apps/expo`](./apps/expo) is not on the App Store — build and install it yourself under
bundle id `dev.abdeen.hark`. Generate the native project with `npx expo prebuild -p ios`, then open
`apps/expo/ios/Hark.xcworkspace` in Xcode and run it on your iPhone. No Expo or EAS account is
needed.

- Set `APPLE_TEAM_ID` to your own Apple Developer team.
- Point `EXPO_PUBLIC_API_URL` at this instance, or at your machine's LAN IP in development so a
  physical iPhone can reach the dev server.
- The APNs key the server uses must belong to the same team, and `APNS_BUNDLE_ID` must match.
- Keep `APNS_ENVIRONMENT` and `EXPO_PUBLIC_APNS_ENVIRONMENT` on `sandbox` for development builds and
  `production` for release builds.

## Fork contract — read before merging upstream

This section is for whoever maintains this fork, human or AI agent. Upstream is
[R44VC0RP/hark](https://github.com/R44VC0RP/hark) (the `upstream` git remote). Upstream is a
multi-tenant SaaS with OAuth sign-in, a paid Pro plan, and Expo-hosted push; this fork is a private
single-user instance. Four invariants define the fork — any upstream merge must leave all four
intact:

1. **One account, username + password.** Auth is better-auth's `username()` plugin
   ([auth.ts](apps/website/src/server/auth.ts)); the single admin account is seeded at boot from
   `ADMIN_USERNAME` / `ADMIN_PASSWORD` ([index.ts](apps/website/src/server/index.ts)), and a
   `databaseHooks.user.create.before` guard rejects any second user. There is no sign-up UI, no
   Google/Apple OAuth, and no account-deletion flow. Upstream's `lib/apple.ts`,
   `routes/apple-auth.ts`, social sign-in buttons, and the app's `apple-auth.ts` are deleted here.
2. **No billing.** Autumn is gone (`autumn.config.ts`, `lib/billing.ts`, `routes/billing.ts`,
   `shared/pricing.ts`, the Pricing page). Everything upstream gates as "Hark Pro" is
   unconditional: `deviceIds` routing, interactive responses, Live Activities, unlimited devices,
   no notification quotas, no 402 responses. Rate limits are single-tier env values
   (`SERVICE_RATE_LIMIT_PER_MINUTE`, `ACCOUNT_RATE_LIMIT_PER_MINUTE`).
3. **Direct APNs only — no Expo cloud.** Alerts go server → Apple over HTTP/2 with this instance's
   own `.p8` key (`sendAlertPush` in [apns.ts](apps/website/src/server/lib/apns.ts));
   `expo-server-sdk`, `EXPO_ACCESS_TOKEN`, EAS (`eas.json`, `extra.eas`, `EAS_PROJECT_ID`), and
   Expo push tokens are all removed. The device identity is the raw APNs device token
   (`device.token`, unique — migration 0019); the app registers `getDevicePushTokenAsync()`
   output. Alert payloads carry the data object twice: under `body` (what expo-notifications
   surfaces as `content.data`) and at the top level (what
   [NotificationService.swift](apps/expo/targets/notification-service/NotificationService.swift)
   reads). Keep both slots identical.
4. **This owner's identity.** Bundle id `dev.abdeen.hark` (widgets `dev.abdeen.hark.widgets`,
   app group `group.dev.abdeen.hark`), public URL `hark.abdeen.dev`, team id only ever from
   `APPLE_TEAM_ID` env. No marketing landing page (the root route is the sign-in form), no
   pricing/legal pages, no SEO/sitemap (robots disallows all), neutral welcome pushes, no upstream
   deploy workflows under `.github/`, and no upstream identifiers anywhere (their bundle id, domain,
   Apple team `9G68SMNHEU`, EAS project id, TestFlight links, or personal avatars/handles).

Areas intentionally unchanged from upstream, where their improvements should merge cleanly: the
webhook pipeline and event/delivery tracking, interactions (approvals/replies), Live Activities
(including the `patches/expo-widgets` Swift injection — mind that one `+` line carries this fork's
respond URL, and patch line counts must not change), the iOS app UI, `harkctl` and the
device-authorization flow, the docs engine, the local-only SQLite analytics (minus billing events),
and the Docker/compose deployment.

### Merge procedure

The step-by-step procedure — sync branch, conflict-resolution playbook, audit and verification
gates, and how to land the sync PR — is in [SYNCING.md](./SYNCING.md), written for an agent to
execute. Decision rules while resolving conflicts:

| Upstream change touches | Resolution |
| --- | --- |
| Auth, sign-in/up, account deletion, OAuth, billing, plans, quotas, pricing/legal/marketing pages, SEO, EAS/Expo push, deploy workflows | Keep ours / drop theirs entirely |
| Webhook routes, interactions, Live Activities, widgets patch, app UI, harkctl, docs content, analytics | Take theirs, then re-apply this fork's deltas: no `getBilling`/allowance/402/plan gates, device fan-out never sliced, `device.token` is the APNs token, alert payloads built by `buildAlertPayload`, docs carry no Pro/pricing copy |
| Env/config files (`env.ts`, `.env.example`, `compose.yaml`, `app.config.ts`) | Merge by hand against the contract above; never reintroduce removed vars |

After any merge, grep for these strings: `autumn`, `pro_monthly`, `Hark Pro`, `GOOGLE_CLIENT`,
`APPLE_SIGN_IN`, `expo-server-sdk`, `ExponentPushToken`, `expoPushToken`, `EXPO_ACCESS_TOKEN`,
`EAS_PROJECT_ID`, `deleteUser`, `ceo.ryan.hark`, `hark.ryan.ceo`, `R44VC0RP`, `9G68SMNHEU`,
`twimg`. Outside this README and `pnpm-lock.yaml`, the only acceptable hits are negative test
fixtures that assert the string is rejected or absent (currently in `devices.test.ts`,
`docs.test.ts`, and the contracts tests), the delete-only `LEGACY_EXPO_TOKEN_KEY` SecureStore
cleanup constant in the app, and the deliberate "this instance is a private fork" attribution
banner in `Docs.tsx` that links to the original `R44VC0RP/hark` project. Anything else is
upstream leakage — remove it. Then run the full
verification gate in [SYNCING.md](./SYNCING.md) before landing anything.

## License

Hark is source-available under the
[PolyForm Noncommercial License 1.0.0](./LICENSE). Commercial use is not permitted without a
separate license from the licensor.
