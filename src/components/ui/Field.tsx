import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared input styling for owner forms (parity with AuthSheet/Login inputs). */
export const fieldInputClass =
  "min-h-tap w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-positive focus:ring-2 focus:ring-positive/20";

export function Field({
  label,
  required,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-semibold text-foreground">
        {label}
        {required && <span className="font-normal text-positive">required</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
