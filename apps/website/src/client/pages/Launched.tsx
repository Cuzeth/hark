import { Link } from "react-router";

const APP_STORE_URL = "https://apps.apple.com/us/app/hark-developer-notifications/id6794121509";
const SUPPORT_EMAIL = "hark@ryan.ceo";

export function Launched() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-6">
        <Link to="/" className="text-lg font-semibold">
          Hark
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink-subtle" aria-label="Primary">
          <Link className="transition-colors hover:text-ink" to="/docs">
            Docs
          </Link>
          <Link className="transition-colors hover:text-ink" to="/">
            Home
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-24">
        <article className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">
            Hark for iPhone
          </p>
          <h1 className="max-w-xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Hark is live on the App Store.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-pretty text-ink-subtle">
            Everyone can now install Hark, or update to the latest release, directly from the App
            Store.
          </p>
          <p className="mt-4 text-sm text-ink-faint">
            Published <time dateTime="2026-08-01">August 1, 2026</time>
          </p>

          <section className="mt-10 rounded-[28px] bg-surface-muted p-3 shadow-[0_18px_50px_rgba(0,0,0,0.10)] ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex flex-col gap-5 rounded-2xl bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <img
                  alt="Hark app icon"
                  className="size-16 shrink-0 rounded-[15px] ring-1 ring-black/10 dark:ring-white/10"
                  height={64}
                  src="/app-store-icon.png"
                  width={64}
                />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">Hark</h2>
                  <p className="mt-1 text-sm leading-relaxed text-pretty text-ink-subtle">
                    Developer notifications, approvals, and Live Activities on your iPhone.
                  </p>
                </div>
              </div>
              <a
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent transition-[background-color,scale] hover:bg-accent-hover active:scale-[0.96]"
                href={APP_STORE_URL}
                rel="noreferrer"
                target="_blank"
              >
                Open in App Store
              </a>
            </div>
          </section>

          <div className="mt-12 space-y-8 text-base leading-relaxed text-ink-muted">
            <section>
              <h2 className="text-lg font-semibold text-ink">Already have Hark?</h2>
              <p className="mt-2 max-w-xl text-pretty">
                Update to the App Store version to keep receiving future Hark updates and fixes.
                Open the App Store page and tap{" "}
                <strong className="font-semibold text-ink">Update</strong>. If you installed a
                TestFlight build, move to the public release from the same link.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-ink">Support what comes next</h2>
              <p className="mt-2 max-w-xl text-pretty">
                Upgrade to Hark Pro to support continued development and unlock webhook-powered Live
                Activities, richer approval and response workflows, callbacks, and device routing.{" "}
                <Link
                  className="font-medium text-accent-text underline underline-offset-4"
                  to="/pricing"
                >
                  See Hark Pro
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-ink">Something not working?</h2>
              <p className="mt-2 max-w-xl text-pretty">
                Email{" "}
                <a
                  className="font-medium text-accent-text underline decoration-from-font underline-offset-4"
                  href={`mailto:${SUPPORT_EMAIL}?subject=Hark%20App%20Store%20help`}
                >
                  {SUPPORT_EMAIL}
                </a>
                . Include your iOS version and what you expected to happen, but never send a Hark
                token or webhook URL.
              </p>
            </section>
          </div>
        </article>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 text-xs text-ink-faint">
        <span>Hark · webhook → iPhone.</span>
        <nav className="flex items-center gap-3" aria-label="Legal">
          <Link className="transition-colors hover:text-ink-muted" to="/privacy">
            Privacy
          </Link>
          <Link className="transition-colors hover:text-ink-muted" to="/terms">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}
