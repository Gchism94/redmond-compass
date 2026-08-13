import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { useI18n } from "@/i18n";

export interface ErrorStateProps {
  /** Overrides the generic "couldn't load" heading, e.g. "Couldn't load events". */
  title?: string;
  message?: string;
  /** Refetch. Wire this to the query's `refetch` — without it the user is stuck. */
  onRetry?: () => void;
  /** Slim, left-aligned variant for one failed section of an otherwise-fine screen. */
  compact?: boolean;
  /** Overrides "Try again" — e.g. an expired session needs "Sign in", not a retry. */
  retryLabel?: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * ErrorState — "we couldn't load this", explicitly NOT "there's nothing here".
 *
 * The distinction is the whole point (audit 2026-08-13): every read screen rendered
 * `isLoading ? <Skeleton/> : data ?? []`, so a dropped connection, a paused free-tier
 * database, an RLS denial or an expired token all rendered as an empty state. The app
 * confidently told residents there were no businesses in Redmond.
 *
 * So this must never be mistakable for EmptyState. EmptyState is deliberately quiet — a
 * muted circle, muted text, and a FORWARD action ("Explore", "Browse events"). This is
 * alarm-toned — accent/warning icon, a bordered card, and a BACKWARD action (retry the
 * thing that failed). Different colour, different container, different verb.
 */
export function ErrorState({ title, message, onRetry, compact, retryLabel, icon, className }: ErrorStateProps) {
  const { t } = useI18n();
  const heading = title ?? t("error.loadTitle");
  const body = message ?? t("error.loadMsg");

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5",
          className,
        )}
      >
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">{heading}</p>
          {message && <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-positive hover:underline"
            >
              <RotateCw size={12} aria-hidden /> {retryLabel ?? t("error.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto my-6 flex max-w-sm flex-col items-center rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        {icon ?? <AlertTriangle size={22} aria-hidden />}
      </div>
      <h3 className="font-heading text-md font-semibold text-foreground">{heading}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      {onRetry && (
        <Button className="mt-4" variant="primary" size="md" onClick={onRetry}>
          <RotateCw size={15} aria-hidden /> {retryLabel ?? t("error.retry")}
        </Button>
      )}
    </div>
  );
}
