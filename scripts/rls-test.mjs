// RLS verification. Proves the database refuses what the app assumes it refuses:
// guest reads work; guest and CROSS-USER writes are denied; a user cannot read or write
// another user's PROFILE (saved lists, follows, home location); an owner cannot publish
// content under another business's name; recommendations are insert-only/positive-only;
// tier gating holds; and no rating/boost column exists anywhere.
//
//   npm run test:rls                       # against the local stack (default)
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run test:rls
//
// Needs a running database. Locally:
//   supabase start -x vector,analytics,storage-api,imgproxy,studio,edge-runtime
//   (the full stack pulls in services this suite doesn't use and that can fail to boot;
//    Postgres + Auth + PostgREST is all it needs)
//
// NOT run in CI and NOT part of `npm test`, because it needs that database — run it
// before merging anything that touches supabase/migrations/**. It REFUSES to run against
// production; see the guard below.
import { createClient } from "@supabase/supabase-js";

// Defaults to the LOCAL stack; override via env to run against any project (e.g. hosted):
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/rls-test.mjs
// (Keys come from the env — never hard-coded for hosted, never committed.)
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";

// ── NEVER PRODUCTION ─────────────────────────────────────────────────────────────────────
// This test CREATES AND DELETES real auth users and businesses. Against the live project a
// crashed run mid-suite would leave test users and "rls-*" listings in the public directory,
// and the cleanup sweep at the bottom deletes every @test.dev user it finds — which is fine
// on a disposable database and unacceptable on the real one.
//
// Supabase branch databases would be the ideal target, but this project has none
// (`supabase branches list` → []; branching needs a paid plan). So: local stack by default,
// a branch database when one exists, and production only via an explicit, deliberate opt-in
// that no one will type by accident.
const PROD_REF = "jdrhcmkqtewlzlojixpd";
if (URL.includes(PROD_REF) && process.env.RLS_ALLOW_PROD !== "i-understand-this-writes-to-production") {
  console.error(
    `\nRefusing to run against the PRODUCTION project (${PROD_REF}).\n` +
      "This suite creates and deletes real users and businesses.\n\n" +
      "  Local:  supabase start && npm run test:rls\n" +
      "  Branch: SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run test:rls\n",
  );
  process.exit(1);
}
const ANON = process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

async function newUser(email) {
  await admin.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return { client: c, id: data.user.id };
}

// --- setup: two owners + a business each (service role bypasses RLS to seed) ---
const a = await newUser(`a_${Date.now()}@test.dev`);
const b = await newUser(`b_${Date.now()}@test.dev`);
const mk = async (owner, slug) => {
  const { data, error } = await admin.from("businesses")
    .insert({ name: slug, slug, category: "Cafe", owner_id: owner, tier: "free" }).select("id").single();
  if (error) throw new Error(`mk insert failed: ${error.message} | ${error.details ?? ""} | ${error.hint ?? ""}`);
  return data.id;
};
const bizA = await mk(a.id, `rls-a-${Date.now()}`);
const bizB = await mk(b.id, `rls-b-${Date.now()}`);

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

// 1) GUEST READ works (all five)
for (const t of ["businesses", "bulletins", "events", "news_articles", "resources"]) {
  const { error } = await anon.from(t).select("*").limit(1);
  ok(!error, `guest reads ${t}`);
}

// 2) GUEST WRITE denied
{
  const upd = await anon.from("businesses").update({ name: "HACKED" }).eq("id", bizA).select();
  ok(!!upd.error || (upd.data?.length ?? 0) === 0, "guest cannot update a business (denied)");
  const ins = await anon.from("news_articles").insert({ title: "x", slug: `x${Date.now()}`, source: "x" }).select();
  ok(!!ins.error, "guest cannot insert news (RLS)");
  const rec = await anon.from("recommendations").insert({ business_id: bizA, user_id: a.id }).select();
  ok(!!rec.error, "guest cannot insert recommendation (RLS)");
}

// 3) OWNER write own = ok; CROSS-OWNER write denied
{
  const own = await a.client.from("businesses").update({ description: "mine" }).eq("id", bizA).select();
  ok(!own.error && (own.data?.length ?? 0) === 1, "owner A updates own business");
  const cross = await a.client.from("businesses").update({ name: "HACKED" }).eq("id", bizB).select();
  ok(!cross.error && (cross.data?.length ?? 0) === 0, "owner A CANNOT update owner B's business (0 rows)");
  const { data: bCheck } = await admin.from("businesses").select("name").eq("id", bizB).single();
  ok(bCheck.name !== "HACKED", "owner B's business unchanged after cross-owner attempt");
}

