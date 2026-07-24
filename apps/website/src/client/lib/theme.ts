import { useCallback, useEffect, useState } from "react";

/**
 * Theme preference handling.
 *
 * `system` follows `prefers-color-scheme`; `light` and `dark` pin the theme and
 * persist to localStorage. The same storage key and resolution rules are
 * duplicated in the blocking inline script in index.html, which applies the
 * class before first paint to avoid a flash of the light theme. Keep the two in
 * sync — see THEME_STORAGE_KEY below.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "hark-theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

/** Kept in sync with `--color-paper` in index.css (light) and its `.dark` value. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  // The brand green the site has always used for browser chrome in light mode.
  light: "#035B49",
  dark: "#0f1115",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Private-mode Safari can throw on localStorage access.
    return "system";
  }
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return prefersDark() ? "dark" : "light";
  return preference;
}

/**
 * Applies the resolved theme to `<html>` and rewrites the theme-color meta tag.
 *
 * The static media-scoped meta tags in index.html only track the *system*
 * preference, so they are replaced with a single resolved tag. That way browser
 * chrome follows a manual override too.
 */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle("dark", resolved === "dark");

  for (const tag of document.querySelectorAll('meta[name="theme-color"]')) tag.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = THEME_COLOR[resolved];
  document.head.appendChild(meta);

  return resolved;
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference()),
  );

  useEffect(() => {
    setResolved(applyTheme(preference));
  }, [preference]);

  // Follow the OS while the preference is `system`.
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setResolved(applyTheme("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  // Keep other tabs in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setPreferenceState(readThemePreference());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory preference still applies.
    }
    setPreferenceState(next);
  }, []);

  return { preference, resolved, setPreference };
}
