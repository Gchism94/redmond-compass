import { useState } from "react";
import { Bookmark, UserPlus, CalendarPlus, Compass } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components";
import { useSession, type AuthReason } from "./session";

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
  account: {
    icon: <Compass size={22} />,
    title: "Sign in to Redmond Compass",
    sub: "Sync your saves, follows, and preferences across devices.",
  },
};

/**
 * Just-in-time auth (BUILD-BRIEF §1, §12 step 6). The ONLY place we ask to log in —
 * raised by a gated action (save/follow), never as a gate to browse. Mock sign-in.
 */
export function AuthSheet() {
  const { authPrompt, closeAuth, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const copy = COPY[authPrompt.reason];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const pending = authPrompt.pending;
    signIn(email, name);
    closeAuth();
    // run the action that triggered the prompt (e.g. complete the save)
    pending?.();
    setEmail("");
    setName("");
  };

  return (
    <Sheet open={authPrompt.open} onClose={closeAuth} hideHeader>
      <div className="pt-2 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-positive">
          {copy.icon}
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{copy.title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{copy.sub}</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-foreground">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-h-tap w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-positive focus:ring-2 focus:ring-positive/20"
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
            className="min-h-tap w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-positive focus:ring-2 focus:ring-positive/20"
          />
        </label>
        <Button type="submit" variant="primary" size="lg" fullWidth>
          Continue
        </Button>
      </form>

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
