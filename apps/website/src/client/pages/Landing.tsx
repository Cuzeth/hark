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
        <p className="border-accent/20 bg-accent-soft text-accent mb-4 rounded-full border px-3 py-1 text-xs font-medium">
          iOS notifications for anything with a webhook
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold text-balance sm:text-5xl">
          POST a webhook. Get a beautiful iOS notification.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-500 text-pretty">
          Create a service, copy its secret webhook URL, and every POST becomes a source-branded
          communication notification on your iPhone — with your service's name and avatar.
        </p>
        <div className="mt-10">
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
        <pre className="mt-14 w-full max-w-xl overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-5 text-left font-mono text-[13px] leading-relaxed text-neutral-700 shadow-xs">
          {`curl -X POST https://hark.ryan.ceo/hooks/whk_… \\
  -H 'Content-Type: application/json' \\
  -d '{ "body": "Deploy finished ✅" }'`}
        </pre>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-6 py-6 text-xs text-neutral-400">
        Hark · webhook → iPhone, nothing else in between.
      </footer>
    </div>
  );
}
