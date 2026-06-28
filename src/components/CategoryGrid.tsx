import { Link } from "react-router-dom";
import { TOP_CATEGORIES } from "@/lib/taxonomy";
import { CategoryIcon } from "./CategoryIcon";

/**
 * Browse-by-category grid (S3) — a reliable doorway for people who don't know
 * what to type. Routes to pre-scoped Results.
 */
export function CategoryGrid({ columns = 4 }: { columns?: 3 | 4 }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {TOP_CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          to={c.slug === "more" ? "/search/results" : `/search/results?cat=${c.slug}`}
          className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-positive">
            <CategoryIcon name={c.icon} size={22} />
          </span>
          <span className="text-center text-[11px] font-medium leading-tight text-foreground">
            {c.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
