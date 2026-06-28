import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** White surface with hairline border + soft card shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card shadow-card", className)}
      {...props}
    />
  );
}
