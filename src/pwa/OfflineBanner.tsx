import { CloudOff } from "lucide-react";
import { useOnline } from "./useOnline";
import { useI18n } from "@/i18n";

/**
 * Subtle offline indicator, pinned just above the tab bar (so it never fights the
 * sticky screen headers). Saved + recently-viewed + the last app shell are cached,
 * so the app stays usable offline (BUILD-BRIEF §10).
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-content px-3 pb-1">
      <div className="flex items-center justify-center gap-2 rounded-lg bg-foreground/90 px-3 py-2 text-xs font-medium text-background shadow-sticky backdrop-blur">
        <CloudOff size={14} />
        {t("pwa.offline")}
      </div>
    </div>
  );
}
