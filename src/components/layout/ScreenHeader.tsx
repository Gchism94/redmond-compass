import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { IconButton } from "../ui/IconButton";
import { cn } from "@/lib/cn";

export interface ScreenHeaderProps {
  title: string;
  /** show a back button (pushed screens like profile, detail) */
  back?: boolean;
  /** trailing action(s), e.g. an overflow menu */
  action?: ReactNode;
  /** sticky to top of the scroll container */
  sticky?: boolean;
  className?: string;
}

/** Screen title bar. Title uses Playfair (display). Optional back + trailing action. */
export function ScreenHeader({ title, back, action, sticky, className }: ScreenHeaderProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "flex items-center gap-1 bg-background px-3 pt-3 pb-1",
        sticky && "sticky top-0 z-10",
        className,
      )}
    >
      {back && (
        <IconButton label="Back" onClick={() => navigate(-1)} className="-ml-1">
          <ChevronLeft size={22} />
        </IconButton>
      )}
      <h1 className="flex-1 font-heading text-xl font-bold text-foreground">{title}</h1>
      {action}
    </header>
  );
}
