import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components";
import { useSession } from "./session";
import { GoogleButton } from "./GoogleButton";

const inputClass =
  "min-h-tap w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-positive focus:ring-2 focus:ring-positive/20";

/**
 * Direct sign-in page (/login) for deep links. Auth is normally just-in-time via the
 * AuthSheet — login is never a gate to browse (BUILD-BRIEF §1). Passwordless email OTP
 * (Supabase) or instant (mock).
 */
export function LoginScreen() {
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
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { needsOtp } = await startSignIn(email, name);
      if (needsOtp) setStep("code");
      else navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your code. Try again.");
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
      setError(err instanceof Error ? err.message : "Couldn't start Google sign-in.");
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      navigate("/account", { replace: true });
    } catch {
      setError("That code didn't work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Sign in" back />
      <div className="px-6 pt-4">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
          <Compass size={26} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {step === "code" ? (
            <>
              Enter the 6-digit code we emailed to <b className="text-foreground">{email}</b>.
            </>
          ) : (
            "Sign in to sync your saves, follows, and preferences. Browsing is always free."
          )}
        </p>

        {step === "email" ? (
          <>
          <div className="mt-6">
            <GoogleButton onClick={continueWithGoogle} disabled={busy} />
            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
          <form onSubmit={submitEmail} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
              {busy ? "Sending…" : "Continue"}
            </Button>
          </form>
          </>
        ) : (
          <form onSubmit={submitCode} className="mt-6 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">6-digit code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
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
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
