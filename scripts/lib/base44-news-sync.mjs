/** Pure planning logic for the temporary main-site NewsPost → Supabase bridge. */

export const MAIN_SITE_URL = "https://redmondcompass.com";
export const BASE44_APP_ID = "6a05e41957c8ee753cb7380c";

export function newsFeedUrl(siteUrl = MAIN_SITE_URL) {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/api/apps/${BASE44_APP_ID}/entities/NewsPost?sort=-published_date&limit=5000`;
}

export function slugify(value) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "") || "news";
}

function publishedAt(record) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(record.published_date ?? "")) {
    // Noon UTC keeps the authored calendar date intact in Redmond. A bare date would be
    // interpreted as UTC midnight and display as the previous day in Pacific time.
    return `${record.published_date}T12:00:00Z`;
  }
  return record.published_date || record.created_date || new Date(0).toISOString();
}

export function buildNewsSyncPlan(records, existing = []) {
  if (!Array.isArray(records)) {
    return { ok: false, abortReason: "Main-site NewsPost response was not an array.", rows: [], skipped: [], warnings: [] };
  }
  if (records.length === 0 && existing.length > 0) {
    return { ok: false, abortReason: "Main-site NewsPost feed returned 0 rows while Supabase already has news; refusing a silent empty sync.", rows: [], skipped: [], warnings: [] };
  }

  const slugById = new Map(existing.map((row) => [row.id, row.slug]));
  const taken = new Set(existing.map((row) => row.slug).filter(Boolean));
  const seen = new Set();
  const rows = [];
  const skipped = [];
  const warnings = [];

  for (const record of records) {
    if (!record?.id || !record?.title) {
      skipped.push({ id: record?.id ?? null, reason: "missing id or title" });
      continue;
    }
    if (seen.has(record.id)) {
      warnings.push({ id: record.id, reason: "duplicate id in upstream response; kept first row" });
      continue;
    }
    seen.add(record.id);

    let slug = slugById.get(record.id);
    if (!slug) {
      const base = slugify(record.title);
      slug = base;
      if (taken.has(slug)) slug = `${base.slice(0, 64).replace(/-+$/g, "")}-${String(record.id).slice(-7)}`;
      let suffix = 2;
      while (taken.has(slug)) slug = `${base.slice(0, 66).replace(/-+$/g, "")}-${suffix++}`;
    }
    taken.add(slug);

    rows.push({
      id: record.id,
      title: record.title.trim(),
      slug,
      excerpt: record.summary ?? "",
      body: record.body ?? "",
      image: record.image_url || null,
      source: record.source_name || "Redmond Compass",
      author: null,
      published_at: publishedAt(record),
      category: record.category || null,
      pinned: !!record.pinned,
      source_url: record.source_url || null,
    });
  }

  return { ok: true, rows, skipped, warnings };
}
