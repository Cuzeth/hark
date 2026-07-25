import { Link } from "react-router";
import { CodeBlock } from "../components/CodeBlock";

const exampleEndpoint = "https://hark.ryan.ceo/hooks/whk_your_token";

export function Docs() {
  return (
    <div className="min-h-dvh">
      <header>
        <div className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-6">
          <Link to="/" className="text-lg font-semibold">
            Hark
          </Link>
          <nav className="text-ink-subtle flex items-center gap-4 text-sm" aria-label="Primary">
            <Link className="hover:text-ink transition" to="/">
              Home
            </Link>
            <Link className="hover:text-ink transition" to="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-accent-text mb-3 text-xs font-medium uppercase">Documentation</p>
        <h1 className="max-w-xl text-3xl font-semibold text-balance">Send a notification</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-subtle">
          Create a service in the dashboard, then POST JSON to its secret webhook URL. Hark resolves
          any omitted fields from the service defaults and sends the result to your registered
          iPhones.
        </p>

        <DocSection title="Request">
          <CodeBlock
            language="bash"
            code={`curl -X POST ${exampleEndpoint} \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: deploy-184-production' \\
  -d '{
    "body": "Production deployed successfully.",
    "title": "GitHub",
    "imageUrl": "https://github.com/github.png",
    "url": "https://github.com/acme/app/actions"
  }'`}
          />
        </DocSection>

        <DocSection title="Payload">
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="pb-3 font-medium">Field</th>
                  <th className="pb-3 font-medium">Required</th>
                  <th className="pb-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-y border-line">
                <PayloadRow
                  field="body"
                  required
                  description="Notification message, up to 2,000 characters."
                />
                <PayloadRow
                  field="title"
                  description="Sender title override, up to 80 characters."
                />
                <PayloadRow
                  field="imageUrl"
                  description="Public HTTPS avatar URL. Private and local addresses are rejected."
                />
                <PayloadRow
                  field="url"
                  description="Destination opened when the notification is tapped."
                />
                <PayloadRow
                  field="deviceIds"
                  description="Pro: one or more device IDs from the dashboard. Omit to notify all active devices."
                />
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection title="Idempotency">
          <p className="text-sm leading-relaxed text-ink-subtle">
            Send an optional <InlineCode>Idempotency-Key</InlineCode> header to prevent duplicate
            notifications. Repeating the same key and payload returns the original event. Reusing
            the key with a different payload returns <InlineCode>409 Conflict</InlineCode>.
          </p>
        </DocSection>

        <DocSection title="Device routing">
          <p className="text-sm leading-relaxed text-ink-subtle">
            Every request goes to all active devices by default. Hark Pro can include a non-empty{" "}
            <InlineCode>deviceIds</InlineCode> array to notify only those registered iPhones. Copy
            stable device IDs from the dashboard. Unknown or cross-account IDs return{" "}
            <InlineCode>400</InlineCode>; inactive targets are skipped.
          </p>
          <div className="mt-4">
            <CodeBlock
              language="json"
              code={`{
  "body": "The production deploy needs attention.",
  "deviceIds": ["dev_your_iphone_id"]
}`}
            />
          </div>
        </DocSection>

        <DocSection title="Rate limits">
          <p className="text-sm leading-relaxed text-ink-subtle">
            Free accepts 60 requests per minute per service and 300 per minute per account. Pro
            accepts 300 per minute per service and 1,500 per minute per account. A limited request
            returns <InlineCode>429</InlineCode> with a <InlineCode>Retry-After</InlineCode> header.
            Monthly plan limits also return <InlineCode>429</InlineCode> when exhausted.
          </p>
        </DocSection>

        <DocSection title="Response">
          <CodeBlock
            language="json"
            code={`{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1
}`}
          />
          <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
            Delivered is the number of push requests accepted by Expo. Use the dashboard activity
            log to inspect failures and devices that are no longer registered.
          </p>
        </DocSection>

        <DocSection title="Live Activities">
          <p className="mb-4 text-sm leading-relaxed text-ink-subtle">
            A service webhook can start one stateful Live Activity per target device. The response
            returns an <InlineCode>activityId</InlineCode> used for partial updates and the final
            end request. Progress is a number from 0 to 1; accent colors use six-digit hex.
          </p>
          <CodeBlock
            language="bash"
            code={`# Start
curl -X POST ${exampleEndpoint}/live-activities \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: deploy-184-start' \\
  -d '{
    "title": "Deploy #184",
    "status": "Building",
    "progress": 0,
    "symbol": "build",
    "accentColor": "#FF9F0A"
  }'

# Update with the activityId returned above
curl -X PATCH ${exampleEndpoint}/live-activities/act_your_activity_id \\
  -H 'Content-Type: application/json' \\
  -d '{ "status": "Testing", "progress": 0.6, "accentColor": "#64D2FF" }'

# End
curl -X POST ${exampleEndpoint}/live-activities/act_your_activity_id/end \\
  -H 'Content-Type: application/json' \\
  -d '{ "status": "Deployed", "progress": 1, "symbol": "success" }'`}
          />
          <p className="mt-4 text-sm leading-relaxed text-ink-subtle">
            Activities expire after eight hours by default. Their content becomes stale after four
            hours without an update; every update rolls that stale deadline forward. Stale content
            remains visible and updateable. Starting another activity on an occupied device returns{" "}
            <InlineCode>409 ACTIVE_ACTIVITY_CONFLICT</InlineCode>.
          </p>
        </DocSection>
      </main>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-7">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PayloadRow({
  field,
  required,
  description,
}: {
  field: string;
  required?: boolean;
  description: string;
}) {
  return (
    <tr>
      <td className="py-3 pr-5 font-mono text-xs text-ink-muted">{field}</td>
      <td className="py-3 pr-5 text-xs text-ink-faint">{required ? "Yes" : "No"}</td>
      <td className="py-3 text-sm text-ink-subtle">{description}</td>
    </tr>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs text-ink-muted">{children}</code>;
}
