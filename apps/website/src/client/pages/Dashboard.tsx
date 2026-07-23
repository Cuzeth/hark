import type { EventDto, ServiceCreatedResponse, ServiceDto } from "@hark/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CopyField } from "../components/CopyField";
import { api } from "../lib/api";
import { signOut, useSession } from "../lib/auth";

function curlExample(webhookUrl: string): string {
  return [
    `curl -X POST ${webhookUrl} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Idempotency-Key: unique-event-id' \\`,
    `  -d '{ "body": "Deploy finished ✅" }'`,
  ].join("\n");
}

function agentPrompt(webhookUrl: string): string {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
        description: "Notification message body.",
      },
      title: {
        type: "string",
        minLength: 1,
        maxLength: 80,
        description: "Optional sender title. Overrides the service default.",
      },
      imageUrl: {
        type: "string",
        format: "uri",
        pattern: "^https://",
        maxLength: 2048,
        description: "Optional avatar URL. Overrides the service default.",
      },
      url: {
        type: "string",
        format: "uri",
        maxLength: 2048,
        description: "Optional destination opened when the notification is tapped.",
      },
    },
  };

  return [
    "Configure an integration that sends notifications through this Hark webhook.",
    "",
    `Webhook endpoint: ${webhookUrl}`,
    "Method: POST",
    "Header: Content-Type: application/json",
    "",
    "Payload JSON Schema:",
    JSON.stringify(schema, null, 2),
    "",
    "Minimal test request:",
    curlExample(webhookUrl),
    "",
    "Use body for the notification message. title, imageUrl, and url are optional per-request overrides of the service defaults.",
  ].join("\n");
}

