import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "positive" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  // amber — primary CTAs (Call, Directions, key actions)
  primary: "bg-primary text-primary-foreground hover:brightness-95 active:brightness-90",
  // warm light surface
  secondary: "bg-secondary text-secondary-foreground hover:brightness-[0.98] border border-border",
  // outline on white
  ghost: "bg-card text-foreground border border-border hover:bg-muted",
  // pine green — positive / open / confirm
  positive: "bg-positive text-positive-foreground hover:brightness-95",
  destructive: "bg-destructive text-destructive-foreground hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-10 px-3 text-sm rounded-md gap-1.5",
  md: "min-h-tap h-11 px-4 text-base rounded-lg gap-2",
  lg: "min-h-tap h-12 px-5 text-base rounded-lg gap-2",
};

/** Brand button. Primary = amber. Use `positive` for open/confirm (pine green). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition",
        "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
});
