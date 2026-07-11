import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components";
import { useSession } from "./session";
import { GoogleButton } from "./GoogleButton";
import { useI18n } from "@/i18n";

const inputClass =
  "min-h-tap w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-positive focus:ring-2 focus:ring-positive/20";

/**
 * Direct sign-in page (/login) for deep links. Auth is normally just-in-time via the
 * AuthSheet — login is never a gate to browse (BUILD-BRIEF §1). Passwordless email OTP
 * (Supabase) or instant (mock).
 */
export function LoginScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { startSignIn, verifyOtp, signInWithProvider } = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!addr || !/^\S+@\S+\.\S+$/.test(addr)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { needsOtp } = await startSignIn(addr, name);
      if (needsOtp) setStep("code");
      else navigate("/account", { replace: true });
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
      if (!redirected) navigate("/account", { replace: true });
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
      navigate("/account", { replace: true });
    } catch {
      setError(t("auth.badCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ScreenHeader title={t("auth.loginTitle")} back />
      <div className="px-6 pt-4">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
          <Compass size={26} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {step === "code" ? (
            <>
              {t("auth.loginCodeSub")} <b className="text-foreground">{email}</b>.
            </>
          ) : (
            t("auth.loginSub")
          )}
        </p>

        {step === "email" ? (
          <>
          <div className="mt-6">
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
          <form onSubmit={submitCode} className="mt-6 space-y-3" noValidate>
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
      </div>
    </div>
  );
}