export function Dashboard() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceDto[] | null>(null);
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<
    (ServiceCreatedResponse & { kind: "created" | "rotated" }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [svc, dev, activity] = await Promise.all([
        api.listServices(),
        api.listDevices(),
        api.listEvents(),
      ]);
      setServices(svc.services);
      setDeviceCount(dev.devices.filter((d) => d.active).length);
      setEvents(activity.events);
    } catch {
      setError("Could not load your services. Are you signed in?");
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const activity = await api.listEvents();
      setEvents(activity.events);
    } catch {
      // Keep the last successful activity snapshot visible.
    }
  }, []);

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/", { replace: true });
      return;
    }
    if (session) void refresh();
  }, [session, isPending, navigate, refresh]);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => void refreshActivity(), 10_000);
    return () => window.clearInterval(interval);
  }, [session, refreshActivity]);

  if (isPending || !session) {
    return <div className="flex min-h-dvh items-center justify-center text-neutral-400">…</div>;
  }

  return (
    <div className="min-h-dvh">
      <header>
        <div className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-6">
          <Link to="/" className="text-lg font-semibold">
            Hark
          </Link>
          <div className="flex items-center gap-3">
            <Link className="text-sm text-neutral-500 transition hover:text-neutral-900" to="/docs">
              Docs
            </Link>
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="size-7 rounded-full border border-neutral-200"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <span className="hidden text-sm text-neutral-500 sm:block">{session.user.email}</span>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate("/"))}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Services</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {deviceCount === null
                ? "Each service gets a secret webhook URL."
                : deviceCount === 0
                  ? "No iPhone registered yet — sign in inside the Hark app to receive notifications."
                  : `Delivering to ${deviceCount} registered ${deviceCount === 1 ? "iPhone" : "iPhones"}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-accent hover:bg-accent-hover rounded-full px-4 py-2 text-sm font-medium text-white transition"
          >
            New service
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {reveal ? <WebhookReveal reveal={reveal} onDismiss={() => setReveal(null)} /> : null}

        {creating ? (
          <CreateServiceModal
            onCancel={() => setCreating(false)}
            onCreated={(response) => {
              setCreating(false);
              setReveal({ ...response, kind: "created" });
              void refresh();
            }}
          />
        ) : null}

        <ServiceList
          services={services}
          onRotated={(response) => setReveal({ ...response, kind: "rotated" })}
          onDeleted={() => void refresh()}
        />

        <ActivityLog events={events} onRefresh={refreshActivity} />
      </main>
    </div>
  );
}

function WebhookReveal({
  reveal,
  onDismiss,
}: {
  reveal: ServiceCreatedResponse & { kind: "created" | "rotated" };
  onDismiss: () => void;
}) {
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);

  useEffect(() => {
    if (!agentPromptCopied) return;
    const timeout = window.setTimeout(() => setAgentPromptCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [agentPromptCopied]);

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPrompt(reveal.webhookUrl));
      setAgentPromptCopied(true);
    } catch {
      // Clipboard access can be unavailable outside a secure context.
    }
  };

  return (
    <section className="mb-10">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-accent text-sm font-semibold">
          {reveal.kind === "created"
            ? `“${reveal.service.title}” is ready`
            : `New webhook URL for “${reveal.service.title}”`}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="text-accent text-xs font-medium underline-offset-2 hover:underline"
        >
          Done
        </button>
      </div>
      <p className="text-accent mb-4 text-xs">
        This URL is shown once — Hark stores only a hash of the token. Copy it now.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <CopyField label="Webhook URL" value={reveal.webhookUrl} />
        </div>
        <button
          type="button"
          onClick={copyAgentPrompt}
          className="bg-accent hover:bg-accent-hover shrink-0 self-start rounded-full px-4 py-2 text-sm font-medium text-white transition sm:self-auto"
        >
          {agentPromptCopied ? "Agent prompt copied" : "Copy agent prompt"}
        </button>
      </div>
    </section>
  );
}

function CreateServiceModal({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (response: ServiceCreatedResponse) => void;
}) {
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(
    (afterClose: () => void = onCancel) => {
      if (closing) return;
      setClosing(true);
      window.setTimeout(afterClose, 120);
    },
    [closing, onCancel],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, close]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api.createService({
        title: title.trim(),
        imageUrl: imageUrl.trim() || null,
        url: url.trim() || null,
      });
      close(() => onCreated(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "focus:border-accent w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-sm";

  return (
    <div className={`hark-modal-backdrop ${closing ? "is-closing" : ""}`}>
      <button
        aria-label="Close new service dialog"
        className="hark-modal-dismiss"
        disabled={busy}
        onClick={() => close()}
        type="button"
      />
      <form
        aria-labelledby="create-service-title"
        aria-modal="true"
        className="hark-modal-panel"
        onSubmit={submit}
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h2 id="create-service-title" className="text-lg font-semibold">
              New service
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Set the defaults for this webhook.</p>
          </div>
          <button
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full text-xl leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            disabled={busy}
            onClick={() => close()}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">
              Title (sender name)
            </span>
            <input
              className={inputClass}
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acme CRM"
              maxLength={80}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">
              Avatar image URL <span className="font-normal">(optional)</span>
            </span>
            <input
              className={inputClass}
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">
              Destination URL <span className="font-normal">(optional, opened on tap)</span>
            </span>
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/dashboard"
            />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => close()}
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || title.trim().length === 0}
            className="bg-accent hover:bg-accent-hover rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create service"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ActivityLog({
  events,
  onRefresh,
}: {
  events: EventDto[] | null;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="mt-16" aria-labelledby="activity-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold">
            Activity
          </h2>
          <p className="mt-1 text-sm text-neutral-500">Latest webhook delivery attempts.</p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          Refresh
        </button>
      </div>

      {events === null ? <p className="py-6 text-sm text-neutral-400">Loading activity…</p> : null}
      {events?.length === 0 ? (
        <p className="border-t border-neutral-200 py-8 text-sm text-neutral-400">
          No webhook activity yet.
        </p>
      ) : null}
      {events && events.length > 0 ? (
        <ol className="divide-y divide-neutral-200 border-y border-neutral-200">
          {events.map((activityEvent) => (
            <li className="flex gap-2.5 py-3" key={activityEvent.id}>
              <ActivityAvatar activityEvent={activityEvent} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="truncate text-sm leading-5 font-medium">
                    {activityEvent.serviceTitle} · {activityEvent.title}
                  </p>
                  <time
                    className="shrink-0 text-xs text-neutral-400"
                    dateTime={activityEvent.createdAt}
                    title={new Date(activityEvent.createdAt).toLocaleString()}
                  >
                    {new Date(activityEvent.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-0.5 truncate text-xs leading-4 text-neutral-500">
                  {activityEvent.body}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-400">
                  {activityLabel(activityEvent)}
                  {activityEvent.error ? ` · ${activityEvent.error}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "accepted" || status === "delivered"
      ? "bg-accent"
      : status === "failed"
        ? "bg-red-500"
        : status === "partial"
          ? "bg-amber-500"
          : status === "processing"
            ? "bg-blue-500"
            : "bg-neutral-300";
  return <span className={`${color} size-2 rounded-full`} aria-hidden="true" />;
}

