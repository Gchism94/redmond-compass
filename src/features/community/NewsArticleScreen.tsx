import { useParams, Link } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Thumb, EmptyState, Skeleton } from "@/components";
import { useNewsArticle } from "@/data/queries";
import { relativeTime } from "@/lib/format";
import { useI18n } from "@/i18n";

/** Single news article. */
export function NewsArticleScreen() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, isFetched } = useNewsArticle(slug);

  if (isLoading) {
    return (
      <>
        <ScreenHeader title={t("news.title")} back />
        <div className="space-y-3 px-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </>
    );
  }
  if (isFetched && !article)
    return (
      <>
        <ScreenHeader title={t("news.title")} back />
        <EmptyState
          icon={<Newspaper size={20} />}
          title={t("news.notFound")}
          message={t("news.notFoundMsg")}
          action={{ label: t("news.backToCommunity"), href: "/community" }}
        />
      </>
    );
  if (!article) return null;

  return (
    <article className="pb-8">
      <ScreenHeader title={t("news.title")} back />
      <div className="px-4">
        <h1 className="font-heading text-2xl font-bold leading-tight text-foreground">{article.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {article.source}
          {article.author ? ` · ${article.author}` : ""} · {relativeTime(article.publishedAt)}
        </p>
      </div>
      <Thumb
        src={article.image}
        seed={article.source}
        alt={article.title}
        className="mt-3 h-48 w-full"
        rounded="rounded-none"
      />
      <div className="px-4 pt-4">
        <p className="text-base leading-relaxed text-foreground">{article.body}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Local news on Redmond Compass ·{" "}
          <Link to="/community" className="font-semibold text-positive hover:underline">
            More from Community
          </Link>
        </p>
      </div>
    </article>
  );
}
