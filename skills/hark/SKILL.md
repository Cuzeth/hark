---
name: hark
description: Use Hark and the harkctl CLI to send iPhone notifications, request approvals or replies, run Live Activities, and create persistent webhook services for CI, agents, scripts, monitoring, and other workflows. Use when a user asks to install or authenticate harkctl, notify their phone, ask them a question, show task progress, create a Hark service, obtain a webhook URL, or wire Hark into an existing workflow.
---

# Hark

Use Hark as the human-facing notification and interaction layer for automated workflows. Prefer
`harkctl` for agent-driven operations. Create a persistent webhook service when an external system
needs a stable URL it can call later.

## Ground Rules

- Use Node.js 22 or newer.
- Run `npx -y harkctl@latest` unless the project already pins or installs `harkctl`.
- Treat Hark tokens and webhook URLs as secrets. Never commit, print, summarize, or paste them into
  chat.
- Never accept a Hark token as a command-line argument. Authentication uses the browser flow or the
  `HARK_TOKEN` environment variable.
- Successful commands emit one JSON object on stdout; diagnostics use stderr.
- Use `--idempotency-key` whenever a notification or activity mutation may be retried.
- Read current documentation at `https://hark.ryan.ceo/docs#cli` when behavior is unclear.

## Authenticate

1. Check the current connection:

   ```bash
   npx -y harkctl@latest auth status
   ```

2. If unauthenticated or missing a required scope, start browser authorization:

   ```bash
   npx -y harkctl@latest auth login --client-name "<descriptive agent or machine name>"
   ```

3. Tell the user to approve the displayed code in the browser. Do not ask them to send a token.

The default login scopes support notifications, interactions, Live Activities, device and service
listing, and service creation. A login created before `services:write` existed must authenticate
again before creating a service. Use repeatable `--scope` only when least-privilege access is
explicitly required.

## Send Notifications

Send a one-shot notification:

```bash
npx -y harkctl@latest notify "Production deployed" \
  --title "Deploy bot" \
  --image https://example.com/deploy-bot.png \
  --url https://example.com/deployments/184 \
  --idempotency-key deploy-184-complete
```

The body is required. `--title` defaults to `Hark`; `--image` must be a public HTTPS URL; `--url`
opens when the notification is tapped. Repeat `--device <id>` for targeted Pro delivery. Use
`devices list` to discover device IDs.

For generated payloads, pipe JSON with `--stdin`; explicit flags override stdin fields:

```bash
printf '%s' '{"body":"Tests passed","title":"CI"}' | \
  npx -y harkctl@latest notify --stdin --idempotency-key build-184-tests
```

## Ask the User

Pass exactly one response type:

```bash
npx -y harkctl@latest notify ask "Deploy production?" \
  --approval --title "Deploy bot" --wait --timeout 15m

npx -y harkctl@latest notify ask "Run the migration?" \
  --yes-no --title "Database" --wait

npx -y harkctl@latest notify ask "What should the release note say?" \
  --text --title "Release bot" --wait
```

- `--approval` returns approved or denied.
- `--yes-no` returns yes or no.
- `--text` returns a short reply.
- `--wait` blocks until answered or timed out.
- `--poll` waits at most 20 seconds for an immediate answer.
- A timeout does not cancel the prompt. Resume with `interaction wait <id>`.

Branch on exit status instead of parsing prose: `0` means approved, yes, replied, or success; `4`
means timeout, canceled, or expired; `5` means denied or no; `7` means no device accepted the push.

## Run a Live Activity

Use one activity for changing task state instead of sending many notifications:

```bash
npx -y harkctl@latest activity start \
  --key deploy-main --replace --style ring \
  --title "Deploy #184" --status "Building" --progress 0.1

npx -y harkctl@latest activity update deploy-main \
  --status "Testing" --progress 0.7 --if-sequence 0

npx -y harkctl@latest activity end deploy-main \
  --status "Shipped" --progress 1 --dismiss-after 45s --if-sequence 1
```

Styles are `standard`, `ring`, `hero`, `terminal`, and `steps`. Use `--replace` for a fixed-key task
that should take the device slot on each run. Use the returned sequence with `--if-sequence` to
reject stale writes. Prefer meaningful updates over tight progress loops. iOS may suppress fresh
activity starts less than about one minute apart; update the current activity instead.

## Create and Wire a Webhook Service

Use this workflow when the user asks to add Hark to CI, automation, monitoring, or another system
that needs a reusable webhook URL.

1. Inspect the target workflow and infer a concise default title, public HTTPS image, and optional
   tap destination. Ask only if a required value cannot be inferred.

2. Create the service while capturing stdout. Do not echo the result:

   ```bash
   service_json="$(npx -y harkctl@latest services create \
     --title "Release bot" \
     --image https://example.com/release-bot.png \
     --url https://example.com/releases)"
   webhook_url="$(printf '%s' "$service_json" | jq -r '.webhookUrl')"
   test -n "$webhook_url" && test "$webhook_url" != null
   ```

3. Put `webhook_url` directly into the platform's secret manager. Prefer stdin-based secret commands
   so the value does not appear in process arguments. Use a name such as `HARK_WEBHOOK_URL`. Never
   write it to a tracked file.

   For GitHub Actions:

   ```bash
   printf '%s' "$webhook_url" | gh secret set HARK_WEBHOOK_URL
   unset webhook_url service_json
   ```

4. Reference the secret from the workflow and POST only the event-specific fields. The configured
   service title, image, and tap URL are defaults:

   ```yaml
   - name: Notify Hark
     if: always()
     env:
       HARK_WEBHOOK_URL: ${{ secrets.HARK_WEBHOOK_URL }}
     run: |
       curl --fail-with-body --silent --show-error \
         --retry 3 --retry-all-errors \
         -X POST "$HARK_WEBHOOK_URL" \
         -H 'Content-Type: application/json' \
         -H "Idempotency-Key: run-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
         -d "$(jq -n --arg body 'Workflow finished' '{body: $body}')"
   ```

5. Validate the workflow syntax. Send a test notification only when the user requested it or the
   integration cannot otherwise be verified without triggering the workflow.

`services list` shows service metadata but intentionally omits webhook credentials. If a URL is
lost, reveal or rotate it in the Hark dashboard rather than trying to recover it from logs.

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success, approved, yes, or replied |
| `1` | API error |
| `2` | CLI usage error |
| `3` | Authentication or scope error |
| `4` | Timeout, canceled, or expired |
| `5` | Denied or no |
| `6` | Network error |
| `7` | No device accepted the push |

When reporting completion, describe what was configured and where. Do not include tokens, webhook
URLs, or secret values.
