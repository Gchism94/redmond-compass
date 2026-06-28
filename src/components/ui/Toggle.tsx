import { cn } from "@/lib/cn";

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Segmented control (the wireframe "toggle"): List ⇄ Map, All/News/Bulletins,
 * Saved tabs, etc. Active segment fills navy; uses radiogroup semantics.
 */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: ToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-pill border border-border bg-card p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-tap rounded-pill px-3.5 text-sm font-medium transition focus-visible:outline-none",
              on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
