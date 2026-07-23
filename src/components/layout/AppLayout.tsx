import { AppShell } from "./AppShell";
import { WebShell } from "./WebShell";
import { Onboarding } from "@/features/account/Onboarding";
import { AuthSheet } from "@/features/account/AuthSheet";
import { useIsDesktop } from "@/lib/useMediaQuery";

/**
 * Layout switcher: one router, two frames. ≥1024px renders the desktop site
 * (WebShell — top nav + footer matching the original redmondcompass.com);
 * below that, the installable PWA (AppShell — bottom tab nav). All routes and
 * content components are shared; only the shell differs.
 *
 * Onboarding + the JIT AuthSheet live HERE (not App.tsx) so they exist only
 * within the app — the app-only landing page at `/` renders outside this
 * layout and must never show the first-launch overlay or an auth sheet.
 */
export function AppLayout() {
  return (
    <>
      {useIsDesktop() ? <WebShell /> : <AppShell />}
      <Onboarding />
      <AuthSheet />
    </>
  );
}
