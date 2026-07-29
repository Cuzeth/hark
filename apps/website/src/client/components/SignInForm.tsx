import { useState } from "react";
import { signInWithUsername } from "../lib/auth";

const inputClass =
  "focus:border-accent w-full rounded-lg border border-line-strong bg-field px-3 py-2 text-base text-ink placeholder:text-ink-faint focus:outline-none sm:text-sm";

export function SignInForm({
  disabled,
  onSignedIn,
}: {
  disabled?: boolean;
  onSignedIn?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithUsername(username.trim(), password);
      if (result.error) {
        setError(result.error.message ?? "Could not sign in");
        return;
      }
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-subtle">Username</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className={inputClass}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-subtle">Password</span>
        <input
          autoComplete="current-password"
          className={inputClass}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <button
        className="bg-accent hover:bg-accent-hover min-h-11 w-full rounded-full px-5 text-sm font-semibold text-on-accent transition disabled:opacity-50"
        disabled={busy || disabled || username.trim().length === 0 || password.length === 0}
        type="submit"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <div className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
    </form>
  );
}
