import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components";
import { useSession } from "./session";

/**
 * Direct sign-in page (/login) for deep links. Auth is normally just-in-time via
 * the AuthSheet — login is never a gate to browse (BUILD-BRIEF §1). Mock sign-in.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    signIn(email, name);
    navigate("/account", { replace: true });
  };

  return (
    <div>
      <ScreenHeader title="Sign in" back />
      <div className="px-6 pt-4">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
          <Compass size={26} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Sign in to sync your saves, follows, and preferences. Browsing is always free.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
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
      </div>
    </div>
  );
}