// 4) TIER gating (free cannot set enhanced profile)
{
  const e = await a.client.from("businesses").update({ story: "our story" }).eq("id", bizA).select();
  ok(!!e.error, "free tier cannot set Member-only 'story' (entitlement trigger)");
}

// 5) RECOMMENDATIONS positive-only / insert-only
{
  const r1 = await a.client.from("recommendations").insert({ business_id: bizB, user_id: a.id }).select();
  ok(!r1.error, "authed user can recommend");
  const r2 = await a.client.from("recommendations").insert({ business_id: bizB, user_id: a.id }).select();
  ok(!!r2.error, "duplicate recommendation rejected (unique → can't be bombed)");
  const r3 = await a.client.from("recommendations").insert({ business_id: bizB, user_id: b.id }).select();
  ok(!!r3.error, "cannot recommend as someone else (auth.uid()=user_id)");
  const rating = await a.client.from("recommendations").insert({ business_id: bizB, user_id: a.id, rating: 5 }).select();
  ok(!!rating.error, "no rating column exists on recommendations (positive-only)");
  // count bumped on businesses (positive-only cache)
  const { data: bc } = await admin.from("businesses").select("recommend_count").eq("id", bizB).single();
  ok(bc.recommend_count === 1, "recommend_count incremented to 1 (count can only rise)");
}

// 6) No boost/featured ordering column exists anywhere (schema-level guarantee)
{
  const probe = await admin.from("businesses").select("boost,featured,rank,sponsored").limit(1);
  ok(!!probe.error, "no boost/featured/rank/sponsored column on businesses (equal ranking)");
}

// 7) PUBLISHED gating (Sheet-sync visibility): unpublished hidden from anon, owner still sees own
{
  const { data: unpub } = await admin
    .from("businesses")
    .insert({ name: "rls-unpub", slug: `rls-unpub-${Date.now()}`, category: "Cafe", owner_id: a.id, tier: "free", published: false })
    .select("id")
    .single();
  const anonSee = await anon.from("businesses").select("id").eq("id", unpub.id);
  ok((anonSee.data?.length ?? 0) === 0, "anon CANNOT see an unpublished business (published=false hidden)");
  const ownerSee = await a.client.from("businesses").select("id").eq("id", unpub.id);
  ok((ownerSee.data?.length ?? 0) === 1, "owner CAN still see their own unpublished business");
  await admin.from("businesses").delete().eq("id", unpub.id);
}

// 8) sync_runs is service-role only (audit log; no anon/authenticated access)
{
  const anonRead = await anon.from("sync_runs").select("id").limit(1);
  ok(!!anonRead.error || (anonRead.data?.length ?? 0) === 0, "anon cannot read sync_runs (audit log locked)");
  const userRead = await a.client.from("sync_runs").select("id").limit(1);
  ok(!!userRead.error || (userRead.data?.length ?? 0) === 0, "authed user cannot read sync_runs");
  const adminIns = await admin.from("sync_runs").insert({ status: "success", trigger: "manual" }).select("id").single();
  ok(!adminIns.error && !!adminIns.data?.id, "service_role can log a sync_run");
  if (adminIns.data?.id) await admin.from("sync_runs").delete().eq("id", adminIns.data.id);
}

