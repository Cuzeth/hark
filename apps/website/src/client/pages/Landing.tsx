import { Link } from "react-router";
import { GoogleButton } from "../components/GoogleButton";
import { ThemeToggle } from "../components/ThemeToggle";
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
          <Link className="text-ink-subtle hover:text-ink text-sm transition" to="/docs">
            Docs
          </Link>
          {session ? (
            <Link
              to="/dashboard"
              className="bg-accent hover:bg-accent-hover text-on-accent rounded-full px-4 py-2 text-sm font-medium transition"
            >
              Open dashboard
            </Link>
          ) : null}
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-6 pb-24 text-left">
        <h1 className="max-w-2xl text-4xl font-semibold text-balance sm:text-5xl">
          POST a webhook. Get a beautiful iOS notification.
        </h1>
        <p className="text-ink-subtle mt-5 max-w-xl text-base leading-relaxed text-pretty">
          Create a service, copy its secret webhook URL, and every POST becomes a source-branded
          communication notification on your iPhone — with your service's name and avatar.
        </p>
        <div className="border-media-line mt-8 w-full overflow-hidden rounded-2xl border bg-black">
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
              className="bg-accent hover:bg-accent-hover text-on-accent rounded-full px-6 py-3 text-sm font-medium transition"
            >
              Go to your services
            </Link>
          ) : (
            <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
          )}
        </div>
      </main>

      <footer className="text-ink-faint mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 text-xs">
        <span>Hark · webhook → iPhone, nothing else in between.</span>
        <nav className="flex items-center gap-3" aria-label="Legal">
          <Link className="hover:text-ink-muted transition" to="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-ink-muted transition" to="/terms">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}
