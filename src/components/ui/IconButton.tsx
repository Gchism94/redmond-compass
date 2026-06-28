import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for a11y — icon-only buttons must be labelled. */
  label: string;
  children: ReactNode;
  variant?: "ghost" | "solid" | "bare";
}

/** Circular, 44px-tap icon button. `label` becomes aria-label (icon-only). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, variant = "ghost", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-h-tap min-w-tap items-center justify-center rounded-full transition",
        "focus-visible:outline-none disabled:opacity-50",
        variant === "ghost" && "text-foreground hover:bg-muted",
        variant === "solid" && "bg-card text-foreground border border-border hover:bg-muted",
        variant === "bare" && "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
