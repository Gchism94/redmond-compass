import { Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n";

/**
 * Compact EN/ES toggle for the mobile app chrome. Persistent + above the fold so ES users
 * never have to dig into Account → Settings to switch language (audit #5, an equity gap).
 * Shows the TARGET language (matching the landing/web footer toggles); one tap switches.
 * 44px tap target (min-h/min-w-tap).
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const target = lang === "en" ? "es" : "en";
  return (
    <button
      type="button"
      onClick={() => setLang(target)}
      aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
      className={cn(
        "inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Globe size={16} />
      {target.toUpperCase()}
    </button>
  );
}
