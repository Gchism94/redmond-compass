import type { ReactNode } from "react";
import { SectionHeader } from "./ui/SectionHeader";

/** Horizontal-scroll rail with a section header + "See all" (Home). */
export function Rail({
  title,
  seeAllHref,
  children,
}: {
  title: string;
  seeAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-2">
      <div className="px-4">
        <SectionHeader title={title} seeAllHref={seeAllHref} />
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">{children}</div>
    </section>
  );
}
