import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  /** render non-interactive (a tappable bar that routes to /search) */
  readOnlyButton?: boolean;
  onActivate?: () => void;
}

/**
 * The unified search input. Used on Search (real input), Events, Resources, and
 * as a tappable bar on Home (readOnlyButton). Pine-green focus ring.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onClear, readOnlyButton, onActivate, placeholder = "Search…", className, ...props },
  ref,
) {
  if (readOnlyButton) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          "flex min-h-tap w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-left",
          className,
        )}
      >
        <Search size={18} className="text-muted-foreground" />
        <span className="text-base text-muted-foreground">{placeholder}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-tap items-center gap-2.5 rounded-lg border border-border bg-card px-3 focus-within:border-positive focus-within:ring-2 focus-within:ring-positive/20",
        className,
      )}
    >
      <Search size={18} className="shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});
