import { SegmentedToggle } from "./SegmentedToggle";
import { useI18n } from "@/i18n";

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

  return (
    <SegmentedToggle
      ariaLabel={t("availability.label")}
      value={value}
      onChange={onChange}
      className={className}
      options={[
        { value: "all", label: t("availability.all") },
        { value: "open", label: t("search.openNow") },
      ]}
    />
  );
}
