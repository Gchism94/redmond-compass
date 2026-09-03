import { useRegisterSW } from "virtual:pwa-register/react";

/** Register the PWA worker; autoUpdate reloads the page after a new worker activates. */
export function UpdateController() {
  useRegisterSW();
  return null;
}
