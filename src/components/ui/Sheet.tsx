import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** hide the default header (title + close) for fully custom content */
  hideHeader?: boolean;
  children: ReactNode;
  /** "bottom" sheet (default) or centered "modal" */
  variant?: "bottom" | "modal";
}

/**
 * Accessible bottom sheet / modal. Used for JIT auth and dialogs.
 * Esc + overlay-click close, body-scroll lock, focus moves in and restores out,
 * role=dialog / aria-modal. Slide-in respects prefers-reduced-motion (global CSS).
 */
export function Sheet({ open, onClose, title, hideHeader, children, variant = "bottom" }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the dialog CONTAINER (not the first control) so no button shows a focus ring
    // at rest on open; keyboard users Tab to controls (focus-visible rings appear then).
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* overlay */}
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 animate-fade-in"
      />
      {/* panel — flush to the bottom, capped height with the body scrolling inside */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-content flex-col bg-card shadow-modal outline-none",
          variant === "bottom"
            ? "mt-auto max-h-[92dvh] rounded-t-2xl animate-slide-up"
            : "my-auto max-h-[92dvh] rounded-2xl animate-fade-in",
        )}
      >
        {!hideHeader && (
          <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-4">
            <h2 className="font-heading text-md font-semibold text-foreground">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="-mr-1">
              <X size={20} />
            </IconButton>
          </div>
        )}
        {/* safe-area padding lives on the scroll body so the sheet sits flush */}
        <div className="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
