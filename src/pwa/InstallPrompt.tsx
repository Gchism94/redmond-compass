import { useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components";
import { useInstallPrompt } from "./useInstallPrompt";

const DISMISS_KEY = "rc.installDismissed";
function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Dismissible "Add to Home Screen" banner (Home). Chromium → native prompt;
 * iOS Safari → Share-sheet instructions. Hidden once installed/standalone or dismissed.
 */
export function InstallBanner() {
  const { canInstall, showIosHint, promptInstall } = useInstallPrompt();
  const [hidden, setHidden] = useState(dismissed());
  if (hidden || (!canInstall && !showIosHint)) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="mx-4 mt-3 rounded-lg border border-positive/25 bg-positive/5 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive/10 text-positive">
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-foreground">Get the app</p>
          {canInstall ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Install Redmond Compass for quick access from your home screen.
            </p>
          ) : (
            <p className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Tap <Share size={12} className="inline" /> Share, then{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Plus size={12} /> Add to Home Screen
              </span>
              .
            </p>
          )}
          {canInstall && (
            <Button size="sm" variant="primary" className="mt-2" onClick={promptInstall}>
              <Download size={14} /> Install
            </Button>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={close}
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/** Account entry: an "Install app" action (or iOS hint). Hidden when not applicable. */
export function InstallRow() {
  const { canInstall, showIosHint, promptInstall, isStandalone } = useInstallPrompt();
  if (isStandalone) return null;
  if (canInstall) {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className="flex w-full items-center justify-between py-3 text-sm text-foreground"
      >
        <span className="flex items-center gap-2">
          <Download size={15} className="text-positive" /> Install app
        </span>
        <span className="text-xs font-semibold text-positive">Add to home screen</span>
      </button>
    );
  }
  if (showIosHint) {
    return (
      <div className="flex items-start gap-2 py-3 text-sm text-foreground">
        <Download size={15} className="mt-0.5 text-positive" />
        <span>
          Install app —{" "}
          <span className="text-muted-foreground">
            tap <Share size={12} className="inline" /> Share, then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </span>
        </span>
      </div>
    );
  }
  return null;
}
