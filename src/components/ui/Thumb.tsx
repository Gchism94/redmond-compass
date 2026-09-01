import { useRef, useState, type ReactNode } from "react";
import { Compass, ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ThumbProps {
  src?: string;
  alt: string;
  /** seed text (e.g. business name) for a stable placeholder tint + initial */
  seed?: string;
  className?: string;
  /** optional styling for the actual image (useful when a large logo needs breathing room) */
  imageClassName?: string;
  rounded?: string;
  /** auto chooses from aspect ratio; contain preserves identity artwork such as logos. */
  fit?: "auto" | "cover" | "contain";
  /** Content-specific empty state. Business cards use a category mark; news uses a newsroom mark. */
  fallback?: ReactNode;
}

// ONE consistent on-brand placeholder everywhere: a warm tan (secondary) frame
// with the Compass mark. A generic brand mark is more deliberate than a giant initial,
// while the adjacent accessible name still identifies the listing/article accurately.
const PLACEHOLDER = "bg-secondary text-positive";

/**
 * How far an image's aspect ratio may differ from its slot before we stop cropping it.
 * 1.4 ≈ "the slot is up to 40% wider or taller than the picture".
 *
 * Tuned against the real directory: the rail slot is 144×80 (AR 1.80), and a landscape
 * photo like 576×278 (2.07) or 500×377 (1.33) sits inside the tolerance and still fills
 * the card, while a square-ish logo — 245×216 (1.13), 1024×1024 (1.00) — or a portrait one
 * like 103×120 (0.86) falls outside it.
 */
const FIT_TOLERANCE = 1.4;

/**
 * Facebook CDN image URLs are short-lived, hotlink-protected assets. Loading them directly
 * produces noisy 403s once their signed query expires, so render the intentional branded
 * fallback immediately instead of briefly flashing a broken card.
 */
function isStableImageSource(src?: string): src is string {
  if (!src) return false;
  try {
    const host = new URL(src, "https://app.redmondcompass.com").hostname.toLowerCase();
    return host !== "fbcdn.net" && !host.endsWith(".fbcdn.net");
  } catch {
    return false;
  }
}

/**
 * Image with a branded placeholder fallback (used everywhere thumbnails appear).
 * When no src or on load error, shows a tinted tile with the Compass mark —
 * so a photo-less free listing still reads complete, never broken.
 *
 * FIT (2026-08-14): most `businesses.photos` entries are LOGOS hotlinked from the owner's
 * own site — square or portrait, often on their own white canvas — not landscape
 * photographs. Cropping those to a wide card with `object-cover` cut the artwork (Safe
 * Acres' 103×120 logo lost its top and bottom; Burger Wild's 245×216 badge lost ~37%).
 *
 * So the fit is chosen per image once it loads: `cover` while the picture is close enough
 * to the slot's shape to fill it honestly, otherwise `contain` so the whole logo survives —
 * and in that case the surrounding area gets the SAME warm tan as the no-photo tile, so the
 * letterboxing reads as the brand's own frame rather than raw white space.
 *
 * The no-photo fallback below is deliberately untouched by any of this.
 */
export function Thumb({
  src,
  alt,
  seed,
  className,
  imageClassName,
  rounded = "rounded-md",
  fit = "auto",
  fallback,
}: ThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const [contain, setContain] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showImg = isStableImageSource(src) && src !== failedSrc;
  const useContain = fit === "contain" || (fit === "auto" && contain);

  // Measured on load rather than assumed: the same Thumb renders at 144×80 in the rail,
  // 44×44 in a list row and full-bleed on a profile, so the right answer differs per slot.
  const chooseFit = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (fit !== "auto") return;
    const img = e.currentTarget;
    const el = wrapRef.current;
    if (!el?.clientWidth || !el.clientHeight || !img.naturalWidth || !img.naturalHeight) return;
    const slotAR = el.clientWidth / el.clientHeight;
    const imgAR = img.naturalWidth / img.naturalHeight;
    const mismatch = imgAR > slotAR ? imgAR / slotAR : slotAR / imgAR;
    setContain(mismatch > FIT_TOLERANCE);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        rounded,
        // the tan fill backs BOTH the no-photo tile and a letterboxed logo
        (!showImg || useContain) && PLACEHOLDER,
        className,
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={chooseFit}
          onError={() => setFailedSrc(src)}
          className={cn(
            "h-full w-full",
            useContain ? "object-contain p-1.5" : "object-cover",
            imageClassName,
          )}
        />
      ) : fallback ? (
        <span aria-hidden data-thumb-fallback="custom" className="flex h-full w-full items-center justify-center">
          {fallback}
        </span>
      ) : seed ? (
        <span
          aria-hidden
          data-thumb-fallback="brand"
          className="flex h-2/5 w-2/5 min-h-4 min-w-4 max-h-9 max-w-9 items-center justify-center rounded-full border border-positive/20 bg-background/65 text-positive/70 shadow-sm"
        >
          <Compass className="h-3/5 w-3/5" strokeWidth={1.8} />
        </span>
      ) : (
        <ImageIcon aria-hidden className="opacity-40" size={20} />
      )}
    </div>
  );
}
