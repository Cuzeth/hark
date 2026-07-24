import { Link } from "react-router";
import { GoogleButton } from "../components/GoogleButton";
import { signInWithGoogle, useSession } from "../lib/auth";

export function Landing() {
  const { data: session, isPending } = useSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-6">
        <Link to="/" className="text-lg font-semibold">
          Hark
        </Link>
        <nav className="flex items-center gap-4" aria-label="Primary">
          <Link className="text-sm text-neutral-500 transition hover:text-neutral-900" to="/docs">
            Docs
          </Link>
          {session ? (
            <Link
              to="/dashboard"
              className="bg-accent hover:bg-accent-hover rounded-full px-4 py-2 text-sm font-medium text-white transition"
            >
              Open dashboard
            </Link>
          ) : null}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-6 pb-24 text-left">
        <h1 className="max-w-2xl text-4xl font-semibold text-balance sm:text-5xl">
          POST a webhook. Get a beautiful iOS notification.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-500 text-pretty">
          Create a service, copy its secret webhook URL, and every POST becomes a source-branded
          communication notification on your iPhone — with your service's name and avatar.
        </p>
        <div className="mt-8 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-black">
          <video
            aria-label="A demonstration of Hark delivering project notifications to an iPhone"
            autoPlay
            className="pointer-events-none aspect-video w-full"
            disablePictureInPicture
            loop
            muted
            playsInline
            poster="/notifications-demo-poster.jpg"
            preload="metadata"
          >
            <source src="/notifications-demo.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="mt-8">
          {session ? (
            <Link
              to="/dashboard"
              className="bg-accent hover:bg-accent-hover rounded-full px-6 py-3 text-sm font-medium text-white transition"
            >
              Go to your services
            </Link>
          ) : (
            <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
          )}
        </div>
        <section
          className="mt-20 w-full border-t border-neutral-200 pt-8"
          aria-labelledby="pricing-heading"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-accent text-xs font-medium uppercase">Pricing</p>
              <h2 id="pricing-heading" className="mt-2 text-2xl font-semibold">
                Start free. Route more with Pro.
              </h2>
            </div>
            <span className="text-xs text-neutral-400">Powered by Autumn</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="text-sm font-semibold">Free</p>
              <p className="mt-2 text-3xl font-semibold">$0</p>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                One iPhone, 10,000 notifications per month, and 60 requests per minute per service.
              </p>
            </div>
            <div className="border-accent rounded-2xl border bg-white p-5">
              <p className="text-accent text-sm font-semibold">Pro</p>
              <p className="mt-2 text-3xl font-semibold">
                $8<span className="text-sm font-normal text-neutral-400">/month</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Multiple iPhones, targeted routing, 100,000 notifications, and 5× higher rate
                limits.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 text-xs text-neutral-400">
        <span>Hark · webhook → iPhone, nothing else in between.</span>
        <nav className="flex items-center gap-3" aria-label="Legal">
          <Link className="transition hover:text-neutral-700" to="/privacy">
            Privacy
          </Link>
          <Link className="transition hover:text-neutral-700" to="/terms">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}
