// Prove RLS: sign in as each demo role and count what the API returns.
//   node scripts/verify-rls.mjs
const REF = process.env.SUPABASE_REF || "qyiqdwrjtgdzocoffzvk";
const ANON = process.env.SUPABASE_ANON;
const BASE = `https://${REF}.supabase.co`;
const PW = "kviit@demo1";

async function login(email) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("login failed " + email + " " + JSON.stringify(j));
  return j.access_token;
}
async function count(token, path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, Prefer: "count=exact", Range: "0-0" } });
  return Number(r.headers.get("content-range")?.split("/")?.[1] ?? "?");
}
// Attempt a write and report whether the policy refused it.
async function tryInsert(token, table, row) {
  const r = await fetch(`${BASE}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json",
               Prefer: "return=representation" },
    body: JSON.stringify(row) });
  return { ok: r.ok, status: r.status };
}

const roles = ["principal", "classteacher", "teacher", "parent", "student"];
console.log("role          students  marks  attendance  slippage  announcements");
for (const role of roles) {
  const t = await login(`${role}@kv.demo`);
  const s  = await count(t, "student?select=id");
  const m  = await count(t, "mark?select=id");
  const a  = await count(t, "attendance_record?select=id");
  const sl = await count(t, "slippage_flag?select=id");
  const an = await count(t, "announcement?select=id");
  console.log(`${role.padEnd(13)} ${String(s).padStart(7)} ${String(m).padStart(7)} ${String(a).padStart(9)} ${String(sl).padStart(9)} ${String(an).padStart(13)}`);
}
console.log("\nExpected: principal sees all; teacher(Math VIII)=90 students & Math-only marks;");
console.log("class teacher(VIII-A)=30 students, all subjects; parent=2 children; student=self only; slippage never to parent/student.");

// ---------------------------------------------------------------------------
// Transport (0022–0024). Skipped cleanly until the transport seed has run.
// ---------------------------------------------------------------------------
const probe = await login("principal@kv.demo");
if (await count(probe, "bus?select=id") === 0) {
  console.log("\nTransport: no buses seeded yet — skipping (run scripts/seed-transport.mjs).");
  process.exit(0);
}

const tRoles = [...roles, "conductor"];
console.log("\nrole          buses  live  allocations  pings  stop events  alerts");
for (const role of tRoles) {
  let t;
  try { t = await login(`${role}@kv.demo`); }
  catch { console.log(`${role.padEnd(13)} (no such demo account — skipped)`); continue; }
  const b  = await count(t, "bus?select=id");
  const l  = await count(t, "bus_live?select=bus_id");
  const al = await count(t, "student_transport?select=id");
  const p  = await count(t, "trip_ping?select=id");
  const se = await count(t, "trip_stop_event?select=id");
  const ta = await count(t, "transport_alert?select=id");
  console.log(`${role.padEnd(13)} ${String(b).padStart(5)} ${String(l).padStart(5)} ${String(al).padStart(12)} ${String(p).padStart(6)} ${String(se).padStart(12)} ${String(ta).padStart(7)}`);
}
console.log("\nExpected: routes/buses are published info (everyone sees the fleet);");
console.log("live = ONLY the bus their own child rides (parent/student 1, conductor 1, office all);");
console.log("pings = 0 for parent and student always — the breadcrumb trail is staff-only;");
console.log("alerts = own children only.");

// Negative write probe: a parent must not be able to forge a position.
const parent = await login("parent@kv.demo");
const [anyTrip] = await (await fetch(`${BASE}/rest/v1/trip?select=id&limit=1`, {
  headers: { apikey: ANON, Authorization: `Bearer ${probe}` } })).json();
if (anyTrip) {
  const forged = await tryInsert(parent, "trip_ping",
    { trip_id: anyTrip.id, lat: 23.0225, lng: 72.5714 });
  console.log(`\nParent forging a GPS ping: ${forged.ok ? "ACCEPTED — RLS HOLE" : `refused (${forged.status}) ✓`}`);
}
