const IOS_APP_DOWNLOAD_URL =
  "https://apps.apple.com/us/app/hark-developer-notifications/id6794121509";

export function AppDownloadBanner() {
  return (
    <a
      href={IOS_APP_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-8 flex items-center gap-3.5 rounded-2xl border border-brand-blue bg-surface p-4 shadow-xs transition hover:bg-brand-blue/5"
    >
      <img
        src="/app-store-icon.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-[10px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Hark for iPhone is now available</span>
        <span className="mt-0.5 block truncate text-xs text-ink-subtle">
          Download it from the App Store to receive notifications.
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-sm font-medium text-brand-blue transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}
