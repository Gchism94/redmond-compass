import { useEffect, useState } from "react";
import { Bookmark, UserPlus, CalendarPlus, Heart, Compass } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components";
import { useSession, type AuthReason } from "./session";
import { GoogleButton } from "./GoogleButton";
import { useI18n, type DictKey } from "@/i18n";

const COPY: Record<AuthReason, { icon: React.ReactNode; titleKey: DictKey; subKey: DictKey }> = {
  save: { icon: <Bookmark size={22} />, titleKey: "auth.saveTitle", subKey: "auth.saveSub" },
  follow: { icon: <UserPlus size={22} />, titleKey: "auth.followTitle", subKey: "auth.followSub" },
  saveEvent: { icon: <CalendarPlus size={22} />, titleKey: "auth.saveEventTitle", subKey: "auth.saveEventSub" },
  recommend: { icon: <Heart size={22} />, titleKey: "auth.recommendTitle", subKey: "auth.recommendSub" },
  account: { icon: <Compass size={22} />, titleKey: "auth.accountTitle", subKey: "auth.accountSub" },
};

const inputClass =
  "min-h-tap w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-positive focus:ring-2 focus:ring-positive/20";

/**
 * Just-in-time auth (BUILD-BRIEF §1, §12 step 6). The ONLY place we ask to log in —
 * raised by a gated action (save/follow/owner), never as a gate to browse. Passwordless:
 * Supabase emails a 6-digit code (verified in-app, no redirect, so the pending action
 * completes right here); the mock signs in instantly.
 */
export function AuthSheet() {
  const { t } = useI18n();
  const { authPrompt, closeAuth, startSignIn, verifyOtp, signInWithProvider } = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[authPrompt.reason];

  // reset to a clean state whenever the sheet closes
  useEffect(() => {
    if (!authPrompt.open) {
      setStep("email");
      setEmail("");
      setName("");
      setCode("");
      setError(null);
      setBusy(false);
    }
  }, [authPrompt.open]);

  // run the action that triggered the prompt (e.g. complete the save), then close
  const finish = () => {
    const pending = authPrompt.pending;
    closeAuth();
    pending?.();
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!addr || !/^\S+@\S+\.\S+$/.test(addr)) {
      setError(t("auth.invalidEmail")); // inline, on-brand — not the native bubble
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { needsOtp } = await startSignIn(addr, name);
      if (needsOtp) setStep("code");
      else finish(); // mock — signed in instantly
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { redirected } = await signInWithProvider("google");
      // mock signs in instantly (no redirect) — the stashed intent replays the action
      if (!redirected) {
        closeAuth();
        return;
      }
      // redirected: the browser is navigating to Google; nothing more to do here
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.googleFailed"));
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!code.trim()) {
      setError(t("auth.enterCodeError"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      finish();
    } catch {
      setError(t("auth.badCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={authPrompt.open} onClose={closeAuth} hideHeader>
      <div className="pt-2 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-positive">
          {copy.icon}
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {step === "code" ? t("auth.enterCode") : t(copy.titleKey)}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {step === "code" ? (
            <>
              {t("auth.codeSent")} <b className="text-foreground">{email}</b>.
            </>
          ) : (
            t(copy.subKey)
          )}
        </p>
      </div>

      {step === "email" ? (
        <>
        <div className="mt-5">
          <GoogleButton onClick={continueWithGoogle} disabled={busy} />
          <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t("common.or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={submitEmail} className="space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">
              {t("auth.name")} <span className="font-normal text-muted-foreground">{t("auth.optional")}</span>
            </span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
            {busy ? t("auth.sending") : t("common.continue")}
          </Button>
        </form>
        </>
      ) : (
        <form onSubmit={submitCode} className="mt-5 space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">{t("auth.codeLabel")}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${inputClass} text-center text-lg tracking-[0.4em]`}
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
            {busy ? t("auth.verifying") : t("auth.verifyContinue")}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="w-full py-1 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("auth.differentEmail")}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={closeAuth}
        className="mt-3 w-full py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {t("auth.keepBrowsing")}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {t("auth.alwaysFree")}
      </p>
    </Sheet>
  );
}
