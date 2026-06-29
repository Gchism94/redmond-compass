import { useEffect, useState } from "react";
import { Bookmark, UserPlus, CalendarPlus, Heart, Compass } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components";
import { useSession, type AuthReason } from "./session";
import { GoogleButton } from "./GoogleButton";

const COPY: Record<AuthReason, { icon: React.ReactNode; title: string; sub: string }> = {
  save: {
    icon: <Bookmark size={22} />,
    title: "Sign in to save",
    sub: "Keep your favorite Redmond spots in one place, synced across devices.",
  },
  follow: {
    icon: <UserPlus size={22} />,
    title: "Sign in to follow",
    sub: "Follow places you love and get their latest bulletins in your feed.",
  },
  saveEvent: {
    icon: <CalendarPlus size={22} />,
    title: "Sign in to save events",
    sub: "Save events you're interested in and get reminders before they start.",
  },
  recommend: {
    icon: <Heart size={22} />,
    title: "Sign in to recommend",
    sub: "Recommend places you love so other Redmond locals can find them.",
  },
  account: {
    icon: <Compass size={22} />,
    title: "Sign in to Redmond Compass",
    sub: "Sync your saves, follows, and preferences across devices.",
  },
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
      setError("Enter a valid email to continue."); // inline, on-brand — not the native bubble
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { needsOtp } = await startSignIn(addr, name);
      if (needsOtp) setStep("code");
      else finish(); // mock — signed in instantly
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
      // mock signs in instantly (no redirect) — the stashed intent replays the action
      if (!redirected) {
        closeAuth();
        return;
      }
      // redirected: the browser is navigating to Google; nothing more to do here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start Google sign-in.");
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!code.trim()) {
      setError("Enter the 6-digit code we emailed you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      finish();
    } catch {
      setError("That code didn't work. Check it and try again.");
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
          {step === "code" ? "Enter your code" : copy.title}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {step === "code" ? (
            <>
              We emailed a 6-digit code to <b className="text-foreground">{email}</b>.
            </>
          ) : (
            copy.sub
          )}
        </p>
      </div>

      {step === "email" ? (
        <>
        <div className="mt-5">
          <GoogleButton onClick={continueWithGoogle} disabled={busy} />
          <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={submitEmail} className="space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">Email</span>
            <input
              type="email"
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
        <form onSubmit={submitCode} className="mt-5 space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">6-digit code</span>
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

      <button
        type="button"
        onClick={closeAuth}
        className="mt-3 w-full py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Keep browsing without an account
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Browsing is always free — we only ask when you save or follow.
      </p>
    </Sheet>
  );
}
