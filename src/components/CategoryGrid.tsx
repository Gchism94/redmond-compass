import { Link } from "react-router-dom";
import { TOP_CATEGORIES } from "@/lib/taxonomy";
import { CategoryIcon } from "./CategoryIcon";
import { useI18n, type DictKey } from "@/i18n";

/**
 * Browse-by-category grid (S3) — a reliable doorway for people who don't know
 * what to type. Routes to pre-scoped Results.
 */
export function CategoryGrid({ columns = 4 }: { columns?: 3 | 4 | 6 }) {
  const { t } = useI18n();
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {TOP_CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          to={c.slug === "more" ? "/search/results" : `/search/results?cat=${c.slug}`}
          aria-label={t(`cat.${c.slug}` as DictKey)}
          className="group flex flex-col items-center gap-1.5 rounded-lg py-1 focus-visible:outline-none"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-transparent bg-secondary text-positive shadow-card transition-[transform,box-shadow,border-color,background-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-border group-hover:bg-card group-hover:shadow-lift">
            <CategoryIcon name={c.icon} size={22} />
          </span>
          <span className="text-center text-[11px] font-medium leading-tight text-foreground">
            {t(`cat.${c.slug}` as DictKey)}
          </span>
        </Link>
      ))}
    </div>
  );
}
