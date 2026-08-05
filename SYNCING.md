# SYNCING.md — upstream sync procedure

Instructions for an AI agent asked to "sync upstream", "pull in upstream changes", or audit a
reverse PR. Read the **Fork contract** section of [README.md](./README.md) first — it defines the
four invariants, the conflict decision table, and the tripwire greps. That section is the
authority on *what* survives a sync; this file is the procedure for *how* to run one.

Context you need: this repo (`origin` = Cuzeth/hark) is a permanent behavioral fork of
`upstream` = R44VC0RP/hark, inside GitHub's fork network. Upstream is a multi-tenant SaaS;
this fork is a private single-user instance. The two will never converge — every sync is a
selective merge, and the selectivity happens at **conflict-resolution time**, not by skipping
commits.

## Hard constraints

1. **Never merge a reverse PR (upstream → this repo) with GitHub's merge button.** A reverse PR
   is a read-only audit surface; its merge button is all-or-nothing and would reintroduce
   everything the fork contract bans. The button-free equivalent is the compare view:
   `https://github.com/Cuzeth/hark/compare/main...R44VC0RP:main`.
2. **Integrate with a true `git merge upstream/main` on a sync branch.** Do not cherry-pick by
   default: cherry-picks record no ancestry, so every future sync re-conflicts on the same hunks
   forever. A merge records the new common ancestor and makes the next sync cheap. Cherry-pick
   only when the user explicitly asks for a narrow subset, and tell them the cost.
3. **Never squash- or rebase-merge the sync PR.** Squashing flattens away the upstream ancestry
   the merge just recorded. Land it with a merge commit (`gh pr merge --merge`) or a
   fast-forward push.
4. **Nothing lands until the audit gate and verification gate both pass.**
5. When a resolution is ambiguous, keep this fork's version and flag the question to the user in
   your report. Wrongly keeping ours is a missed feature; wrongly taking theirs can break auth,
   billing-absence, or push.

Environment quirks: there is no global `pnpm` — invoke it as
`COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm …`, and call `corepack pnpm -r <script>`
directly rather than root scripts that shell out to bare `pnpm`. Never run `xcodebuild` or
`eas`; the owner builds the iOS app from Xcode themselves.

## Procedure

### 1. Survey

Start from a clean working tree on an up-to-date `main`. Then:

```sh
git fetch upstream
git log --oneline main..upstream/main        # incoming commits
git log --oneline upstream/main..main        # this fork's own commits, for context
git diff --stat main...upstream/main         # file-level scope
```

Bucket every incoming commit using the README decision table: **drop** (marketing, pricing,
auth/OAuth, billing, EAS/Expo-push, the `apps/expo` client tree and its patches, deploy
workflows, upstream identity), **take** (webhook pipeline, interactions, server-side Live
Activities, harkctl, docs engine, analytics), **port-by-hand** (their client behavior — goes
into the SwiftUI app in `apps/ios`, never as their files), or **hand-merge** (env/config files,
`patches/`, versions). If the batch is large, touches
migrations or `patches/`, or contains anything you cannot bucket confidently, present the
bucketing to the user before merging; for small routine batches, proceed.

### 2. Merge on a sync branch

```sh
git switch -c sync/upstream-YYYY-MM main
git merge upstream/main
```

Conflicts are the mechanism, not a problem. Resolve by category:

- **Files this fork deleted** (landing/pricing/legal pages, OAuth modules, billing, deploy
  workflows, and upstream's entire `apps/expo` client tree with its `patches/`) reappearing as
  modify/delete or add conflicts: keep them deleted (`git rm`). Client behavior worth having is
  ported by hand into `apps/ios` instead — file a follow-up rather than blocking the sync.
- **Keep-ours files** (`auth.ts`, admin seeding, `env.ts`, push transport in `push.ts`/`apns.ts`
  alert path, contracts device schemas, identity/config, README/compose/`.env.example`): take
  ours, then port any genuinely new, contract-compatible logic from theirs by hand.
- **Take-theirs areas**: take theirs, then re-apply the fork deltas on top — no
  `getBilling`/allowance/402/plan gates, device fan-out never sliced or capped, `device.token`
  is the raw APNs token, alert payloads built by `buildAlertPayload` (data duplicated under
  `body` and at top level), docs carry no Pro/pricing copy, no upstream identity strings.
- **`patches/*`**: this fork carries patches only for packages the server uses (currently
  `@better-auth__core`). Upstream patches for client packages arrive with `apps/expo` and are
  dropped with it. If upstream bumps a server-side patched package's version, re-apply the
  fork's patch content against the new version and update `pnpm-workspace.yaml`
  `patchedDependencies` to match; after install, verify the patched source in `node_modules`.
- **`pnpm-lock.yaml`**: never hand-merge. Take either side to clear the conflict, then
  regenerate with `corepack pnpm install` and commit the result.
- **Drizzle migrations**: keep every migration file from both sides; ours are `0018_*`/`0019_*`.
  Resolve `drizzle/meta/_journal.json` so all entries appear exactly once with upstream's new
  migrations appended after this fork's (drizzle tracks applied migrations by content hash, so
  ordering matters only for fresh databases — which the boot smoke test covers). If upstream's
  migrations touch the `user`, `account`, or `device` tables, stop and flag to the user before
  proceeding: those tables carry the fork's auth and APNs-token changes.

