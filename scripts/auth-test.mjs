// End-to-end auth + owner-path verification against local Supabase. Mirrors the real
// app flow: passwordless email OTP sign-in (signInWithOtp → verifyOtp), then the owner
// path (claim → edit → post bulletin → submit event) under RLS + entitlement triggers,
// plus the profiles row (auto-create + prefs persistence, own-row-only). Self-cleans.
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54421";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };
const anon = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

// Real app sign-in: signInWithOtp creates+emails the code; verifyOtp establishes the
// session. We fetch the emailed code deterministically via admin.generateLink instead of
// scraping the mailbox — verifyOtp is the exact call the AuthSheet makes.
async function signInUser(email, name) {
  const client = anon();
  const { error: otpErr } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { name } },
  });
  if (otpErr) throw new Error(`signInWithOtp: ${otpErr.message}`);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);
  const { data, error } = await client.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (error) throw new Error(`verifyOtp: ${error.message}`);
  return { client, id: data.user.id };
}

const ts = Date.now();
const A = await signInUser(`owner_a_${ts}@test.dev`, "Ada Owner");
const B = await signInUser(`owner_b_${ts}@test.dev`, "Ben Owner");
ok(!!A.id && !!B.id, "two owners signed in via email OTP (signInWithOtp → verifyOtp)");

// --- profiles: auto-created on signup; prefs persist; own-row only ---
{
  const { data: prof } = await admin.from("profiles").select("id").eq("id", A.id).maybeSingle();
  ok(!!prof, "profile row auto-created on signup (handle_new_user trigger)");

  const up = await A.client.from("profiles")
    .upsert({ id: A.id, saved_business_ids: ["b_1", "b_2"], followed_business_ids: ["b_3"], interests: ["Coffee"] })
    .select();
  ok(!up.error, "owner A persists prefs to own profile row (saveProfile path)");

  const rd = await A.client.from("profiles").select("saved_business_ids").eq("id", A.id).single();
  ok((rd.data?.saved_business_ids?.length ?? 0) === 2, "prefs read back from the profile row");

  const crossRead = await B.client.from("profiles").select("*").eq("id", A.id);
  ok((crossRead.data?.length ?? 0) === 0, "owner B cannot read owner A's profile (RLS own-row only)");

  const crossWrite = await B.client.from("profiles").upsert({ id: A.id, interests: ["hacked"] }).select();
  ok(!!crossWrite.error || (crossWrite.data?.length ?? 0) === 0, "owner B cannot write owner A's profile");
}

// --- owner path on a fresh unclaimed listing ---
const slug = `authtest-${ts}`;
const { data: biz, error: bizErr } = await admin.from("businesses")
  .insert({ name: "Auth Test Cafe", slug, category: "Cafe", tier: "free" })
  .select("id").single();
if (bizErr) throw new Error(`seed test business: ${bizErr.message}`);
const bizId = biz.id;

// CLAIM (via the claim_business RPC)
{
  const guest = await anon().rpc("claim_business", { b_id: bizId });
  ok(!!guest.error, "guest cannot claim (claim_business requires auth)");

  const c = await A.client.rpc("claim_business", { b_id: bizId });
  ok(!c.error, "owner A claims the unclaimed listing via claim_business RPC");

  const { data: chk } = await admin.from("businesses").select("owner_id, claimed").eq("id", bizId).single();
  ok(chk.owner_id === A.id && chk.claimed === true, "listing now owned + claimed by A");

  const c2 = await B.client.rpc("claim_business", { b_id: bizId });
  ok(!!c2.error, "owner B cannot claim an already-claimed listing");
}

// EDIT LISTING
{
  const e = await A.client.from("businesses").update({ description: "Under new management" }).eq("id", bizId).select();
  ok(!e.error && (e.data?.length ?? 0) === 1, "owner A edits own listing (Edit Listing)");

  const cross = await B.client.from("businesses").update({ name: "HACKED" }).eq("id", bizId).select();
  ok(!cross.error && (cross.data?.length ?? 0) === 0, "owner B cannot edit A's listing (cross-owner denied)");

  // entitlement triggers (free tier)
  const story = await A.client.from("businesses").update({ story: "premium story" }).eq("id", bizId).select();
  ok(!!story.error, "free tier cannot set Member-only 'story' (entitlement trigger)");

  const six = await A.client.from("businesses").update({ photos: ["1", "2", "3", "4", "5", "6"] }).eq("id", bizId).select();
  ok(!!six.error, "free tier capped at 5 photos (6 rejected)");

  const five = await A.client.from("businesses").update({ photos: ["1", "2", "3", "4", "5"] }).eq("id", bizId).select();
  ok(!five.error, "free tier allows exactly 5 photos");
}

// POST BULLETIN (free monthly cap → schedule, never destroys work)
{
  let live = 0;
  for (let i = 0; i < 3; i++) {
    const r = await A.client.from("bulletins").insert({ business_id: bizId, body: `Live update ${i + 1}`, status: "live" }).select();
    if (!r.error) live++;
  }
  ok(live === 3, "owner posts 3 free live bulletins this month");

  const fourth = await A.client.from("bulletins").insert({ business_id: bizId, body: "4th live", status: "live" }).select();
  ok(!!fourth.error, "4th live bulletin blocked by the free monthly cap");

  const scheduled = await A.client.from("bulletins")
    .insert({ business_id: bizId, body: "Scheduled for next month", status: "scheduled", scheduled_for: new Date(ts + 30 * 86400000).toISOString() })
    .select();
  ok(!scheduled.error, "capped post can still be SCHEDULED free (cap never destroys work)");

  const crossPost = await B.client.from("bulletins").insert({ business_id: bizId, body: "x", status: "live" }).select();
  ok(!!crossPost.error, "owner B cannot post bulletins to A's business");
}

// SUBMIT EVENT
{
  const ev = await A.client.from("events")
    .insert({ business_id: bizId, title: "Grand Reopening", start_at: new Date(ts + 2 * 86400000).toISOString(), status: "upcoming" })
    .select();
  ok(!ev.error, "owner A submits an event for own business");

  const crossEv = await B.client.from("events")
    .insert({ business_id: bizId, title: "x", start_at: new Date(ts + 3 * 86400000).toISOString(), status: "upcoming" })
    .select();
  ok(!!crossEv.error, "owner B cannot submit events for A's business");
}

// GUEST still browses with zero gate
{
  let reads = 0;
  for (const t of ["businesses", "events", "news_articles", "resources", "bulletins"]) {
    const { error } = await anon().from(t).select("*").limit(1);
    if (!error) reads++;
  }
  ok(reads === 5, "guest browses all content with zero gate (no auth)");
}

// --- cleanup (never leak test rows/users into seeded data) ---
await admin.from("businesses").delete().eq("id", bizId);        // cascades bulletins + events
await admin.from("businesses").delete().like("slug", "authtest-%");
await admin.auth.admin.deleteUser(A.id);                         // cascades profile
await admin.auth.admin.deleteUser(B.id);
const { data: list } = await admin.auth.admin.listUsers();
for (const u of list?.users ?? []) if (u.email?.endsWith("@test.dev")) await admin.auth.admin.deleteUser(u.id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
