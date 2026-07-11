import { useEffect } from "react";

const DEFAULT_TITLE = "Redmond Compass";

/**
 * Per-page <title> + meta description (guides/SEO). SPA navigation restores the
 * defaults on unmount; the prerender pass captures the applied values statically.
 */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute("content") ?? null;
    if (description && meta) meta.setAttribute("content", description);
    return () => {
      document.title = DEFAULT_TITLE;
      if (prev !== null && meta) meta.setAttribute("content", prev);
    };
  }, [title, description]);
}
