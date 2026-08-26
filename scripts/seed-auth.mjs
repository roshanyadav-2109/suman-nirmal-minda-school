// Create/refresh the demo auth users and their profile links (idempotent).
//   node scripts/seed-auth.mjs
import "node:process";
const REF = process.env.SUPABASE_REF || "qyiqdwrjtgdzocoffzvk";
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
if (!MGMT_TOKEN || !SERVICE) { console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_SERVICE_ROLE"); process.exit(1); }
const MGMT_URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const AUTH_URL = `https://${REF}.supabase.co/auth/v1`;
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function runSql(query) {
  const res = await fetch(MGMT_URL, { method: "POST",
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }) });
  const t = await res.text();
  if (!res.ok) { console.error("SQL FAILED:", t.slice(0, 800)); throw new Error("sql"); }
  try { return JSON.parse(t); } catch { return []; }
}
async function createUser(email, password, fullName) {
  const res = await fetch(`${AUTH_URL}/admin/users`, { method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }) });
  if (res.ok) return (await res.json()).id;
  const body = await res.text();
  const list = await fetch(`${AUTH_URL}/admin/users?per_page=200`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  const lj = await list.json();
  const u = (lj.users || []).find((x) => x.email === email);
  if (!u) { console.error("create failed & not found:", email, body.slice(0, 300)); throw new Error("user"); }
  await fetch(`${AUTH_URL}/admin/users/${u.id}`, { method: "PUT",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }) });
  return u.id;
}

const PW = "kviit@demo1";
const demos = [
  { email: "principal@kv.demo",    name: "Dr. Sudeshna Banerjee", role: "staff",    link: { staff: "P01" } },
  { email: "office@kv.demo",       name: "Mr. Amit Kar",          role: "staff",    link: { staff: "O01" } },
  { email: "classteacher@kv.demo", name: "Mrs. Anindita Sen",     role: "staff",    link: { staff: "CT01" } },
  { email: "teacher@kv.demo",      name: "Mr. Rajarshi Dutta",    role: "staff",    link: { staff: "ST07" } },
  { email: "parent@kv.demo",       name: "Demo Parent",           role: "guardian", link: { guardianEmail: "parent@kv.demo" } },
  { email: "student@kv.demo",      name: "Demo Student",          role: "student",  link: { student: "S0001" } },
];
for (const d of demos) {
  const uid = await createUser(d.email, PW, d.name);
  let staffId = "null", guardianId = "null", studentId = "null", name = d.name;
  if (d.link.staff) staffId = `(select id from public.staff where employee_code=${q(d.link.staff)})`;
  if (d.link.guardianEmail) guardianId = `(select id from public.guardian where email=${q(d.link.guardianEmail)})`;
  if (d.link.student) { studentId = `(select id from public.student where admission_no=${q(d.link.student)})`;
    name = (await runSql(`select full_name from public.student where admission_no=${q(d.link.student)}`))[0].full_name; }
  await runSql(`insert into public.profile (id, role, full_name, staff_id, guardian_id, student_id)
    values ('${uid}', ${q(d.role)}, ${q(name)}, ${staffId}, ${guardianId}, ${studentId})
    on conflict (id) do update set role=excluded.role, full_name=excluded.full_name,
      staff_id=excluded.staff_id, guardian_id=excluded.guardian_id, student_id=excluded.student_id;`);
  console.log(`  ${d.email.padEnd(24)} → ${d.role} (${name})`);
}
console.log("Demo logins ready. Password for all:", PW);
