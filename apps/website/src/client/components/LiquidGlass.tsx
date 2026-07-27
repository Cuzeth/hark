import { type CSSProperties, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * Liquid-glass backdrop, layered the way the reference implementations are
 * (lucasromerodb's viral recreation, kube.io's physics writeup, Aave Glass):
 *
 *   1. effect — `backdrop-filter` blur/saturate, plus SVG rim displacement
 *      with a slight chromatic split on Chromium
 *   2. tint  — translucent colour wash (passed in via `className`)
 *   3. shine — specular bevel: bright inset glints toward the light
 *   4. the parent's content renders above
 *
 * The displacement map is a rounded-rect SDF whose magnitude follows a
 * convex-bezel profile — bending concentrated hard at the outer edge and
 * fading quickly inward — so the middle stays flat like real curved glass.
 * R encodes X displacement, G encodes Y. Maps are cached per geometry at
 * module level, and all state settles in layout effects, so a card that
 * mounts mid-animation paints with its final filter on the first frame —
 * no blur pop while it enters. The blur radius is identical with and
 * without refraction for the same reason.
 *
 * Safari never renders SVG reference filters in `backdrop-filter` (WebKit bug
 * 245510) and Firefox rejects arbitrary graphs; neither failure is detectable
 * with `CSS.supports()`, so refraction is gated on positive Blink detection.
 * Those engines keep the blur, tint, and specular layers, which carry most of
 * the look.
 */

const NEUTRAL = 128;

function buildDisplacementMap(
  cssWidth: number,
  cssHeight: number,
  radius: number,
  depth: number,
  dpr: number,
): string | null {
  const w = Math.max(2, Math.round(cssWidth * dpr));
  const h = Math.max(2, Math.round(cssHeight * dpr));
  const rim = Math.max(1, depth * dpr);
  const r = Math.min(radius * dpr, w / 2, h / 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(w, h);
  const data = image.data;
  const halfW = w / 2;
  const halfH = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Signed distance from the pixel centre to the rounded-rect edge
      // (negative inside), plus the outward normal of the nearest edge.
      const px = x + 0.5 - halfW;
      const py = y + 0.5 - halfH;
      const qx = Math.abs(px) - (halfW - r);
      const qy = Math.abs(py) - (halfH - r);
      const cx = Math.max(qx, 0);
      const cy = Math.max(qy, 0);
      const outer = Math.hypot(cx, cy);
      const d = Math.min(Math.max(qx, qy), 0) + outer - r;

      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        nx = (outer > 0 ? cx / outer : 0) * Math.sign(px);
        ny = (outer > 0 ? cy / outer : 0) * Math.sign(py);
      } else if (qx > qy) {
        nx = Math.sign(px);
      } else {
        ny = Math.sign(py);
      }

      // Convex-bezel falloff: t is 1 at the edge and 0 where the bezel meets
      // the flat centre. Raising the smoothstep to a power concentrates the
      // bend at the outer edge like a lens, instead of a uniform smear.
      let mag = 0;
      if (d <= 0) {
        const t = Math.min(Math.max(1 + d / rim, 0), 1);
        const smooth = t * t * (3 - 2 * t);
        mag = smooth ** 1.8;
      }

      const i = (y * w + x) * 4;
      data[i] = Math.round(NEUTRAL + nx * mag * 127);
      data[i + 1] = Math.round(NEUTRAL + ny * mag * 127);
      data[i + 2] = NEUTRAL;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/**
 * Stack cards share one geometry, so after the first card every mount gets
 * its map synchronously from this cache — inside a layout effect, before the
 * entering card ever paints.
 */
const mapCache = new Map<string, string | null>();

function getDisplacementMap(
  cssWidth: number,
  cssHeight: number,
  radius: number,
  depth: number,
): string | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const key = `${cssWidth}x${cssHeight}:${radius}:${depth}:${dpr}`;
  let url = mapCache.get(key);
  if (url === undefined) {
    if (mapCache.size > 24) mapCache.clear();
    url = buildDisplacementMap(cssWidth, cssHeight, radius, depth, dpr);
    mapCache.set(key, url);
  }
  return url;
}

function isBlinkEngine(): boolean {
  const data = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string }[] };
    }
  ).userAgentData;
  return data?.brands?.some((entry) => entry.brand === "Chromium") ?? false;
}

