import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink, Mail, Phone } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { telHref } from "@/lib/links";
import { useI18n } from "@/i18n";
import type { GuideContent, GuideItem, GuideSection } from "./types";

const CONTACT_EMAIL = "RedmondCompass@gmail.com";

/**
 * Presentational guide renderer — takes already-resolved content, no data loading
 * and no browser APIs. Shared by GuideScreen (client, async-loads the content) and
 * the prerender entry (server, renderToStaticMarkup). Deliberately imports only
 * direct deps (not the `@/components` barrel) so it stays SSR-safe. Layout follows
 * the app's design system — cards, one amber CTA per card, 44px taps.
 */
export function GuideView({ content: c }: { content: GuideContent }) {
  return (
    // Desktop (WebShell) caps guides at a readable measure; mobile is full-width.
    <div className="pb-6 lg:mx-auto lg:max-w-2xl">
      <ScreenHeader title={c.name} back />
      <div className="px-4">
        {c.kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.kicker}</p>
        )}
        {c.title !== c.name && (
          <p className="mt-0.5 font-heading text-[22px] font-bold leading-snug text-foreground">{c.title}</p>
        )}
        {c.intro && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.intro}</p>}

        {c.callout && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/60 p-3">
            {c.callout.title && (
              <p className="font-heading text-sm font-semibold text-foreground">{c.callout.title}</p>
            )}
            <p className="mt-1 text-sm leading-relaxed text-foreground">{c.callout.body}</p>
            <ItemActions phone={c.callout.phone} url={c.callout.url} />
          </div>
        )}

        {c.sections.map((s) => (
          <Section key={s.heading} section={s} />
        ))}

        {c.related && c.related.length > 0 && (
          <nav className="mt-6 divide-y divide-border rounded-lg border border-border bg-card px-3">
            {c.related.map((r) => (
              <Link key={r.to} to={r.to} className="flex min-h-tap items-center justify-between py-3 text-sm font-medium text-foreground">
                {r.label}
                <ChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </nav>
        )}

        {c.contactEmail && (
          <div className="mt-6 rounded-lg border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">{c.contactEmail}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-flex min-h-tap items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground"
            >
              <Mail size={15} /> {CONTACT_EMAIL}
            </a>
          </div>
        )}

        {c.footnote && <p className="mt-6 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{c.footnote}</p>}
        {c.reviewed && <p className="mt-2 text-center text-xs text-muted-foreground">{c.reviewed}</p>}
      </div>
    </div>
  );
}

function Section({ section: s }: { section: GuideSection }) {
  return (
    <section className="mt-6">
      <h2 className="font-heading text-base font-semibold text-foreground">{s.heading}</h2>
      {s.kicker && <p className="text-xs text-muted-foreground">{s.kicker}</p>}
      {s.body && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>}
      {s.image && (
        <img src={s.image.src} alt={s.image.alt} loading="lazy" className="mt-3 w-full rounded-lg border border-border" />
      )}
      {s.bullets && (
        <ul className="mt-2 space-y-1.5 pl-4">
          {s.bullets.map((b) => (
            <li key={b} className="list-disc text-sm leading-relaxed text-foreground marker:text-primary">
              {b}
            </li>
          ))}
        </ul>
      )}
      {s.items && (
        <div className="mt-2.5 space-y-2.5">
          {s.items.map((it) => (
            <Item key={it.title} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

function Item({ item: it }: { item: GuideItem }) {
  if (it.to) {
    return (
      <Link to={it.to} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <span className="min-w-0">
          <span className="block font-heading text-sm font-semibold text-foreground">{it.title}</span>
          {it.body && <span className="mt-0.5 block text-xs text-muted-foreground">{it.body}</span>}
        </span>
        <ChevronRight size={16} className="ml-2 shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="font-heading text-sm font-semibold leading-tight text-foreground">{it.title}</p>
      {it.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{it.body}</p>}
      {it.note && <p className="mt-1 text-xs text-muted-foreground">{it.note}</p>}
      <ItemActions phone={it.phone} url={it.url} />
    </div>
  );
}

/** One amber CTA per card (Call); links stay bordered — same rule as ResourceRow. */
function ItemActions({ phone, url }: { phone?: string; url?: string }) {
  const { t } = useI18n();
  const tel = telHref(phone);
  if (!tel && !url) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {tel && (
        <a href={tel} className="inline-flex min-h-tap items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
          <Phone size={13} /> {phone}
        </a>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
        >
          <ExternalLink size={13} /> {t("common.open")}
        </a>
      )}
    </div>
  );
}
