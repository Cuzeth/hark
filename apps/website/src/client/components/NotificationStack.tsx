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
 * following card becomes the front of a compact deck while the cards already
 * there shift down and scale back enough to leave their edges visible. Once
 * every message has arrived the stack stays put — nothing cycles out.
 *
 * Descriptions wrap, so card heights vary: each card is measured and the deck
 * height follows the furthest visible card edge. Deck position and depth live
 * on the wrapper as inline `translate` and `scale` values; the entry pop lives
 * on an inner element via `@starting-style`, so the animations never fight
 * over one property.
 *
 * The newest card gets the highest z-index and remains fully readable. Older
 * cards recede behind it in arrival order.
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
const STACK_PEEK = 8;
const STACK_SCALE_STEP = 0.018;
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

  const front = stack[0];
  const frontHeight = front ? (heights[front.key] ?? FALLBACK_HEIGHT) : 0;
  const rows = stack.map(({ key, item }, slot) => {
    const height = heights[key] ?? FALLBACK_HEIGHT;
    const scale = Math.max(1 - slot * STACK_SCALE_STEP, 0.946);
    return {
      key,
      item,
      slot,
      scale,
      offset: slot === 0 ? 0 : frontHeight + slot * STACK_PEEK - height * scale,
    };
  });
  const totalHeight = frontHeight + Math.max(rows.length - 1, 0) * STACK_PEEK + 2;

  return (
    <div
      aria-hidden="true"
      className={`relative w-full max-w-[559px] overflow-hidden transition-[height] ${EASING}`}
      style={{ height: totalHeight }}
    >
      {rows.map(({ key, item, slot, offset: rowOffset, scale }) => (
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
          className={`absolute inset-x-0 top-0 transition-[translate,scale,clip-path] ${EASING}`}
          style={{
            translate: `0 ${rowOffset}px`,
            scale,
            clipPath:
              slot === 0
                ? undefined
                : `inset(calc(100% - ${STACK_PEEK / scale}px) 0 0 round 0 0 31px 31px)`,
            transformOrigin: "top center",
            zIndex: visible - slot,
          }}
        >
          <div
            className={`relative transition-[translate,scale] ${EASING} ${
              key === 0 || reducedMotion ? "" : "starting:translate-y-3 starting:scale-90"
            }`}
          >
            <NotificationCard {...item} tabIndex={-1} concealed={slot > 0} />
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
