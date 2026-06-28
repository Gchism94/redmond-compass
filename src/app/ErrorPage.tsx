import { useRouteError, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components";

/**
 * Route-level error boundary (createBrowserRouter errorElement). A render/load
 * error never dead-ends — it offers a way back (BUILD-BRIEF §9: no dead ends).
 */
export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  // Surface a hint in dev; keep the user-facing copy calm.
  if (import.meta.env.DEV) console.error("Route error:", error);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-accent">
        <AlertTriangle size={26} />
      </div>
      <h1 className="font-heading text-xl font-bold text-foreground">Something went sideways</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        That screen didn't load. Your saved places and recent activity are safe.
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button variant="primary" onClick={() => navigate("/", { replace: true })}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}
