/**
 * AppLayout — the app shell. Centers a mobile content column (max-w-content),
 * hosts the routed screen in <main>, and pins BottomTabNav at the bottom.
 * <main> gets bottom padding so content clears the fixed tab bar + safe area.
 */
import type { ReactNode } from "react";
import { BottomTabNav, type TabKey } from "./BottomTabNav";

export interface AppLayoutProps {
  active: TabKey | null;
  children: ReactNode;
}

export function AppLayout({ active, children }: AppLayoutProps) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col bg-background">
      <main className="flex-1 pb-[calc(58px+env(safe-area-inset-bottom))]">{children}</main>
      <BottomTabNav active={active} />
    </div>
  );
}
