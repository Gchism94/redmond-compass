import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ThumbProps {
  src?: string;
  alt: string;
  /** seed text (e.g. business name) for a stable placeholder tint + initial */
  seed?: string;
  className?: string;
  rounded?: string;
}

// ONE consistent on-brand placeholder everywhere: a warm tan (secondary) tinted square
// with a pine-green initial. Single tint + single initial color (not per-letter varying),
// so every photo-less card reads identically across Home / Results / Saved / Search.
const PLACEHOLDER = "bg-secondary text-positive";

/**
 * Image with a branded placeholder fallback (used everywhere thumbnails appear).
 * When no src or on load error, shows the tinted tile with the seed's initial —
 * so a photo-less free listing still reads complete, never broken.
 */
export function Thumb({ src, alt, seed, className, rounded = "rounded-md" }: ThumbProps) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        rounded,
        !showImg && PLACEHOLDER,
        className,
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : seed ? (
        <span aria-hidden className="font-heading text-lg font-semibold">
          {seed.trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <ImageIcon aria-hidden className="opacity-40" size={20} />
      )}
    </div>
  );
}
