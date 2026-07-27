import { Link } from "react-router";
import { AppleButton } from "../components/AppleButton";
import { GoogleButton } from "../components/GoogleButton";
import { type NotificationItem, NotificationStack } from "../components/NotificationStack";
import { signInWithApple, signInWithGoogle, useSession } from "../lib/auth";

const welcomeNotifications: NotificationItem[] = [
  {
    title: "Welcome to Hark",
    image: "/welcome.svg",
    description: "Hark makes it easy to notify yourself of your own services.",
  },
  {
    title: "Webhooks & agents",
    image: "/agent.png",
    description: "Use webhooks or an agent to send custom messages.",
  },
  {
    title: "Make it yours",
    image: "https://pbs.twimg.com/profile_images/2070959207273082880/HZoVBuA2_400x400.jpg",
    description: "Custom titles, images, and descriptions.",
  },
  {
    title: "Get started",
    image: "/get-started.svg",
    description: "Click here to get started.",
    link: "/docs",
  },
];

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
          <Link className="text-ink-subtle hover:text-ink text-sm transition" to="/pricing">
            Pricing
          </Link>
          {session ? (
            <Link
              to="/dashboard"
              className="bg-accent hover:bg-accent-hover text-on-accent rounded-full px-4 py-2 text-sm font-medium transition"
            >
              Open dashboard
            </Link>
          ) : null}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6">
        <p className="sr-only">
          Welcome to Hark. Hark makes it easy to notify yourself of your own services. Use webhooks
          or an agent to send custom messages with custom titles, images, and descriptions. Sign in
          below to get started.
        </p>
        <div className="mt-6 flex justify-center">
          <NotificationStack items={welcomeNotifications} interval={800} />
        </div>
        {!session ? (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <AppleButton onClick={() => void signInWithApple()} disabled={isPending} />
            <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
