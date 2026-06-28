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

// Warm, on-brand placeholder tints (cream/tan/secondary family — never the wireframe grays).
const TINTS = [
  "bg-secondary text-secondary-foreground/60",
  "bg-muted text-muted-foreground",
  "bg-accent/12 text-accent",
  "bg-positive/10 text-positive",
];

function tintFor(seed?: string): string {
  if (!seed) return TINTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * Image with a branded placeholder fallback (used everywhere thumbnails appear).
 * When no src or on load error, shows a tinted tile with the seed's initial —
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
        !showImg && tintFor(seed),
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
        <span aria-hidden className="font-heading text-lg font-semibold opacity-80">
          {seed.trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <ImageIcon aria-hidden className="opacity-40" size={20} />
      )}
    </div>
  );
}
