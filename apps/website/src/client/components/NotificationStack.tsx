import { useEffect, useRef, useState } from "react";
import { NotificationCard } from "./NotificationCard";

export interface NotificationItem {
  title: string;
  image: string;
  description: string;
  /** Optional destination; the card becomes a link (untabbable in the stack). */
  link?: string;
}

interface Props {
  /** Arrival order; the last item ends up on top of the stack. */
  items: NotificationItem[];
  /** Milliseconds between arrivals during the load-in sequence. */
  interval?: number;
}

/**
 * iOS-style notification load-in. The first card is present on load; each
 * following card scales up from behind the top of the stack while the cards
 * already there bump down one full row. Once every message has arrived the
 * stack stays put — nothing cycles out.
 *
 * Descriptions wrap, so card heights vary: each card is measured and row
 * offsets are accumulated from real heights. Row position lives on the
 * wrapper as an inline `translate` (transitioned in CSS); the entry pop
 * (scale + drift + fade) lives on an inner element via `@starting-style`, so
 * the two animations never fight over one property.
 *
 * The newest card gets the LOWEST z-index: while it scales up in the top
 * slot, the card it replaces slides down across it, so the arrival reads as
 * emerging from behind. Settled cards don't overlap, so paint order doesn't
 * matter at rest.
 *
 * Wrappers never animate `opacity` or `filter`: an ancestor with opacity
 * below 1 becomes a backdrop root, which cuts the cards' `backdrop-filter`
 * off from the page and makes the glass snap in when the fade ends. The
 * entry fade is a paper-coloured overlay INSIDE the card wrapper instead —
 * it sits above the card, so its opacity never isolates the glass, and
 * fading from the page colour reads as the card materialising.
 *
 * Under reduced motion every card renders immediately in its settled
 * position.
 */
const GAP = 12;
const FALLBACK_HEIGHT = 98;

const EASING = "duration-[550ms] ease-[cubic-bezier(0.3,1.15,0.35,1)]";

export function NotificationStack({ items, interval = 1600 }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(items.length > 0 ? 1 : 0);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const cardRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      if (query.matches) setVisible(items.length);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [items.length]);

  useEffect(() => {
    if (reducedMotion || visible >= items.length) return;
    const timer = setTimeout(
      () => setVisible((previous) => Math.min(previous + 1, items.length)),
      interval,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion, visible, items.length, interval]);

  const stack = items
    .slice(0, visible)
    .map((item, index) => ({ key: index, item }))
    .reverse();

  // One observer measures every card: the initial observation fires before
  // paint, and later ones track wrapping changes as the viewport resizes.
  const observerRef = useRef<ResizeObserver | null>(null);
  const getObserver = () => {
    observerRef.current ??= new ResizeObserver(() => {
      setHeights((previous) => {
        let changed = false;
        const next = { ...previous };
        for (const [key, element] of cardRefs.current) {
          const height = element.offsetHeight;
          if (height > 0 && next[key] !== height) {
            next[key] = height;
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    });
    return observerRef.current;
  };

  useEffect(() => () => observerRef.current?.disconnect(), []);

  let offset = 0;
  const rows = stack.map(({ key, item }, slot) => {
    const row = { key, item, slot, offset };
    offset += (heights[key] ?? FALLBACK_HEIGHT) + GAP;
    return row;
  });
  const totalHeight = Math.max(offset - GAP, 0);

  return (
    <div
      aria-hidden="true"
      className={`relative w-full max-w-[559px] transition-[height] ${EASING}`}
      style={{ height: totalHeight }}
    >
      {rows.map(({ key, item, slot, offset: rowOffset }) => (
        <div
          key={key}
          ref={(element) => {
            if (element) {
              cardRefs.current.set(key, element);
              getObserver().observe(element);
            } else {
              const previous = cardRefs.current.get(key);
              if (previous) observerRef.current?.unobserve(previous);
              cardRefs.current.delete(key);
            }
          }}
          className={`absolute inset-x-0 top-0 transition-[translate] ${EASING}`}
          style={{ translate: `0 ${rowOffset}px`, zIndex: slot * 10 }}
        >
          <div
            className={`relative transition-[translate,scale] ${EASING} ${
              key === 0 || reducedMotion ? "" : "starting:translate-y-3 starting:scale-90"
            }`}
          >
            <NotificationCard {...item} tabIndex={-1} />
            <span
              className={`pointer-events-none absolute inset-0 rounded-[24px] bg-paper opacity-0 transition-opacity sm:rounded-[31px] ${EASING} ${
                key === 0 || reducedMotion ? "" : "starting:opacity-100"
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