// 9) PROFILES — own row only. The most sensitive table in the schema: saved lists,
//    followed businesses, interests, and the user's HOME LOCATION. Until 2026-08-13 this
//    table had ZERO coverage here — the policies read correctly, but "reads correctly" is
//    what every bug in the August audit also looked like.
{
  // Both users already have a profile row (the on_auth_user_created trigger inserts one),
  // so seed each with distinguishable data rather than creating rows.
  await admin.from("profiles").update({ interests: ["a-private"] }).eq("id", a.id);
  await admin.from("profiles").update({ interests: ["b-private"], location: { lat: 44.27, lng: -121.17 } }).eq("id", b.id);

  const own = await a.client.from("profiles").select("*").eq("id", a.id);
  ok(!own.error && (own.data?.length ?? 0) === 1, "profiles: A reads their OWN row");

  const cross = await a.client.from("profiles").select("*").eq("id", b.id);
  ok(!cross.error && (cross.data?.length ?? 0) === 0, "profiles: A CANNOT read B's row (0 rows)");

  // The filtered read above would still pass if RLS were broken but the filter did the
  // work. An UNFILTERED select is the real leak test — it asks the table for everything.
  const all = await a.client.from("profiles").select("id");
  ok(!all.error && (all.data ?? []).every((r) => r.id === a.id) && (all.data?.length ?? 0) === 1,
     `profiles: unfiltered select returns ONLY A's row (got ${all.data?.length ?? 0})`);

  const updOwn = await a.client.from("profiles").update({ onboarded: true }).eq("id", a.id).select();
  ok(!updOwn.error && (updOwn.data?.length ?? 0) === 1, "profiles: A updates their OWN row");

  const updCross = await a.client.from("profiles").update({ interests: ["HACKED"] }).eq("id", b.id).select();
  ok(!updCross.error && (updCross.data?.length ?? 0) === 0, "profiles: A CANNOT update B's row (0 rows)");
  const { data: bAfter } = await admin.from("profiles").select("interests").eq("id", b.id).single();
  ok(!(bAfter?.interests ?? []).includes("HACKED"), "profiles: B's row is unchanged after A's write attempt");

  // with check (auth.uid() = id) — A must not be able to create a row under B's id either.
  const insCross = await a.client.from("profiles").insert({ id: b.id, interests: ["HACKED"] }).select();
  ok(!!insCross.error, "profiles: A cannot INSERT a row under B's id");

  // anon has no GRANT on profiles at all (the profiles migration grants only to
  // authenticated/service_role), so this is denied a level below RLS.
  const anonRead = await anon.from("profiles").select("id").limit(1);
  ok(!!anonRead.error, "profiles: anon has NO access at all (grant withheld, not just RLS)");

  // There is intentionally no delete policy — not even for your own row. Account deletion
  // goes through the delete-account edge function (service role), never the client.
  const delOwn = await a.client.from("profiles").delete().eq("id", a.id).select();
  ok(!!delOwn.error || (delOwn.data?.length ?? 0) === 0, "profiles: A cannot DELETE even their own row");
  const { data: survives } = await admin.from("profiles").select("id").eq("id", a.id);
  ok((survives?.length ?? 0) === 1, "profiles: A's row survives the delete attempt");
}

// 10) CONTENT FORGERY — can owner A publish under owner B's business name?
//     `bulletins_insert` and `events_insert` both guard on is_business_owner(business_id).
//     A read leak exposes data; this would let someone put words in another business's
//     mouth on a community directory, so it's tested with positive controls either side.
{
  const ownBul = await a.client.from("bulletins").insert({ business_id: bizA, body: "legitimate post" }).select();
  ok(!ownBul.error && (ownBul.data?.length ?? 0) === 1, "bulletins: owner A CAN post for their own business (control)");

  const forgedBul = await a.client.from("bulletins").insert({ business_id: bizB, body: "posted as B" }).select();
  ok(!!forgedBul.error, "bulletins: owner A CANNOT post under owner B's business (forgery denied)");

  const soon = new Date(Date.now() + 7 * 864e5).toISOString();
  const ownEv = await a.client.from("events").insert({ business_id: bizA, title: "legit event", start_at: soon }).select();
  ok(!ownEv.error && (ownEv.data?.length ?? 0) === 1, "events: owner A CAN submit for their own business (control)");

  const forgedEv = await a.client.from("events").insert({ business_id: bizB, title: "event as B", start_at: soon }).select();
  ok(!!forgedEv.error, "events: owner A CANNOT submit under owner B's business (forgery denied)");

  // events_insert requires business_id not null — no anonymous community events from the
  // client, which would otherwise be an unattributed write channel into the public feed.
  const orphanEv = await a.client.from("events").insert({ business_id: null, title: "unattributed", start_at: soon }).select();
  ok(!!orphanEv.error, "events: a client cannot create an unattributed (business_id null) event");

  // Assert on the DATABASE, not just the API response: nothing landed under B either way.
  const { data: bBul } = await admin.from("bulletins").select("id").eq("business_id", bizB);
  ok((bBul?.length ?? 0) === 0, "no forged bulletin exists under B's business");
  const { data: bEv } = await admin.from("events").select("id").eq("business_id", bizB);
  ok((bEv?.length ?? 0) === 0, "no forged event exists under B's business");
}

// --- cleanup (test rows must never leak into the seeded app data) ---
// Deleting the businesses cascades to their bulletins/events (both FK on delete cascade).
await admin.from("businesses").delete().in("id", [bizA, bizB]);
await admin.from("businesses").delete().like("slug", "rls-%"); // any leftovers from a prior crash
await admin.auth.admin.deleteUser(a.id);
await admin.auth.admin.deleteUser(b.id);
// sweep any leftover @test.dev users from a prior crashed run
const { data: list } = await admin.auth.admin.listUsers();
for (const u of list?.users ?? []) if (u.email?.endsWith("@test.dev")) await admin.auth.admin.deleteUser(u.id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