function ActivityAvatar({ activityEvent }: { activityEvent: EventDto }) {
  return (
    <span className="relative size-8 shrink-0">
      {activityEvent.imageUrl ? (
        <img
          alt=""
          className="size-8 rounded-full border border-neutral-200 object-cover"
          src={activityEvent.imageUrl}
        />
      ) : (
        <span className="bg-accent-soft text-accent grid size-8 place-items-center rounded-full text-xs font-medium">
          {activityEvent.serviceTitle.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-white">
        <StatusDot status={activityEvent.status} />
      </span>
    </span>
  );
}

function activityLabel(activityEvent: EventDto): string {
  if (activityEvent.status === "accepted" || activityEvent.status === "delivered") {
    return `Accepted for ${activityEvent.deliveredCount} ${activityEvent.deliveredCount === 1 ? "device" : "devices"}`;
  }
  if (activityEvent.status === "partial") {
    return `Partially accepted for ${activityEvent.deliveredCount} devices`;
  }
  if (activityEvent.status === "no_devices") return "No active devices";
  if (activityEvent.status === "processing") return "Processing";
  return "Failed";
}

function ServiceList({
  services,
  onRotated,
  onDeleted,
}: {
  services: ServiceDto[] | null;
  onRotated: (response: ServiceCreatedResponse) => void;
  onDeleted: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (services === null) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading…</div>;
  }
  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 py-14 text-center">
        <p className="text-sm font-medium text-neutral-600">No services yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-400">
          Create your first service to get a secret webhook URL you can POST to from CI, cron jobs,
          or anything else.
        </p>
      </div>
    );
  }

  const rotate = async (svc: ServiceDto) => {
    if (
      !window.confirm(
        `Rotate the webhook token for “${svc.title}”? The old URL stops working immediately.`,
      )
    ) {
      return;
    }
    setBusyId(svc.id);
    try {
      onRotated(await api.rotateServiceToken(svc.id));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (svc: ServiceDto) => {
    if (!window.confirm(`Delete “${svc.title}”? Its webhook URL stops working immediately.`)) {
      return;
    }
    setBusyId(svc.id);
    try {
      await api.deleteService(svc.id);
      onDeleted();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="space-y-3">
      {services.map((svc) => (
        <li
          key={svc.id}
          className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs"
        >
          {svc.imageUrl ? (
            <img
              src={svc.imageUrl}
              alt=""
              className="size-10 shrink-0 rounded-full border border-neutral-200 object-cover"
            />
          ) : (
            <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
              {svc.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{svc.title}</p>
            <p className="truncate text-xs text-neutral-400">
              {svc.url ?? "No destination URL"} · created{" "}
              {new Date(svc.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busyId === svc.id}
              onClick={() => void rotate(svc)}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              Rotate token
            </button>
            <button
              type="button"
              disabled={busyId === svc.id}
              onClick={() => void remove(svc)}
              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
