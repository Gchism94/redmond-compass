#!/usr/bin/env node
// Read-only parity audit: authoritative redmondcompass.com Business records versus the
// Supabase read model served by the app. It never writes either system and never prints
// credentials. The `mainSiteMissingButAppHas` section is the handoff queue for information
// that should be copied back through the owner's existing main-site workflow.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MAIN_SITE_URL =
  "https://redmondcompass.com/api/apps/6a05e41957c8ee753cb7380c/functions/listBusinessesPublic";

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/g, "")]];
  }));
}

const fileEnv = readEnvFile(".env.production.local");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or use .env.production.local).");
  process.exit(1);
}

const normalizeName = (value = "") => value.normalize("NFKD").replace(/[^a-z0-9]+/gi, "").toLowerCase();
const text = (value) => typeof value === "string" ? value.trim() : "";
const hasUsableStructuredHours = (hours) => {
  const week = hours && typeof hours === "object" ? hours.week : null;
  if (!week || typeof week !== "object") return false;
  return Object.values(week).some((day) => day && typeof day === "object"
    && day.closed !== true && /^\d{2}:\d{2}$/.test(day.open) && /^\d{2}:\d{2}$/.test(day.close)
    && day.open !== day.close);
};
const hasAppHours = (row) => !!text(row.hours_text) || hasUsableStructuredHours(row.hours);
const sourceHours = (row) => text(row.hours);
const valuePresent = (value) => Array.isArray(value)
  ? value.length > 0
  : value && typeof value === "object"
    ? Object.keys(value).length > 0
    : !!text(value);
const sourceMissingAppValues = (source, app) => {
  if (!app) return {};
  const candidates = {
    description: [source.description, app.description],
    longDescription: [source.long_description, app.long_description],
    address: [source.address, app.address],
    phone: [source.phone, app.phone],
    website: [source.website, app.website],
    email: [source.email, app.email],
    image: [source.image_url, app.photos],
    messageLink: [source.message_link, app.message_link],
    licenseNumber: [source.license_number, app.license_number],
    licenseType: [source.license_type, app.license_type],
    specials: [source.specials, app.specials],
    specialsImage: [source.specials_image_url, app.specials_image_url],
    additionalLocations: [source.additional_locations, app.additional_locations],
    videos: [source.videos, app.videos],
    headshot: [source.headshot_url, app.headshot_url],
  };
  const corrections = Object.fromEntries(Object.entries(candidates)
    .filter(([, [sourceValue, appValue]]) => !valuePresent(sourceValue) && valuePresent(appValue))
    .map(([field, [, appValue]]) => [field, appValue]));
  if (!sourceHours(source) && hasAppHours(app)) {
    corrections.hours = text(app.hours_text) || app.hours;
  }
  const sourceSocials = ["facebook", "instagram", "tiktok", "youtube", "linkedin", "twitter", "pinterest"];
  for (const network of sourceSocials) {
    const appValue = app.socials?.[network];
    if (!valuePresent(source[network]) && valuePresent(appValue)) corrections[network] = appValue;
  }
  return corrections;
};

const response = await fetch(MAIN_SITE_URL, {
  headers: { Accept: "application/json", "User-Agent": "RedmondCompassParityAudit/1.0" },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`main-site business request failed (${response.status})`);
const payload = await response.json();
const sourceRawRows = (payload.businesses ?? [])
  .filter((row) => row.status === "approved" && row.profile_enabled === true);
const completeness = (row) => [row.hours, row.phone, row.website, row.email, row.address, row.description]
  .filter((value) => !!text(value)).length;
const sourceGroups = new Map();
for (const row of sourceRawRows) {
  const key = normalizeName(row.name) || `id:${row.id}`;
  sourceGroups.set(key, [...(sourceGroups.get(key) ?? []), row]);
}
const duplicateSourceRows = [];
const sourceRows = [];
for (const rows of sourceGroups.values()) {
  const ordered = [...rows].sort((a, b) =>
    completeness(b) - completeness(a)
    || text(b.updated_date).localeCompare(text(a.updated_date))
    || text(a.id).localeCompare(text(b.id)),
  );
  sourceRows.push(ordered[0]);
  if (ordered.length > 1) duplicateSourceRows.push({
    name: ordered[0].name,
    keptId: ordered[0].id,
    suppressedIds: ordered.slice(1).map((row) => row.id),
  });
}

const db = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const appRows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("businesses")
    // Read the current public shape so the audit also works during a staged rollout where
    // a new mirror column has not reached the hosted database yet.
    .select("*")
    .eq("published", true)
    .order("id")
    .range(from, from + 999);
  if (error) throw new Error(`could not read app businesses: ${error.message}`);
  appRows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
const sourceByName = new Map(sourceRows.map((row) => [normalizeName(row.name), row]));
const appById = new Map(appRows.map((row) => [row.id, row]));
const appByName = new Map(appRows.map((row) => [normalizeName(row.name), row]));

const matchingApp = (source) => appById.get(source.id) ?? appByName.get(normalizeName(source.name));
const matchingSource = (app) => sourceById.get(app.id) ?? sourceByName.get(normalizeName(app.name));
const mainSiteMissingButAppHas = sourceRows.flatMap((source) => {
  const app = matchingApp(source);
  const appValues = sourceMissingAppValues(source, app);
  return Object.keys(appValues).length
    ? [{ id: source.id, name: source.name, fields: Object.keys(appValues), appValues }]
    : [];
});
const missingEverywhere = sourceRows
  .filter((source) => !sourceHours(source) && !hasAppHours(matchingApp(source) ?? {}))
  .map((source) => ({ id: source.id, name: source.name }));
const sourceOnly = sourceRows
  .filter((source) => !matchingApp(source))
  .map((source) => ({ id: source.id, name: source.name }));
const appOnly = appRows
  .filter((app) => !matchingSource(app))
  .map((app) => ({ id: app.id, name: app.name, hasHours: hasAppHours(app) }));

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  readOnly: true,
  mainSitePublishedRows: sourceRawRows.length,
  mainSiteUniqueBusinesses: sourceRows.length,
  duplicateSourceRows,
  appPublishedRows: appRows.length,
  mainSiteHours: {
    present: sourceRows.filter((row) => !!sourceHours(row)).length,
    missing: sourceRows.filter((row) => !sourceHours(row)).length,
  },
  mainSiteMissingButAppHas: {
    count: mainSiteMissingButAppHas.length,
    rows: mainSiteMissingButAppHas,
  },
  missingEverywhere: { count: missingEverywhere.length, rows: missingEverywhere },
  sourceOnly: { count: sourceOnly.length, rows: sourceOnly },
  appOnly: { count: appOnly.length, rows: appOnly },
}, null, 2));
