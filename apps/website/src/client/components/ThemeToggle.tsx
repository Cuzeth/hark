import { type ThemePreference, useTheme } from "../lib/theme";

const ICON_CLASS = "size-4";

function SystemIcon() {
  return (
    <svg aria-hidden="true" className={ICON_CLASS} fill="none" viewBox="0 0 16 16">
      <rect
        height="8.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
        width="12"
        x="2"
        y="2.75"
      />
      <path d="M6 13.25h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg aria-hidden="true" className={ICON_CLASS} fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function DarkIcon() {
  return (
    <svg aria-hidden="true" className={ICON_CLASS} fill="none" viewBox="0 0 16 16">
      <path
        d="M13 9.86A5.6 5.6 0 0 1 6.14 3 5.6 5.6 0 1 0 13 9.86Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

const OPTIONS: { value: ThemePreference; label: string; Icon: () => React.ReactElement }[] = [
  { value: "system", label: "Match system theme", Icon: SystemIcon },
  { value: "light", label: "Light theme", Icon: LightIcon },
  { value: "dark", label: "Dark theme", Icon: DarkIcon },
];

/**
 * Three-state colour theme control: system / light / dark.
 *
 * A labelled group of toggle buttons rather than a single cycling button, so
 * every state is reachable in one keystroke and announced with its own pressed
 * state. Only colour and the press scale animate, and both are dropped under
 * `prefers-reduced-motion`.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset
      className={`border-line bg-surface inline-flex items-center gap-0.5 rounded-full border p-0.5 ${className}`}
    >
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            aria-label={label}
            aria-pressed={selected}
            className={`focus-visible:outline-accent grid size-9 place-items-center rounded-full transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${
              selected
                ? "bg-accent-soft text-accent-text"
                : "text-ink-faint hover:bg-surface-hover hover:text-ink-muted"
            }`}
            key={value}
            onClick={() => setPreference(value)}
            title={label}
            type="button"
          >
            <Icon />
          </button>
        );
      })}
    </fieldset>
  );
}