Finish the merge with a single merge commit.

### 3. Audit gate

Run the tripwire greps from the README's Fork contract section and compare against its list of
permitted exceptions (negative test fixtures and the docs attribution banner). Then spot-check
the invariants directly — these paths must not exist:
`autumn.config.ts`, `apps/website/src/server/lib/billing.ts`,
`apps/website/src/server/routes/billing.ts`, `apps/website/src/server/lib/apple.ts`,
`apps/website/src/server/routes/apple-auth.ts`, `apps/expo/` (the entire tree),
`patches/expo-widgets*`, `.github/workflows/`.

### 4. Verification gate

All of these must pass on the sync branch:

```sh
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install
corepack pnpm -r typecheck
corepack pnpm -r test
corepack pnpm -r build
```

These gates do not cover the iOS app. If the sync changed anything the app consumes —
`packages/contracts` DTO shapes, push payload structure, or API routes — the Swift mirror in
`apps/ios/Shared/HarkModels.swift` must be updated to match, and only an Xcode build by the
owner verifies it.

Then a boot smoke test against a fresh database (the server resolves `./drizzle` from its
working directory — run it from `apps/website`; the build step above produced
`dist/server/index.js`):

```sh
cd apps/website
rm -f /tmp/hark-sync-smoke.sqlite*
DATABASE_URL=/tmp/hark-sync-smoke.sqlite ADMIN_USERNAME=smoke \
  ADMIN_PASSWORD=smoketest-pass-123 BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
  PORT=18789 APP_URL=http://localhost:18789 node dist/server/index.js &
sleep 3
curl -s -c /tmp/hark-sync-jar -X POST http://localhost:18789/api/auth/sign-in/username \
  -H 'Content-Type: application/json' \
  -d '{"username":"smoke","password":"smoketest-pass-123"}' -o /dev/null -w 'signin:%{http_code}\n'
curl -s -b /tmp/hark-sync-jar -X POST http://localhost:18789/api/devices \
  -H 'Content-Type: application/json' \
  -d "{\"apnsToken\":\"$(printf 'ab%.0s' {1..32})\",\"platform\":\"ios\"}" \
  -o /dev/null -w 'register:%{http_code}\n'
kill %1
```

Expect `[auth] Created the admin account "smoke"` in the server log, `signin:200`, and
`register:201`. Anything else fails the gate. Delete `/tmp/hark-sync-smoke.sqlite*` and
`/tmp/hark-sync-jar` afterwards.

### 5. Land it

Push the branch and open a **same-repo** PR (`sync/upstream-YYYY-MM` → `main`). The PR body is
your audit record: the per-commit bucketing (took / dropped / adapted, with one-line reasons),
the fork deltas you re-applied, and the verification results. This PR — not the reverse PR — is
what gets reviewed and merged.

Merge with a merge commit only (constraint 3). After a true merge lands, any open reverse audit
PR flips to "merged" automatically because upstream's SHAs became reachable from `main`; if you
cherry-picked (exception path), close the reverse PR manually with a comment linking the sync PR.

### 6. Report

Tell the user: which commits came in, what was dropped and why, which deltas were re-applied,
which client behaviors were flagged for a hand-port into `apps/ios`, verification evidence, and
anything deferred. If the sync touched `packages/contracts`, push payloads, or anything under
`patches/`, explicitly ask the user to build once from Xcode — agents cannot verify native
builds here.
