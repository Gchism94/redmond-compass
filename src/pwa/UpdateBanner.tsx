import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useI18n } from "@/i18n";

/** Keep installed sessions current without replacing an in-progress screen silently. */
export function UpdateBanner() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-content px-3 pb-2 lg:bottom-4 lg:max-w-md">
      <div className="rounded-xl border border-border bg-card p-3 shadow-modal">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <RefreshCw size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-semibold text-foreground">{t("pwa.updateReady")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("pwa.updateMessage")}</p>
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="mt-2 inline-flex min-h-tap items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {t("pwa.refresh")}
            </button>
          </div>
          <button
            type="button"
            aria-label={t("common.dismiss")}
            onClick={() => setNeedRefresh(false)}
            className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
