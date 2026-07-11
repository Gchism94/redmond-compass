import { useState } from "react";
import { createPortal } from "react-dom";
import { Compass, MapPin, Check } from "lucide-react";
import { Button, Chip } from "@/components";
import { INTERESTS } from "@/lib/taxonomy";
import { useSession } from "./session";
import { useI18n } from "@/i18n";

/**
 * First-launch lite onboarding (BUILD-BRIEF §10). Location framed as a benefit +
 * interest chips — everything skippable, stored locally (no account needed).
 * Shows only until completed/skipped once.
 */
export function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const { onboarded, completeOnboarding, setLocation } = useSession();
  const [picked, setPicked] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [locGranted, setLocGranted] = useState(false);

  if (onboarded) return null;

  const toggle = (i: string) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const useLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocGranted(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocGranted(true);
        setLocating(false);
      },
      () => {
        setLocating(false); // declined — fine, location is optional
      },
      { timeout: 8000 },
    );
  };

  const finish = (withInterests: boolean) =>
    completeOnboarding(withInterests ? { interests: picked } : undefined);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background">
      <div className="app-frame flex min-h-full flex-col px-6 pb-8 pt-12">
        <div className="absolute right-4 top-4">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            {lang === "en" ? "Español" : "English"}
          </button>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background">
              <Compass size={30} />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">{t("onboarding.welcome")}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              {t("onboarding.welcomeMsg")}
            </p>
          </div>

          {/* Location — framed as a benefit */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive/10 text-positive">
                <MapPin size={18} />
              </span>
              <div className="flex-1">
                <p className="font-heading text-sm font-semibold text-foreground">{t("onboarding.nearYouTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("onboarding.nearYouMsg")}
                </p>
              </div>
            </div>
            <Button
              variant={locGranted ? "positive" : "ghost"}
              size="md"
              fullWidth
              className="mt-3"
              onClick={useLocation}
              disabled={locating}
            >
              {locGranted ? (
                <>
                  <Check size={16} /> {t("onboarding.locationOn")}
                </>
              ) : locating ? (
                t("account.locating")
              ) : (
                t("onboarding.useLocation")
              )}
            </Button>
          </div>

          {/* Interests */}
          <div className="mt-6">
            <p className="font-heading text-sm font-semibold text-foreground">{t("onboarding.whatInto")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("onboarding.whatIntoMsg")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <Chip key={i} active={picked.includes(i)} onClick={() => toggle(i)}>
                  {i}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <Button variant="primary" size="lg" fullWidth onClick={() => finish(true)}>
            {t("onboarding.start")}
          </Button>
          <button
            type="button"
            onClick={() => finish(false)}
            className="w-full py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
