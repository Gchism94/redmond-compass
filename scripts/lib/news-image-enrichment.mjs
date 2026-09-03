/**
 * Resolve a representative image for a news row when the main-site NewsPost has
 * not supplied one. This runs in the scheduled sync, not in the browser: the
 * browser cannot reliably read publisher metadata because of CORS.
 */

import { isIP } from "node:net";

const MAX_HTML_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

/** Only fetch public HTTPS pages; never let authored content target local services. */
export function safePublicUrl(value, base) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(decodeHtml(value.trim()), base);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || isIP(hostname.replace(/^\[|\]$/g, ""))) return null;
    if (
      hostname === "localhost"
      || hostname === "::1"
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".local")
      || hostname.endsWith(".internal")
      || isPrivateIpv4(hostname)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

function linkSpecificity(value) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const dated = /\/20\d{2}(?:\/|-)\d{1,2}/.test(url.pathname) ? 20 : 0;
    const articleWords = segments.join("-").split(/[-_]/).filter(Boolean).length;
    return dated + segments.length * 4 + Math.min(articleWords, 12);
  } catch {
    return -1;
  }
}

/** Prefer article-like URLs over generic publisher home/category pages. */
export function newsSourceCandidates(row) {
  const sourceUrl = safePublicUrl(row.source_url);
  const bodyLinks = [];
  const markdownLink = /\[[^\]]*\]\((https?:\/\/[^\s)]+)(?:\s+["'][^)]*["'])?\)/gi;
  for (const match of String(row.body ?? "").matchAll(markdownLink)) {
    const url = safePublicUrl(match[1]);
    if (url) bodyLinks.push(url);
  }

  return [...new Set([sourceUrl, ...bodyLinks].filter(Boolean))]
    .sort((a, b) => linkSpecificity(b) - linkSpecificity(a));
}

function attributes(tag) {
  const result = new Map();
  const attribute = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(attribute)) result.set(match[1].toLowerCase(), decodeHtml(match[3]));
  return result;
}

/** Read the common publisher metadata formats without depending on a DOM parser. */
export function extractSocialImage(html, pageUrl) {
  const found = new Map();
  for (const tag of String(html ?? "").match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const key = (attrs.get("property") ?? attrs.get("name") ?? "").toLowerCase();
    const content = attrs.get("content");
    if (content && !found.has(key)) found.set(key, content);
  }

  for (const key of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    const image = safePublicUrl(found.get(key), pageUrl);
    if (image) return image;
  }
  return null;
}

async function readHtml(response) {
  const reader = response.body?.getReader?.();
  if (!reader) return (await response.text()).slice(0, MAX_HTML_BYTES);

  const decoder = new TextDecoder();
  let total = 0;
  let html = "";
  while (total < MAX_HTML_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (total >= MAX_HTML_BYTES || /<\/head\s*>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return html;
}

async function findNewsImage(row, fetchImpl, timeoutMs) {
  for (const sourceUrl of newsSourceCandidates(row).slice(0, 3)) {
    try {
      let pageUrl = sourceUrl;
      let response;
      for (let redirects = 0; redirects <= 3; redirects++) {
        response = await fetchImpl(pageUrl, {
          // Follow redirects ourselves so each destination passes the same public
          // HTTPS validation before the runner makes another request.
          redirect: "manual",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "RedmondCompassNewsBridge/1.0",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const redirectUrl = safePublicUrl(response.headers.get("location"), pageUrl);
        if (!redirectUrl) {
          response = null;
          break;
        }
        pageUrl = redirectUrl;
      }
      if (!response) continue;
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) continue;
      const finalUrl = safePublicUrl(response.url) ?? pageUrl;
      const image = extractSocialImage(await readHtml(response), finalUrl);
      if (image) return { image, sourceUrl };
    } catch {
      // A publisher rejecting automated metadata reads must not fail the news sync.
    }
  }
  return null;
}

/**
 * Enrich only the newest missing rows and use small batches so the scheduled job
 * stays polite to local publishers. Existing images are never fetched again.
 */
export async function enrichNewsImages(rows, {
  fetchImpl = fetch,
  limit = 12,
  concurrency = 3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const nextRows = rows.map((row) => ({ ...row }));
  const pending = nextRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.image && newsSourceCandidates(row).length > 0)
    .slice(0, limit);
  const enriched = [];
  const unresolved = [];

  for (let start = 0; start < pending.length; start += concurrency) {
    const batch = pending.slice(start, start + concurrency);
    const results = await Promise.all(batch.map(({ row }) => findNewsImage(row, fetchImpl, timeoutMs)));
    results.forEach((result, offset) => {
      const { row, index } = batch[offset];
      if (result) {
        nextRows[index].image = result.image;
        enriched.push({ id: row.id, image: result.image, sourceUrl: result.sourceUrl });
      } else {
        unresolved.push(row.id);
      }
    });
  }

  return { rows: nextRows, enriched, unresolved };
}
