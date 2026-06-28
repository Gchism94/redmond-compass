import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  /** Primary forward action — empty states ALWAYS route forward (BUILD-BRIEF §9). */
  action?: { label: string; href?: string; onClick?: () => void };
  /** secondary suggestions, e.g. category chips */
  children?: ReactNode;
  className?: string;
}

/**
 * EmptyState — never a dead end. Always offers a way forward (a link or action).
 * Used for no-results, empty Saved tabs, empty wallet, etc.
 */
export function EmptyState({ icon, title, message, action, children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-md font-semibold text-foreground">{title}</h3>
      {message && <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{message}</p>}
      {action &&
        (action.href ? (
          <Link
            to={action.href}
            className="mt-4 inline-flex min-h-tap h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition hover:brightness-95"
          >
            {action.label}
          </Link>
        ) : (
          <Button className="mt-4" variant="primary" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      {children && <div className="mt-5 w-full">{children}</div>}
    </div>
  );
}
