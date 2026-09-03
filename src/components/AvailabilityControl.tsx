import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

export type Availability = "all" | "open";

export function AvailabilityControl({
  value,
  onChange,
  className,
}: {
  value: Availability;
  onChange: (value: Availability) => void;
  className?: string;
}) {
  const { t } = useI18n();

  const options: Array<{ value: Availability; label: string; shortLabel?: string }> = [
    { value: "all", label: t("availability.all"), shortLabel: t("availability.allShort") },
    { value: "open", label: t("search.openNow") },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("availability.label")}
      className={cn("grid w-full max-w-60 grid-cols-2 rounded-pill border border-border bg-card p-1 shadow-sm", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-label={option.label}
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-tap min-w-0 items-center justify-center whitespace-nowrap rounded-pill px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.shortLabel ? (
              <><span className="sm:hidden">{option.shortLabel}</span><span className="hidden sm:inline">{option.label}</span></>
            ) : option.label}
          </button>
        );
      })}
    </div>
  );
}
