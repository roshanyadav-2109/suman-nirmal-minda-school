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
