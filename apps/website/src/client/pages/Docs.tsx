import { Link } from "react-router";

const exampleEndpoint = "https://hark.ryan.ceo/hooks/whk_your_token";

export function Docs() {
  return (
    <div className="min-h-dvh">
      <header>
        <div className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-6">
          <Link to="/" className="text-lg font-semibold">
            Hark
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-500" aria-label="Primary">
            <Link className="transition hover:text-neutral-900" to="/">
              Home
            </Link>
            <Link className="transition hover:text-neutral-900" to="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-accent mb-3 text-xs font-medium uppercase">Documentation</p>
        <h1 className="max-w-xl text-3xl font-semibold text-balance">Send a notification</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-500">
          Create a service in the dashboard, then POST JSON to its secret webhook URL. Hark resolves
          any omitted fields from the service defaults and sends the result to your registered
          iPhones.
        </p>

        <DocSection title="Request">
          <Code>{`curl -X POST ${exampleEndpoint} \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: deploy-184-production' \\
  -d '{
    "body": "Production deployed successfully.",
    "title": "GitHub",
    "imageUrl": "https://github.com/github.png",
    "url": "https://github.com/acme/app/actions"
  }'`}</Code>
        </DocSection>

        <DocSection title="Payload">
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="text-xs text-neutral-400">
                <tr>
                  <th className="pb-3 font-medium">Field</th>
                  <th className="pb-3 font-medium">Required</th>
                  <th className="pb-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 border-y border-neutral-200">
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
          <p className="text-sm leading-relaxed text-neutral-500">
            Send an optional <InlineCode>Idempotency-Key</InlineCode> header to prevent duplicate
            notifications. Repeating the same key and payload returns the original event. Reusing
            the key with a different payload returns <InlineCode>409 Conflict</InlineCode>.
          </p>
        </DocSection>

        <DocSection title="Device routing">
          <p className="text-sm leading-relaxed text-neutral-500">
            Every request goes to all active devices by default. Hark Pro can include a non-empty{" "}
            <InlineCode>deviceIds</InlineCode> array to notify only those registered iPhones. Copy
            stable device IDs from the dashboard. Unknown or cross-account IDs return{" "}
            <InlineCode>400</InlineCode>; inactive targets are skipped.
          </p>
          <div className="mt-4">
            <Code>{`{
  "body": "The production deploy needs attention.",
  "deviceIds": ["dev_your_iphone_id"]
}`}</Code>
          </div>
        </DocSection>

        <DocSection title="Rate limits">
          <p className="text-sm leading-relaxed text-neutral-500">
            Free accepts 60 requests per minute per service and 300 per minute per account. Pro
            accepts 300 per minute per service and 1,500 per minute per account. A limited request
            returns <InlineCode>429</InlineCode> with a <InlineCode>Retry-After</InlineCode> header.
            Monthly plan limits also return <InlineCode>429</InlineCode> when exhausted.
          </p>
        </DocSection>

        <DocSection title="Response">
          <Code>{`{
  "ok": true,
  "eventId": "evt_Cxns2IdbF4H0TJYq",
  "delivered": 1
}`}</Code>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            Delivered is the number of push requests accepted by Expo. Use the dashboard activity
            log to inspect failures and devices that are no longer registered.
          </p>
        </DocSection>
      </main>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-7">
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
      <td className="py-3 pr-5 font-mono text-xs text-neutral-800">{field}</td>
      <td className="py-3 pr-5 text-xs text-neutral-400">{required ? "Yes" : "No"}</td>
      <td className="py-3 text-sm text-neutral-500">{description}</td>
    </tr>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-neutral-900 p-4 font-mono text-xs leading-relaxed text-neutral-100">
      {children}
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs text-neutral-800">{children}</code>;
}
