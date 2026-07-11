/**
 * Content-page model (Stage 1 Phase 2 — the live site's guides, migrated from
 * Base44; sources in migration/content/). Pages are DATA: each guide is a typed
 * EN + ES pair rendered by GuideScreen, and each guide lives in its own lazy
 * chunk so the copy never touches the entry bundle. Spanish is a full parallel
 * GuideContent — the type keeps the two structurally honest.
 */

export interface GuideItem {
  title: string;
  body?: string;
  /** small print under the body: hours, texting instructions, fees */
  note?: string;
  /** renders the amber Call button (one primary CTA per card) */
  phone?: string;
  /** renders the bordered Open button */
  url?: string;
  /** internal route — renders a chevron link row instead of buttons */
  to?: string;
}

export interface GuideSection {
  heading: string;
  /** small line under the heading ("Available 24/7") */
  kicker?: string;
  body?: string;
  bullets?: string[];
  items?: GuideItem[];
  image?: { src: string; alt: string };
}

/** Highlighted "start here" box (dial 211, sign up for Deschutes Alerts). */
export interface GuideCallout {
  title?: string;
  body: string;
  phone?: string;
  url?: string;
}

export interface GuideContent {
  /** short name — header bar, nav labels */
  name: string;
  /** eyebrow above the headline */
  kicker?: string;
  /** display headline (rendered only when it differs from name) */
  title: string;
  intro?: string;
  callout?: GuideCallout;
  sections: GuideSection[];
  /** "More on Redmond Compass" internal links */
  related?: { label: string; to: string }[];
  /** accuracy disclaimer at the foot of the page */
  footnote?: string;
  /** "Last reviewed …" */
  reviewed?: string;
  /** sentence inviting corrections/additions — renders with a mailto button */
  contactEmail?: string;
  metaTitle: string;
  metaDescription: string;
}

export interface Guide {
  slug: string;
  en: GuideContent;
  es: GuideContent;
}
