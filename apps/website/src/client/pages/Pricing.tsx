import type { PricingPlanDto, PricingPlansDto } from "@hark/contracts";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { GoogleButton } from "../components/GoogleButton";
import { api } from "../lib/api";
import { signInWithGoogle, useSession } from "../lib/auth";

const numberFormat = new Intl.NumberFormat("en-US");

/** Pro capabilities that are plan-gated in the API rather than metered in Autumn. */
const PRO_EXTRAS = ["Interactive responses", "Live Activities", "Response callbacks"];

export function Pricing() {
  const { data: session, isPending } = useSession();
  const [data, setData] = useState<PricingPlansDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getPricingPlans()
      .then((plans) => {
        if (!cancelled) setData(plans);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function upgrade() {
    setCheckoutError(null);
    setCheckoutPending(true);
    try {
      const { url } = await api.startCheckout();
      window.location.href = url;
    } catch {
      setCheckoutPending(false);
      setCheckoutError("Could not start checkout. Manage your plan from the dashboard instead.");
    }
  }

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
          <span aria-current="page" className="text-ink text-sm font-medium">
            Pricing
          </span>
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24">
        <h1 className="text-4xl font-semibold text-balance">Pricing</h1>
        <p className="text-ink-subtle mt-4 max-w-xl text-base leading-relaxed">
          Start free with one iPhone and 10,000 notifications a month. Upgrade when your webhooks
          outgrow it.
        </p>

        {failed ? (
          <p className="text-ink-subtle border-line mt-12 rounded-2xl border p-6 text-sm">
            Could not load plans right now. The current numbers are always listed in the{" "}
            <Link className="text-accent-text font-medium" to="/docs">
              docs
            </Link>
            .
          </p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {(data?.plans ?? [null, null]).map((plan, index) =>
              plan ? (
                <PlanCard key={plan.id} plan={plan}>
                  {plan.priceMonthly === 0 ? (
                    session ? (
                      <Link
                        to="/dashboard"
                        className="border-line text-ink hover:bg-surface-hover inline-flex rounded-full border px-5 py-2.5 text-sm font-medium transition"
                      >
                        Open dashboard
                      </Link>
                    ) : (
                      <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
                    )
                  ) : session ? (
                    <button
                      type="button"
                      onClick={() => void upgrade()}
                      disabled={checkoutPending}
                      className="bg-accent hover:bg-accent-hover text-on-accent inline-flex rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-50"
                    >
                      {checkoutPending ? "Opening checkout…" : "Upgrade to Pro"}
                    </button>
                  ) : (
                    <GoogleButton onClick={() => void signInWithGoogle()} disabled={isPending} />
                  )}
                </PlanCard>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static two-slot skeleton
                <div key={index} className="border-line h-80 animate-pulse rounded-2xl border" />
              ),
            )}
          </div>
        )}

        {checkoutError ? <p className="text-danger mt-4 text-sm">{checkoutError}</p> : null}

        <p className="text-ink-faint mt-10 text-xs">
          Prices in USD. Cancel anytime from the dashboard. Notifications, interactive responses,
          and Live Activity updates share the same monthly allowance.
        </p>
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

function PlanCard({ plan, children }: { plan: PricingPlanDto; children: React.ReactNode }) {
  const pro = plan.priceMonthly > 0;
  const rows = [
    plan.notificationsPerMonth === null
      ? "Unlimited notifications"
      : `${numberFormat.format(plan.notificationsPerMonth)} notifications per month`,
    plan.devices === null
      ? "Unlimited iPhones"
      : `${plan.devices} iPhone${plan.devices === 1 ? "" : "s"}`,
    `${numberFormat.format(plan.servicePerMinute)} requests/minute per service`,
    `${numberFormat.format(plan.accountPerMinute)} requests/minute per account`,
    ...(plan.deviceRouting ? ["Device routing"] : []),
    ...(pro ? PRO_EXTRAS : []),
  ];

  return (
    <section
      aria-label={`${plan.name} plan`}
      className={`flex flex-col rounded-2xl border p-6 ${
        pro ? "border-accent/40 bg-accent-wash" : "border-line"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{plan.name}</h2>
        <p className="text-ink">
          <span className="text-2xl font-semibold">${plan.priceMonthly}</span>
          <span className="text-ink-subtle text-sm"> / month</span>
        </p>
      </div>
      {plan.description ? (
        <p className="text-ink-subtle mt-2 text-sm leading-relaxed">{plan.description}</p>
      ) : null}
      <ul className="mt-5 flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row} className="text-ink-muted flex items-baseline gap-2.5 text-sm">
            <span aria-hidden="true" className="text-accent-text text-xs">
              ✓
            </span>
            {row}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-1 items-end">{children}</div>
    </section>
  );
}
