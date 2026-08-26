// =============================================================================
// Seed the 2025-26 session by PROMOTING the 2024-25 cohort one class up, with a
// fresh Class I intake and full data (allotments, exams, marks, attendance,
// communications). Class XII of 2024-25 graduates (alumni, no 2025-26 entry).
//
// Runs entirely over the PostgREST data API with the service-role key
// (no Management API token needed).  node scripts/seed-2025-26.mjs
// =============================================================================
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function sel(path) {
  const out = [], step = 1000;
  for (let off = 0; ; off += step) {
    const res = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}limit=${step}&offset=${off}`, { headers: H });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
    const rows = await res.json(); out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}
async function insert(table, rows, batch = 2000) {
  for (let i = 0; i < rows.length; i += batch) {
    const res = await fetch(`${BASE}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + batch)) });
    if (!res.ok) throw new Error(`INSERT ${table} → ${res.status} ${(await res.text()).slice(0, 400)}`);
  }
}
async function insertReturning(table, rows, batch = 1000) {
  const out = [];
  for (let i = 0; i < rows.length; i += batch) {
    const res = await fetch(`${BASE}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows.slice(i, i + batch)) });
    if (!res.ok) throw new Error(`INSERT ${table} → ${res.status} ${(await res.text()).slice(0, 400)}`);
    out.push(...await res.json());
  }
  return out;
}
async function patch(table, query, body) {
  const res = await fetch(`${BASE}/${table}?${query}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PATCH ${table} → ${res.status} ${await res.text()}`);
}
async function del(table, query) {
  const res = await fetch(`${BASE}/${table}?${query}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
  if (!res.ok) throw new Error(`DELETE ${table} → ${res.status} ${await res.text()}`);
}

// deterministic PRNG per student so marks/attendance are stable across re-runs
function prng(seed) { let s = seed >>> 0; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n, w) => String(n).padStart(w, "0");

const maleFirst = ["Aarav","Rohan","Aditya","Arjun","Ishaan","Soham","Aryan","Rudra","Kabir","Vivaan","Ayaan","Dev","Reyansh","Arnav","Ansh","Sourav","Debjit","Arka","Rishav","Snehashish","Ritwik","Subhankar","Pritam","Anirban","Sayan","Tanmoy","Diptayan","Abhronil","Sagnik","Rajarshi"];
const femaleFirst = ["Aadhya","Ananya","Diya","Ira","Myra","Sara","Aarohi","Anika","Kiara","Riya","Navya","Prisha","Trisha","Ishani","Meghna","Rimjhim","Sohini","Ankita","Poulomi","Debolina","Srijita","Ritika","Paromita","Ahana","Oindrila","Madhurima","Susmita","Antara","Rupsa","Barsha"];
const surnames = ["Sharma","Verma","Gupta","Nair","Iyer","Reddy","Das","Ghosh","Banerjee","Chatterjee","Mukherjee","Bose","Dutta","Sen","Roy","Chakraborty","Bhattacharya","Sarkar","Mondal","Pal","Dey","Kar","Saha","Nag","Basu","Rao","Menon","Singh","Yadav","Mishra"];

const YEAR = "2025-26";
function subjectsFor(level, secName) {
  if (level <= 2) return ["ENG","HIN","MATH","EVS"];
  if (level <= 5) return ["ENG","HIN","MATH","EVS","COMP"];
  if (level <= 8) return ["ENG","HIN","SANS","MATH","SCI","SST"];
  if (level <= 10) return ["ENG","HIN","MATH","SCI","SST","IT"];
  if (secName.startsWith("Sci")) return ["ENG","PHY","CHEM","MATH","BIO","COMP"];
  if (secName === "Com") return ["ENG","ACC","BST","ECO","MATH"];
  return ["ENG","HIST","POL","GEO","ECO"];
}
const EXAMS = [
  { name:"Periodic Test 1",         type:"periodic_test", term:1, max:40, date:"2025-07-22" },
  { name:"Half-Yearly Examination", type:"half_yearly",   term:1, max:80, date:"2025-09-23" },
  { name:"Periodic Test 2",         type:"periodic_test", term:2, max:40, date:"2025-11-18" },
  { name:"Final Examination",       type:"annual",        term:2, max:80, date:"2026-02-24" },
];
const MONTHLY = [
  { name:"Monthly Test — July",     type:"periodic_test", term:1, max:20, date:"2025-07-08" },
  { name:"Monthly Test — August",   type:"periodic_test", term:1, max:20, date:"2025-08-12" },
  { name:"Monthly Test — December", type:"periodic_test", term:2, max:20, date:"2025-12-16" },
  { name:"Monthly Test — January",  type:"periodic_test", term:2, max:20, date:"2026-01-13" },
];
const examsFor = (level) => level >= 9 ? [...EXAMS, ...MONTHLY] : EXAMS;

const FROM = 5, TO = 6;   // academic_year ids

console.log("Loading current structure…");
const classes = await sel("class?select=id,level,name");
const sections = await sel("section?select=id,name,class_id");
const subjects = await sel("subject?select=id,code");
const atypes = await sel("assessment_type?select=id,code");
const staff = await sel("staff?select=id,employee_code,role");
const students = await sel("student?select=id,full_name,gender,admission_no");
const enr24 = await sel(`student_enrollment?select=student_id,section_id,roll_no&academic_year_id=eq.${FROM}`);
const allot24 = await sel(`teacher_allotment?select=staff_id,section_id,subject_id,is_class_teacher&academic_year_id=eq.${FROM}`);

const classByLevel = Object.fromEntries(classes.map((c) => [c.level, c]));
const secById = Object.fromEntries(sections.map((s) => [s.id, s]));
const levelOfSection = Object.fromEntries(sections.map((s) => [s.id, classes.find((c) => c.id === s.class_id).level]));
const sectionsByLevel = {}; for (const s of sections) { const lvl = classes.find((c) => c.id === s.class_id).level; (sectionsByLevel[lvl] ||= []).push(s); }
for (const lvl in sectionsByLevel) sectionsByLevel[lvl].sort((a, b) => a.name.localeCompare(b.name));
const subId = Object.fromEntries(subjects.map((s) => [s.code, s.id]));
const atId = Object.fromEntries(atypes.map((a) => [a.code, a.id]));
const nameById = Object.fromEntries(students.map((s) => [s.id, s.full_name]));
const principal = staff.find((s) => s.role === "principal")?.id ?? staff[0].id;
console.log(`  ${classes.length} classes, ${sections.length} sections, ${enr24.length} enrollments in 2024-25`);

// --- CLEAN any prior 2025-26 build ------------------------------------------
console.log("Clearing prior 2025-26 rows…");
const oldA = await sel(`assessment?select=id&academic_year_id=eq.${TO}`);
if (oldA.length) { const ids = oldA.map((a) => a.id); for (let i = 0; i < ids.length; i += 100) await del("mark", `assessment_id=in.(${ids.slice(i, i + 100).join(",")})`); }
await del("attendance_record", `academic_year_id=eq.${TO}`);
await del("assessment", `academic_year_id=eq.${TO}`);
await del("slippage_flag", `academic_year_id=eq.${TO}`);
await del("monthly_report", `academic_year_id=eq.${TO}`);
await del("announcement", `academic_year_id=eq.${TO}`);
await del("event", `academic_year_id=eq.${TO}`);
await del("teacher_allotment", `academic_year_id=eq.${TO}`);
await del("student_enrollment", `academic_year_id=eq.${TO}`);
await del("promotion", `to_year_id=eq.${TO}`);
await del("student", "admission_no=like.KV25*");                       // prior new-intake pupils
await patch("student", "status=neq.active", { status: "active", left_on: null, exit_remark: null });

// --- Build promotion assignments --------------------------------------------
// enrollment -> { studentId, fromSecId, fromLevel, toSecId|null (null = graduate) }
function targetSection(fromLevel, fromSecName) {
  if (fromLevel === 12) return null;                                   // graduate
  const toLevel = fromLevel + 1;
  const secs = sectionsByLevel[toLevel];
  if (toLevel === 11) return null;                                     // decided by stream distribution below
  if (fromLevel === 11) return secs.find((s) => s.name === fromSecName) ?? secs[0]; // keep stream
  return "even";                                                       // even distribution across secs
}

// group by (toLevel) for even distribution and stream handling
const assign = new Map();      // studentId -> { fromSecId, toSecId|null, outcome }
const evenBuckets = {};        // toLevel -> [studentIds]
const streamXI = [];           // class X students needing a stream
for (const e of enr24) {
  const fromLevel = levelOfSection[e.section_id];
  const fromSecName = secById[e.section_id].name;
  const t = targetSection(fromLevel, fromSecName);
  if (fromLevel === 12) { assign.set(e.student_id, { fromSecId: e.section_id, toSecId: null, outcome: "graduated" }); continue; }
  if (fromLevel === 10) { streamXI.push({ studentId: e.student_id, fromSecId: e.section_id }); continue; }
  if (t === "even") { (evenBuckets[fromLevel + 1] ||= []).push({ studentId: e.student_id, fromSecId: e.section_id }); continue; }
  assign.set(e.student_id, { fromSecId: e.section_id, toSecId: t.id, outcome: "promoted" });   // XI->XII keep stream
}
// even distribution across target sections (sorted by pupil name for stable rolls)
for (const toLevel in evenBuckets) {
  const secs = sectionsByLevel[toLevel];
  const list = evenBuckets[toLevel].sort((a, b) => (nameById[a.studentId] || "").localeCompare(nameById[b.studentId] || ""));
  list.forEach((it, i) => assign.set(it.studentId, { fromSecId: it.fromSecId, toSecId: secs[i % secs.length].id, outcome: "promoted" }));
}
// Class X -> XI streams (Arts ~20%, Com ~27%, Sci ~53% split across Sci sections)
{
  const secs = sectionsByLevel[11];
  const arts = secs.find((s) => s.name === "Arts"), com = secs.find((s) => s.name === "Com");
  const sci = secs.filter((s) => s.name.startsWith("Sci"));
  const list = streamXI.sort((a, b) => (nameById[a.studentId] || "").localeCompare(nameById[b.studentId] || ""));
  const nArts = Math.round(list.length * 0.205), nCom = Math.round(list.length * 0.267);
  list.forEach((it, i) => {
    let sec;
    if (i < nArts) sec = arts; else if (i < nArts + nCom) sec = com; else sec = sci[(i - nArts - nCom) % sci.length];
    assign.set(it.studentId, { fromSecId: it.fromSecId, toSecId: sec.id, outcome: "promoted" });
  });
}

// --- New Class I intake ------------------------------------------------------
console.log("Creating fresh Class I intake…");
const classISecs = sectionsByLevel[1];
const INTAKE = 117;
const newStuRows = [];
for (let i = 1; i <= INTAKE; i++) {
  const r = prng(0xC1A55 + i);
  const gender = r() < 0.5 ? "male" : "female";
  const first = (gender === "male" ? maleFirst : femaleFirst)[Math.floor(r() * 30)];
  const last = surnames[Math.floor(r() * 30)];
  newStuRows.push({ admission_no: `KV25${pad(i, 4)}`, full_name: `${first} ${last}`, gender, dob: `2020-${pad(1 + Math.floor(r() * 12), 2)}-${pad(1 + Math.floor(r() * 27), 2)}`, status: "active" });
}
const newStudents = await insertReturning("student", newStuRows);

// --- Assemble 2025-26 enrollments (promoted + new intake) --------------------
console.log("Enrolling pupils in 2025-26…");
const enroll25 = [];   // { student_id, section_id }
for (const [studentId, a] of assign) if (a.toSecId) enroll25.push({ student_id: studentId, section_id: a.toSecId });
newStudents.forEach((s, i) => enroll25.push({ student_id: s.id, section_id: classISecs[i % classISecs.length].id }));

// roll numbers per section, by pupil name
const names = { ...nameById, ...Object.fromEntries(newStudents.map((s) => [s.id, s.full_name])) };
const bySec = {}; for (const e of enroll25) (bySec[e.section_id] ||= []).push(e);
const enrollRows = [];
for (const secId in bySec) {
  bySec[secId].sort((a, b) => (names[a.student_id] || "").localeCompare(names[b.student_id] || ""));
  bySec[secId].forEach((e, i) => enrollRows.push({ student_id: e.student_id, academic_year_id: TO, section_id: Number(secId), roll_no: i + 1, status: "active" }));
}
await insert("student_enrollment", enrollRows);
console.log(`  ${enrollRows.length} enrollments`);

// promotion audit rows + graduate alumni status
const promRows = [];
for (const [studentId, a] of assign) promRows.push({ student_id: studentId, from_year_id: FROM, to_year_id: TO, from_section_id: a.fromSecId, to_section_id: a.toSecId, outcome: a.outcome, decided_by: null });
await insert("promotion", promRows);
const grads = [...assign].filter(([, a]) => a.outcome === "graduated").map(([id]) => id);
for (let i = 0; i < grads.length; i += 200) await patch("student", `id=in.(${grads.slice(i, i + 200).join(",")})`, { status: "alumni", left_on: "2025-04-01" });
console.log(`  ${promRows.length} promotion rows, ${grads.length} graduated (Class XII)`);

// --- Teacher allotments (copy 2024-25 structure to 2025-26) ------------------
console.log("Copying teacher allotments…");
await insert("teacher_allotment", allot24.map((a) => ({ staff_id: a.staff_id, section_id: a.section_id, subject_id: a.subject_id, academic_year_id: TO, is_class_teacher: a.is_class_teacher })));

// --- Assessments (per section × subject × exam) ------------------------------
console.log("Creating assessments…");
const usedSections = [...new Set(enrollRows.map((e) => e.section_id))];
const aRows = [];
for (const secId of usedSections) {
  const sec = secById[secId], lvl = levelOfSection[secId];
  for (const code of subjectsFor(lvl, sec.name)) for (const e of examsFor(lvl))
    aRows.push({ assessment_type_id: atId[e.type], subject_id: subId[code], section_id: secId, academic_year_id: TO, term: e.term, name: e.name, assessed_on: e.date, max_marks: e.max, is_published: true, published_at: new Date().toISOString() });
}
await insert("assessment", aRows);
const a25 = await sel(`assessment?select=id,section_id,subject_id,name,max_marks&academic_year_id=eq.${TO}`);
const aMap = {}; for (const a of a25) aMap[`${a.section_id}|${a.subject_id}|${a.name}`] = { id: a.id, max: a.max_marks };
console.log(`  ${aRows.length} assessments`);

// --- Marks (per pupil × subject × exam) --------------------------------------
console.log("Generating marks…");
const marks = [];
for (const e of enrollRows) {
  const sec = secById[e.section_id], lvl = levelOfSection[e.section_id];
  const r = prng(e.student_id * 2654435761 >>> 0);
  const base = (() => { const x = r(); return x < 0.1 ? 86 + r() * 10 : x < 0.35 ? 76 + r() * 10 : x < 0.7 ? 62 + r() * 14 : x < 0.9 ? 50 + r() * 12 : 38 + r() * 12; })();
  const tr = (() => { const x = r(); return x < 0.25 ? 1 : x < 0.45 ? -1 : 0; })();
  for (const code of subjectsFor(lvl, sec.name)) {
    const subjOff = -11 + Math.floor(r() * 23);
    examsFor(lvl).forEach((ex, i) => {
      const a = aMap[`${e.section_id}|${subId[code]}|${ex.name}`]; if (!a) return;
      const drift = tr * i * (ex.max >= 80 ? 1.6 : 1.1);
      const pct = clamp(base + subjOff + drift + (-5 + Math.floor(r() * 11)), 4, 99);
      marks.push({ assessment_id: a.id, student_id: e.student_id, marks_obtained: clamp(Math.round((pct / 100) * a.max * 10) / 10, 0, a.max) });
    });
  }
}
await insert("mark", marks, 4000);
console.log(`  ${marks.length} marks`);

// --- Attendance (Mon & Thu school days) --------------------------------------
console.log("Generating attendance…");
const HOLIDAYS = new Set(["2025-08-15","2025-10-02","2025-10-21","2025-12-25","2026-01-01","2026-01-26"]);
const days = [];
for (let d = new Date(Date.UTC(2025, 3, 1)); d <= new Date(Date.UTC(2026, 1, 28)); d = new Date(d.getTime() + 86400000)) {
  const wd = d.getUTCDay(), iso = d.toISOString().slice(0, 10);
  if ((wd === 1 || wd === 4) && !HOLIDAYS.has(iso)) days.push(iso);
}
const att = [];
for (const e of enrollRows) {
  const r = prng((e.student_id ^ 0x9e3779b9) >>> 0);
  const target = (() => { const x = r(); return x < 0.12 ? 97 + r() * 3 : x < 0.48 ? 90 + r() * 6 : x < 0.76 ? 82 + r() * 7 : x < 0.92 ? 74 + r() * 7 : 60 + r() * 13; })();
  for (const day of days) {
    const roll = r() * 100;
    const status = roll < target ? (r() < 0.05 ? "late" : "present") : "absent";
    att.push({ student_id: e.student_id, section_id: e.section_id, academic_year_id: TO, on_date: day, period: null, subject_id: null, status });
  }
}
await insert("attendance_record", att, 5000);
console.log(`  ${days.length} school days × ${enrollRows.length} pupils = ${att.length} records`);

// --- Announcements + events --------------------------------------------------
console.log("Adding communications…");
await insert("announcement", [
  { title: "Welcome to Session 2025-26", body: "A warm welcome to the new academic session. Classes begin as per the notified timetable.", scope: "school", class_id: null, section_id: null, academic_year_id: TO, created_by: principal },
  { title: "Periodic Test 1 Schedule", body: "Periodic Test 1 for all classes begins 22 July 2025. Datesheet is on the notice board.", scope: "school", class_id: null, section_id: null, academic_year_id: TO, created_by: principal },
  { title: "Half-Yearly Examination Schedule", body: "Half-yearly examinations begin 23 September 2025.", scope: "school", class_id: null, section_id: null, academic_year_id: TO, created_by: principal },
]);
await insert("event", [
  { title: "Independence Day", description: "Flag hoisting and cultural programme.", event_type: "holiday", start_date: "2025-08-15", end_date: "2025-08-15", remind_before_days: 1, academic_year_id: TO, created_by: principal },
  { title: "Half-Yearly Examinations", description: "Half-yearly examinations for all classes.", event_type: "exam", start_date: "2025-09-23", end_date: "2025-10-05", remind_before_days: 7, academic_year_id: TO, created_by: principal },
  { title: "Annual Sports Day", description: "Inter-house athletics meet.", event_type: "activity", start_date: "2025-12-13", end_date: "2025-12-13", remind_before_days: 3, academic_year_id: TO, created_by: principal },
  { title: "Final Examinations", description: "Session-end final examinations.", event_type: "exam", start_date: "2026-02-24", end_date: "2026-03-12", remind_before_days: 7, academic_year_id: TO, created_by: principal },
]);

// --- Make 2025-26 the current session ----------------------------------------
console.log("Setting 2025-26 as the current session…");
await patch("academic_year", `id=eq.${FROM}`, { is_current: false });
await patch("academic_year", `id=eq.${TO}`, { is_current: true });

console.log("\nDONE — 2025-26 seeded.");
