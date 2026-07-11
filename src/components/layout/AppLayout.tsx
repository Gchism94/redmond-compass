import { AppShell } from "./AppShell";
import { WebShell } from "./WebShell";
import { useIsDesktop } from "@/lib/useMediaQuery";

/**
 * Layout switcher: one router, two frames. ≥1024px renders the desktop site
 * (WebShell — top nav + footer matching the original redmondcompass.com);
 * below that, the installable PWA (AppShell — bottom tab nav). All routes and
 * content components are shared; only the shell differs.
 */
export function AppLayout() {
  return useIsDesktop() ? <WebShell /> : <AppShell />;
}
