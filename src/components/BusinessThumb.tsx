import type { ComponentProps } from "react";
import type { Business } from "@/lib/types";
import { TOP_CATEGORIES, topCategoryFor } from "@/lib/taxonomy";
import { CategoryIcon } from "./CategoryIcon";
import { Thumb } from "./ui/Thumb";

export function BusinessImageFallback({ category }: { category: string }) {
  const group = TOP_CATEGORIES.find((item) => item.slug === topCategoryFor(category))
    ?? TOP_CATEGORIES[TOP_CATEGORIES.length - 1];

  return (
    <span
      data-business-image-fallback={group.slug}
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-positive/75"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-positive/20 bg-background/70 shadow-sm">
        <CategoryIcon name={group.icon} size={18} />
      </span>
      <span className="hidden max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.13em] lg:block">
        {group.label}
      </span>
    </span>
  );
}

type BusinessThumbProps = Omit<ComponentProps<typeof Thumb>, "alt" | "seed" | "src" | "fallback"> & {
  business: Pick<Business, "name" | "category" | "photos">;
  src?: string;
};

/** Business artwork with a category-aware empty/error state. */
export function BusinessThumb({ business, src = business.photos[0], ...props }: BusinessThumbProps) {
  return (
    <Thumb
      {...props}
      src={src}
      seed={business.name}
      alt={business.name}
      fallback={<BusinessImageFallback category={business.category} />}
    />
  );
}
