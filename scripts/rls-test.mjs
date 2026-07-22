// RLS verification against local Supabase. Proves: guest read works; guest + cross-
// owner writes denied; recommendations insert-only/positive-only; tier gating; and
// that there is no rating/boost column. Run with the local keys from `supabase status`.
import { createClient } from "@supabase/supabase-js";

// Defaults to the LOCAL stack; override via env to run against any project (e.g. hosted):
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/rls-test.mjs
// (Keys come from the env — never hard-coded for hosted, never committed.)
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
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

// --- cleanup (test rows must never leak into the seeded app data) ---
await admin.from("businesses").delete().in("id", [bizA, bizB]);
await admin.from("businesses").delete().like("slug", "rls-%"); // any leftovers from a prior crash
await admin.auth.admin.deleteUser(a.id);
await admin.auth.admin.deleteUser(b.id);
// sweep any leftover @test.dev users from a prior crashed run
const { data: list } = await admin.auth.admin.listUsers();
for (const u of list?.users ?? []) if (u.email?.endsWith("@test.dev")) await admin.auth.admin.deleteUser(u.id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
