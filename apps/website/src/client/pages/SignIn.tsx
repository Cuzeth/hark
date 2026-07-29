import { useEffect } from "react";
import { useNavigate } from "react-router";
import { SignInForm } from "../components/SignInForm";
import { useSession } from "../lib/auth";

export function SignIn() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 items-center px-5 pb-20 sm:px-6">
        <section className="w-full rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-ink/5 sm:p-8 dark:shadow-none dark:ring-1 dark:ring-white/10">
          <div className="flex items-center gap-2.5">
            <img alt="" className="size-8 rounded-lg" src="/favicon.png" />
            <span className="text-lg font-semibold">Hark</span>
          </div>
          <h1 className="mt-5 mb-6 text-2xl font-semibold text-balance">Sign in</h1>
          <SignInForm
            disabled={isPending}
            onSignedIn={() => navigate("/dashboard", { replace: true })}
          />
        </section>
      </main>
    </div>
  );
}
