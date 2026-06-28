import { cn } from "@/lib/cn";

/** Loading placeholder. Pulses unless prefers-reduced-motion (handled globally). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
