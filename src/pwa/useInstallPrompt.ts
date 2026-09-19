import { useEffect, useState } from "react";
import { detectInstallEnvironment } from "./installEnvironment";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Install affordance (BUILD-BRIEF §10). Captures `beforeinstallprompt` (Chromium)
 * so we can offer a custom "Add to Home Screen". iOS browsers don't fire it — we
 * detect iOS + non-standalone to show Share-sheet instructions instead.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
let listening = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

function ensureInstallListeners() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    appInstalled = true;
    deferredPrompt = null;
    notify();
  });
}

// Register as soon as this module is loaded so a fast Chromium
// `beforeinstallprompt` event is not lost between render and effect setup.
ensureInstallListeners();

export function useInstallPrompt() {
  const [, redraw] = useState(0);

  useEffect(() => {
    const subscriber = () => redraw((value) => value + 1);
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  }, []);

  const environment = detectInstallEnvironment();
  // WebKit-based iOS browsers use the Share-sheet installation path. Ignore a
  // synthetic/development Chromium event when the user agent is an iPhone/iPad.
  const nativePromptAvailable = environment.platform !== "ios" && !!deferredPrompt && !appInstalled;
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari standalone flag
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredPrompt) return "unavailable";
    const prompt = deferredPrompt;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt = null;
    notify();
    return outcome;
  }

  return {
    /** Chromium native prompt is available */
    canInstall: nativePromptAvailable,
    /** show iOS "Add to Home Screen" instructions instead */
    showIosHint: environment.platform === "ios" && !isStandalone && !appInstalled,
    isStandalone,
    installed: appInstalled,
    promptInstall,
    ...environment,
  };
}
