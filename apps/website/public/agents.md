# Hark

Hark turns a JSON webhook request into an iOS communication notification.

Create a service in the Hark dashboard, copy its secret webhook URL, and send an HTTP `POST` request. Omitted fields fall back to the service defaults. Requests notify all active iPhones unless `deviceIds` is provided on Hark Pro.

## Endpoint

```text
POST https://hark.ryan.ceo/hooks/whk_your_token
Content-Type: application/json
```

The webhook URL is a secret credential. Do not commit it, log it, or expose it in client-side code.

## Example

```bash
curl -X POST https://hark.ryan.ceo/hooks/whk_your_token \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: deploy-184-production' \
  -d '{
    "body": "Production deployed successfully.",
    "title": "GitHub",
    "imageUrl": "https://github.com/github.png",
    "url": "https://github.com/acme/app/actions"
  }'
```

## Payload

| Field | Required | Description |
| --- | --- | --- |
| `body` | Yes | Notification message, up to 2,000 characters. |
| `title` | No | Sender title override, up to 80 characters. |
| `imageUrl` | No | Public HTTPS avatar URL. Private and local addresses are rejected. |
| `url` | No | Destination opened when the notification is tapped. |
| `deviceIds` | No | Hark Pro only. One or more device IDs from the dashboard. Omit to notify all active devices. |

Unknown fields are rejected.

## Idempotency

Send an optional `Idempotency-Key` header to prevent duplicate notifications. Repeating the same key and payload returns the original event. Reusing the key with a different payload returns `409 Conflict`.

Use a new key for each logical notification. Keys may contain up to 200 characters.

## Device Routing

Every request goes to all active devices by default. Hark Pro can include a non-empty `deviceIds` array to notify only those registered iPhones.

```json
{
  "body": "The production deploy needs attention.",
  "deviceIds": ["dev_your_iphone_id"]
}
```

Copy stable device IDs from the dashboard. Unknown or cross-account IDs return `400`; inactive targets are skipped.

## Rate Limits

Free accepts 60 requests per minute per service and 300 per minute per account. Pro accepts 300 per minute per service and 1,500 per minute per account.

A rate-limited request returns `429` with a `Retry-After` header. Monthly plan limits also return `429` when exhausted.

## Response

```json
{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1
}
```

`delivered` is the number of push requests accepted by Expo. Acceptance does not prove that the phone displayed the notification. Use the dashboard activity log to inspect failures and devices that are no longer registered.

## Error Statuses

| Status | Meaning |
| --- | --- |
| `400` | Invalid payload, invalid routing target, or malformed idempotency key. |
| `402` | Device routing requires Hark Pro. |
| `404` | Unknown webhook URL. |
| `409` | An idempotency key was reused with a different payload. |
| `429` | Rate or monthly notification limit exceeded. |

## Integration Guidance

1. Store the webhook URL as a secret.
2. Send server-side requests only.
3. Always provide a non-empty `body`.
4. Use an `Idempotency-Key` when retrying is possible.
5. Treat `delivered` as provider acceptance, not confirmed presentation.
