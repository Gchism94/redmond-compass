// SSR entry for the prerender step — renders each guide to a static HTML string
// with React (no browser). Loaded by scripts/prerender.mjs via Vite's ssrLoadModule,
// so it gets the project's `@/` alias + JSX transform for free (no second bundler).
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { I18nProvider, type Lang } from "@/i18n";
import { GuideView } from "@/features/guides/GuideView";
import { GUIDE_LOADERS, GUIDE_SLUGS } from "@/features/guides/registry";

export { GUIDE_SLUGS };

/**
 * Render one guide route to static markup + its <title>/<meta> from the content
 * data. English is the prerendered default (I18nProvider resolves to "en" in Node);
 * Spanish renders client-side. StaticRouter satisfies the Link/useNavigate context.
 */
export async function renderGuide(slug: string, lang: Lang = "en") {
  const mod = await GUIDE_LOADERS[slug]();
  const content = mod.guide[lang];
  const html = renderToStaticMarkup(
    <I18nProvider>
      <StaticRouter location={`/${slug}`}>
        <GuideView content={content} />
      </StaticRouter>
    </I18nProvider>,
  );
  return { html, title: content.metaTitle, description: content.metaDescription, lang };
}
