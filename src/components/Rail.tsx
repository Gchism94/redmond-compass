import type { ReactNode } from "react";
import { SectionHeader } from "./ui/SectionHeader";

/** Horizontal-scroll rail with a section header + "See all" (Home). */
export function Rail({
  title,
  seeAllHref,
  headerAction,
  children,
}: {
  title: string;
  seeAllHref?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-3 lg:py-5">
      <div className="px-4">
        <SectionHeader title={title} seeAllHref={seeAllHref} />
        {headerAction && <div className="-mt-1 mb-3">{headerAction}</div>}
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 lg:gap-4 lg:pb-2">{children}</div>
    </section>
  );
}
