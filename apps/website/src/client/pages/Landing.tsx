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

const showNotificationMock = false;

export function Landing() {
  const { data: session, isPending } = useSession();

  return (
    <div className="hark-landing flex min-h-dvh flex-col">
      <div className="hark-landing-ambient" aria-hidden="true" />
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-1.5 text-lg font-semibold">
          <span aria-hidden="true" className="size-[18px] rounded-[5px] bg-[#035B49]" />
          <span>Hark</span>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <div className="grid items-center gap-y-8 pt-10 pb-10 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[auto_auto] lg:justify-center lg:gap-x-24 lg:pt-0 lg:pb-0">
          <section className="lg:max-w-md">
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              From webhook to lock screen.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-pretty text-ink-subtle sm:text-lg">
              Hark turns events from webhooks, coding agents, scripts, and CI into native iPhone
              notifications and Live Activities.
            </p>
            {!session ? (
              <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
                <AppleButton onClick={() => void signInWithApple()} disabled={isPending} />
                <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
              </div>
            ) : null}
          </section>
          <div className="flex justify-center">
            {showNotificationMock ? (
              <NotificationStack items={welcomeNotifications} interval={800} />
            ) : (
              <div className="hark-demo-stage" aria-hidden="true">
                <video
                  className="hark-demo-video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                >
                  <source src="/hark-demo.mov?v=2" type='video/quicktime; codecs="hvc1"' />
                  <source src="/hark-demo.webm?v=2" type='video/webm; codecs="vp9"' />
                </video>
              </div>
            )}
          </div>
          {!session ? (
            <div className="flex flex-wrap justify-center gap-3 lg:hidden">
              <AppleButton onClick={() => void signInWithApple()} disabled={isPending} />
              <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
