const IOS_APP_DOWNLOAD_URL = "https://testflight.apple.com/join/PjCnKETB";

export function AppDownloadBanner() {
  return (
    <a
      href={IOS_APP_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-8 flex items-center gap-3.5 rounded-2xl border border-[#1D8AF4] bg-white p-4 shadow-xs transition hover:bg-[#1D8AF4]/4"
    >
      <img
        src="/app-store-icon.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-[10px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Hark for iPhone is ready to test</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">
          Install the latest test build on your phone to receive notifications.
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-sm font-medium text-[#1D8AF4] transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}