const CHANNEL_MATRICES = {
  R: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  G: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  B: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
};

/** Symmetric chromatic spread: R fringes out, B in, G stays at the base. */
const ABERRATION = 0.06;

interface Props {
  /** Refracting rim thickness in px. */
  depth?: number;
  /** Displacement strength; negative bends inward like a magnifying lens. */
  scale?: number;
  /** Backdrop blur in px, identical with and without refraction. */
  blur?: number;
  /** Tint classes (translucent background utilities). */
  className?: string;
}

export function LiquidGlassLayer({ depth = 20, scale = -60, blur = 2, className = "" }: Props) {
  const rawId = useId();
  const filterId = `hark-glass-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const layerRef = useRef<HTMLSpanElement>(null);
  const [reduced, setReduced] = useState(false);
  const [refract, setRefract] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0, radius: 0 });
  const [map, setMap] = useState<string | null>(null);

  // Layout effects: the server-safe first render is plain frost, and every
  // upgrade below commits before the browser paints the mounted card.
  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const update = () => {
      setReduced(query.matches);
      setRefract(isBlinkEngine() && !query.matches);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const element = layerRef.current;
    if (!element) return;

    let frame = 0;
    const measure = () => {
      // Layout size, not getBoundingClientRect: the stack animates `scale` on
      // the wrapper, and a mid-transition measurement would bake the shrunken
      // size into the filter region, leaving a dead band at the card's edge.
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      if (width === 0 || height === 0) return;
      // The corner radius is responsive, so read the resolved value instead of
      // taking a prop that could drift from the stylesheet.
      const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      setSize((previous) =>
        previous.width === width && previous.height === height && previous.radius === radius
          ? previous
          : { width, height, radius },
      );
    };

    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!refract || size.width === 0 || size.height === 0) return;
    setMap(getDisplacementMap(size.width, size.height, size.radius, depth));
  }, [refract, size.width, size.height, size.radius, depth]);

  const active = refract && map !== null;
  const effectStyle: CSSProperties | undefined = reduced
    ? undefined
    : {
        backdropFilter: `blur(${blur}px)${active ? ` url(#${filterId})` : ""} saturate(160%) brightness(1.03)`,
      };

  return (
    <span
      ref={layerRef}
      aria-hidden="true"
      className="hark-liquid-glass absolute inset-0 rounded-[inherit]"
    >
      {/* 1. effect: blur + saturate everywhere, rim refraction on Chromium */}
      <span
        className="hark-liquid-glass-effect absolute inset-0 rounded-[inherit]"
        style={effectStyle}
      />
      {/* 2. tint */}
      <span className={`absolute inset-0 rounded-[inherit] ${className}`} />
      {/* 3. shine: specular bevel pooling toward the top-left light */}
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1.5px 1.5px 1px -0.5px oklch(1 0 0 / 0.5), inset -1px -1px 1px -0.5px oklch(1 0 0 / 0.22), inset 0 0 12px oklch(1 0 0 / 0.06)",
        }}
      />
      {active ? (
        <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true">
          <filter
            id={filterId}
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={map}
              x="0"
              y="0"
              width={size.width}
              height={size.height}
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale * (1 + ABERRATION / 2)}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix type="matrix" values={CHANNEL_MATRICES.R} result="channelR" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix type="matrix" values={CHANNEL_MATRICES.G} result="channelG" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale * (1 - ABERRATION / 2)}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix type="matrix" values={CHANNEL_MATRICES.B} result="channelB" />
            <feComposite
              in="channelR"
              in2="channelG"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="1"
              k4="0"
              result="channelRG"
            />
            <feComposite
              in="channelRG"
              in2="channelB"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="1"
              k4="0"
            />
          </filter>
        </svg>
      ) : null}
    </span>
  );
}
