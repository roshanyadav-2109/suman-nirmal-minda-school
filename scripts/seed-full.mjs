// =============================================================================
// KV No.1 IIT Kharagpur ERP — FULL real-school seed for the 2024-25 session.
//
// Uses the ACTUAL published class-wise enrolment of PM Shri KV No.1 IIT KGP
// (class-social-category-wise-enrolment-position, updated Jan 2025):
//   I 117 · II 126 · III 132 · IV 163 · V 152 · VI 159 · VII 166 · VIII 174
//   IX 187 · X 160 · XI (Arts 30 / Com 39 / Sci 77) · XII (Arts 30 / Com 33 / Sci 74)
//
// Distributes pupils ~evenly into sections (~40/section; XI-XII by stream),
// stage/stream-appropriate subjects, four school-wide exams
// (Periodic Test 1 · Half-Yearly · Periodic Test 2 · Final) plus monthly
// internal tests for IX-XII, full marks for every pupil/subject/exam, and a
// full-session attendance record (varied profiles incl. below-75%).
//
//   node scripts/seed-full.mjs
// Requires env: SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE, SUPABASE_REF
// =============================================================================
import { writeFileSync } from "node:fs";

const REF = process.env.SUPABASE_REF || "qyiqdwrjtgdzocoffzvk";
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
if (!MGMT_TOKEN || !SERVICE) { console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_SERVICE_ROLE"); process.exit(1); }

const MGMT_URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const AUTH_URL = `https://${REF}.supabase.co/auth/v1`;

async function runSql(sql) {
  const res = await fetch(MGMT_URL, { method: "POST",
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }) });
  const text = await res.text();
  if (!res.ok) { console.error("SQL FAILED:\n", text.slice(0, 1500)); throw new Error("sql failed"); }
  try { return JSON.parse(text); } catch { return []; }
}
async function applyPart(label, sql) { process.stdout.write(`  ${label} … `); await runSql(sql); console.log("ok"); }
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// deterministic PRNG (mulberry32)
let _s = 0x1a2b3c4d;
function rng() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const q = (s) => s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n, w) => String(n).padStart(w, "0");

// ---- name pools -------------------------------------------------------------
const maleFirst = ["Aarav","Rohan","Aditya","Arjun","Ishaan","Soham","Aryan","Rudra","Kabir","Vivaan","Ayaan","Dev","Reyansh","Arnav","Ansh","Sourav","Debjit","Arka","Rishav","Snehashish","Ritwik","Subhankar","Pritam","Anirban","Sayan","Tanmoy","Diptayan","Abhronil","Sagnik","Rajarshi","Arit","Bodhi","Shreyan","Aniruddha","Swapnil","Ujjwal","Pranav","Neel","Ritobrata","Souvik"];
const femaleFirst = ["Aadhya","Ananya","Diya","Ira","Myra","Sara","Aarohi","Anika","Kiara","Riya","Navya","Prisha","Trisha","Ishani","Meghna","Rimjhim","Sohini","Ankita","Poulomi","Debolina","Srijita","Ritika","Paromita","Ahana","Oindrila","Madhurima","Susmita","Antara","Rupsa","Barsha","Aparajita","Ishika","Sanjana","Tanushree","Nandini","Rimi","Piyali","Adrija","Moumita","Shreya"];
const surnames = ["Sharma","Verma","Gupta","Nair","Iyer","Reddy","Das","Ghosh","Banerjee","Chatterjee","Mukherjee","Bose","Dutta","Sen","Roy","Chakraborty","Bhattacharya","Sarkar","Mondal","Pal","Dey","Kar","Saha","Nag","Basu","Rao","Menon","Singh","Yadav","Mishra","Dutt","Ganguly","Sengupta","Halder","Majumdar","Bhaumik","Chowdhury","Adhikari","Goswami","Sinha"];
const nameFor = (g) => `${pick(g === "male" ? maleFirst : femaleFirst)} ${pick(surnames)}`;

// =============================================================================
// Config — enrolment, sections, subjects, exams (all DATA, nothing hardcoded
// into app logic; teachers add more exams at runtime via create_class_exam).
// =============================================================================
const YEAR = "2024-25", NEXT = "2025-26";
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const ENROLL10 = { 1:117, 2:126, 3:132, 4:163, 5:152, 6:159, 7:166, 8:174, 9:187, 10:160 };
const STREAMS = { 11: { Arts:30, Com:39, Sci:77 }, 12: { Arts:30, Com:33, Sci:74 } };
const stageOf = (lvl) => lvl <= 2 ? "foundational" : lvl <= 5 ? "preparatory" : lvl <= 8 ? "middle" : "senior";

const SUBJECTS = [
  ["ENG","English"],["HIN","Hindi"],["SANS","Sanskrit"],["MATH","Mathematics"],["EVS","Environmental Studies"],
  ["SCI","Science"],["SST","Social Science"],["COMP","Computer Science"],["IT","Information Technology"],
  ["PHY","Physics"],["CHEM","Chemistry"],["BIO","Biology"],
  ["ACC","Accountancy"],["BST","Business Studies"],["ECO","Economics"],
  ["HIST","History"],["POL","Political Science"],["GEO","Geography"],
];
function subjectsFor(level, secName) {
  if (level <= 2) return ["ENG","HIN","MATH","EVS"];
  if (level <= 5) return ["ENG","HIN","MATH","EVS","COMP"];
  if (level <= 8) return ["ENG","HIN","SANS","MATH","SCI","SST"];
  if (level <= 10) return ["ENG","HIN","MATH","SCI","SST","IT"];
  if (secName.startsWith("Sci")) return ["ENG","PHY","CHEM","MATH","BIO","COMP"];
  if (secName === "Com") return ["ENG","ACC","BST","ECO","MATH"];
  return ["ENG","HIST","POL","GEO","ECO"]; // Arts
}
// Four school-wide exams for every class; IX-XII also run monthly internals.
const EXAMS = [
  { name:"Periodic Test 1",         type:"periodic_test", term:1, max:40, date:`${YEAR.slice(0,4)}-07-22` },
  { name:"Half-Yearly Examination", type:"half_yearly",   term:1, max:80, date:`${YEAR.slice(0,4)}-09-23` },
  { name:"Periodic Test 2",         type:"periodic_test", term:2, max:40, date:`${YEAR.slice(0,4)}-11-18` },
  { name:"Final Examination",       type:"annual",        term:2, max:80, date:`20${YEAR.slice(5)}-02-24` },
];
const MONTHLY = [
  { name:"Monthly Test — July",     type:"periodic_test", term:1, max:20, date:`${YEAR.slice(0,4)}-07-08` },
  { name:"Monthly Test — August",   type:"periodic_test", term:1, max:20, date:`${YEAR.slice(0,4)}-08-12` },
  { name:"Monthly Test — December", type:"periodic_test", term:2, max:20, date:`${YEAR.slice(0,4)}-12-16` },
  { name:"Monthly Test — January",  type:"periodic_test", term:2, max:20, date:`20${YEAR.slice(5)}-01-13` },
];
const examsFor = (level) => level >= 9 ? [...EXAMS, ...MONTHLY] : EXAMS;

// =============================================================================
// 1. Sections + students (drives everything)
// =============================================================================
function distribute(total, n) { const b = Math.floor(total / n), r = total % n; return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0)); }
function sectionsForClass(level) {
  if (level <= 10) {
    const total = ENROLL10[level], n = Math.max(1, Math.round(total / 40));
    const names = ["A","B","C","D","E","F"].slice(0, n), counts = distribute(total, n);
    return names.map((name, i) => ({ name, count: counts[i] }));
  }
  const st = STREAMS[level], secs = [{ name: "Arts", count: st.Arts }, { name: "Com", count: st.Com }];
  const n = Math.max(1, Math.round(st.Sci / 40)), counts = distribute(st.Sci, n);
  (n === 1 ? ["Sci"] : ["Sci-A","Sci-B","Sci-C"].slice(0, n)).forEach((name, i) => secs.push({ name, count: counts[i] }));
  return secs;
}

const allSections = [];             // { level, name, count }
for (let lvl = 1; lvl <= 12; lvl++) for (const s of sectionsForClass(lvl)) allSections.push({ level: lvl, name: s.name, count: s.count });

// academic-ability + trend + attendance buckets
function ability() { const r = rng(); return r < 0.10 ? ri(86,96) : r < 0.35 ? ri(76,86) : r < 0.70 ? ri(62,76) : r < 0.90 ? ri(50,62) : ri(38,50); }
function trend() { const r = rng(); return r < 0.25 ? 1 : r < 0.45 ? -1 : 0; }
function attTarget() { const r = rng(); return r < 0.12 ? ri(97,100) : r < 0.48 ? ri(90,96) : r < 0.76 ? ri(82,89) : r < 0.92 ? ri(74,81) : ri(60,73); }

const students = [];                // { admissionNo, name, gender, dob, level, secName, roll, base, tr, att, tag }
let seq = 0;
for (const sec of allSections) {
  for (let roll = 1; roll <= sec.count; roll++) {
    seq++;
    const gender = rng() < 0.5 ? "male" : "female";
    const birthYear = 2024 - (5 + sec.level);
    const s = { admissionNo: `KV24${pad(seq, 4)}`, name: nameFor(gender), gender,
      dob: `${birthYear}-${pad(ri(1,12),2)}-${pad(ri(1,28),2)}`,
      level: sec.level, secName: sec.name, roll, base: ability(), tr: trend(), att: attTarget(), tag: null };
    // demo anchors
    if (sec.level === 8 && sec.name === "A" && roll === 1) { s.tag = "STUDENT"; s.att = 93; s.base = 82; s.tr = 0; }
    if (sec.level === 8 && sec.name === "A" && roll === 4) { s.att = 68; }        // a below-75% pupil in VIII-A
    if (sec.level === 6 && sec.name === "A" && roll === 1) { s.tag = "SIBLING"; s.att = 88; s.base = 74; }
    students.push(s);
  }
}
const byTag = (t) => students.find((s) => s.tag === t);
console.log(`Roster: ${students.length} pupils across ${allSections.length} sections, ${new Set(allSections.map(s=>s.level)).size} classes.`);

// =============================================================================
// 2. Staff (one class teacher per section + per-subject pools) + demo anchors
// =============================================================================
const staff = [];
staff.push({ code: "P01", name: "Dr. Sudeshna Banerjee", role: "principal" });
staff.push({ code: "O01", name: "Mr. Amit Kar", role: "office" });

const ctBySec = {};                 // "lvl-sec" -> { code, homeSub }
let ctn = 0;
for (const sec of allSections) {
  ctn++;
  const code = `CT${pad(ctn, 3)}`;
  const subs = subjectsFor(sec.level, sec.name);
  let name = nameFor(rng() < 0.55 ? "female" : "male");
  let role = "class_teacher";
  let homeSub = pick(subs.filter((c) => c !== "ENG")) || subs[0];
  if (sec.level === 8 && sec.name === "A") { name = "Mrs. Anindita Sen"; homeSub = "SCI"; }
  if (sec.level === 8 && sec.name === "B") { name = "Mr. Rajarshi Dutta"; role = "subject_teacher"; homeSub = "MATH"; }
  staff.push({ code, name, role });
  ctBySec[`${sec.level}-${sec.name}`] = { code, homeSub };
}
const RAJARSHI = ctBySec["8-B"].code;   // teaches Maths across all of Class VIII

// per-subject teacher pools (each teacher covers ~8 sections of the subject)
const subjSecCount = {};
for (const sec of allSections) for (const c of subjectsFor(sec.level, sec.name)) subjSecCount[c] = (subjSecCount[c] || 0) + 1;
const subjPool = {}; let stn = 0;
for (const [code] of SUBJECTS) {
  if (!subjSecCount[code]) continue;
  const size = clamp(Math.ceil(subjSecCount[code] / 8), 1, 6);
  subjPool[code] = [];
  for (let k = 0; k < size; k++) { stn++; const sc = `ST${pad(stn, 3)}`; staff.push({ code: sc, name: nameFor(rng() < 0.5 ? "male" : "female"), role: "subject_teacher" }); subjPool[code].push(sc); }
}

// =============================================================================
// 3. Structural SQL (natural keys via subselects; no id capture needed)
// =============================================================================
const parts = [];
parts.push(`
delete from public.slippage_flag; delete from public.mark; delete from public.attendance_record;
delete from public.observation; delete from public.hpc_input; delete from public.assessment;
delete from public.feedback; delete from public.absence_notice; delete from public.leave_application;
delete from public.announcement; delete from public.event; delete from public.monthly_report;
delete from public.teacher_allotment; delete from public.student_enrollment;
delete from public.guardian_student; delete from public.profile;
delete from public.guardian; delete from public.student; delete from public.staff;
delete from public.class_subject; delete from public.assessment_type;
delete from public.section; delete from public.subject; delete from public.class;
delete from public.academic_year; delete from public.school;

insert into public.school (name, code) values ('PM Shri Kendriya Vidyalaya No.1 IIT Kharagpur', 'KV1-IITKGP');

insert into public.academic_year (name, start_date, end_date, is_current) values
  ('${YEAR}', '2024-04-01', '2025-03-31', true),
  ('${NEXT}', '2025-04-01', '2026-03-31', false);
`);

parts.push(`insert into public.class (name, level, stage) values ${ROMAN.map((n, i) => `(${q(n)}, ${i + 1}, ${q(stageOf(i + 1))})`).join(",")};`);

const secRows = allSections.map((s) => `((select id from public.class where level=${s.level}), ${q(s.name)})`);
parts.push(`insert into public.section (class_id, name) values ${secRows.join(",")};`);

parts.push(`insert into public.subject (code, name) values ${SUBJECTS.map(([c, n]) => `(${q(c)}, ${q(n)})`).join(",")};`);

// class_subject = union of each class's sections' subjects
const classSubs = {};
for (const sec of allSections) { classSubs[sec.level] = classSubs[sec.level] || new Set(); for (const c of subjectsFor(sec.level, sec.name)) classSubs[sec.level].add(c); }
const csRows = [];
for (const lvl of Object.keys(classSubs)) for (const c of classSubs[lvl]) csRows.push(`((select id from public.class where level=${lvl}), (select id from public.subject where code=${q(c)}))`);
parts.push(`insert into public.class_subject (class_id, subject_id) values ${csRows.join(",")};`);

parts.push(`insert into public.assessment_type (code, name, is_numeric, weightage) values
  ('periodic_test','Periodic Test', true, null),
  ('half_yearly','Half-Yearly Examination', true, null),
  ('annual','Final Examination', true, null),
  ('notebook','Notebook', true, 5),
  ('enrichment','Subject Enrichment', true, 5),
  ('observation','Observation', false, null);`);

parts.push(`insert into public.staff (employee_code, full_name, role) values ${staff.map((s) => `(${q(s.code)}, ${q(s.name)}, ${q(s.role)})`).join(",")};`);

// students (chunked)
const stuRows = students.map((s) => `(${q(s.admissionNo)}, ${q(s.name)}, ${q(s.gender)}, ${q(s.dob)})`);
for (const b of chunk(stuRows, 1000)) parts.push(`insert into public.student (admission_no, full_name, gender, dob) values ${b.join(",")};`);

// one guardian per pupil (demo parent for the STUDENT + SIBLING anchors)
const gRows = [`(${q("Demo Parent (Guardian)")}, 'Father', 'parent@kv.demo', '9800000001')`];
for (const s of students) { if (s.tag === "STUDENT" || s.tag === "SIBLING") continue; const rel = rng() < 0.5 ? "Father" : "Mother"; gRows.push(`(${q(`${s.name.split(" ").slice(-1)[0]} (${rel})`)}, ${q(rel)}, null, '9${ri(700000000,899999999)}')`); }
for (const b of chunk(gRows, 1000)) parts.push(`insert into public.guardian (full_name, relation, email, phone) values ${b.join(",")};`);
// link demo parent to its two children
parts.push(`insert into public.guardian_student (guardian_id, student_id, is_primary) values
  ((select id from public.guardian where email='parent@kv.demo'), (select id from public.student where admission_no=${q(byTag("STUDENT").admissionNo)}), true),
  ((select id from public.guardian where email='parent@kv.demo'), (select id from public.student where admission_no=${q(byTag("SIBLING").admissionNo)}), false);`);
// link every other pupil to a guardian, positionally
parts.push(`
with g as (select id, row_number() over (order by id) rn from public.guardian where email is distinct from 'parent@kv.demo'),
     s as (select id, row_number() over (order by admission_no) rn from public.student where admission_no not in (${q(byTag("STUDENT").admissionNo)}, ${q(byTag("SIBLING").admissionNo)}))
insert into public.guardian_student (guardian_id, student_id, is_primary) select g.id, s.id, true from g join s using (rn);`);

// enrollments (2024-25)
const enrRows = students.map((s) => `((select id from public.student where admission_no=${q(s.admissionNo)}), (select id from public.academic_year where name=${q(YEAR)}), (select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=${s.level} and sec.name=${q(s.secName)}), ${s.roll})`);
for (const b of chunk(enrRows, 1000)) parts.push(`insert into public.student_enrollment (student_id, academic_year_id, section_id, roll_no) values ${b.join(",")};`);

// allotments (2024-25): CT per section + subject teachers (round-robin pools)
const allot = [];
const yr = `(select id from public.academic_year where name=${q(YEAR)})`;
const secSel = (lvl, nm) => `(select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=${lvl} and sec.name=${q(nm)})`;
const staffSel = (code) => `(select id from public.staff where employee_code=${q(code)})`;
const subSel = (code) => `(select id from public.subject where code=${q(code)})`;
const cursor = {};
for (const sec of allSections) {
  const ct = ctBySec[`${sec.level}-${sec.name}`];
  allot.push(`(${staffSel(ct.code)}, ${secSel(sec.level, sec.name)}, null, ${yr}, true)`);   // class-teacher row
  for (const code of subjectsFor(sec.level, sec.name)) {
    let teacher;
    if (code === "MATH" && sec.level === 8) teacher = RAJARSHI;
    else if (code === ct.homeSub) teacher = ct.code;
    else { cursor[code] = (cursor[code] || 0) + 1; teacher = subjPool[code][cursor[code] % subjPool[code].length]; }
    allot.push(`(${staffSel(teacher)}, ${secSel(sec.level, sec.name)}, ${subSel(code)}, ${yr}, false)`);
  }
}
for (const b of chunk(allot, 600)) parts.push(`insert into public.teacher_allotment (staff_id, section_id, subject_id, academic_year_id, is_class_teacher) values ${b.join(",")};`);

console.log("Applying structure & people…");
for (let i = 0; i < parts.length; i++) await applyPart(`structure#${i + 1}/${parts.length}`, parts[i]);

// =============================================================================
// 4. Id maps
// =============================================================================
console.log("Fetching id maps…");
const secMap = {}; for (const r of await runSql(`select sec.id, c.level, sec.name from public.section sec join public.class c on c.id=sec.class_id`)) secMap[`${r.level}-${r.name}`] = r.id;
const subMap = {}; for (const r of await runSql(`select id, code from public.subject`)) subMap[r.code] = r.id;
const stuMap = {}; for (const r of await runSql(`select id, admission_no from public.student`)) stuMap[r.admission_no] = r.id;
const YID = (await runSql(`select id from public.academic_year where name=${q(YEAR)}`))[0].id;

// =============================================================================
// 5. Assessments (exams) — per section × subject × exam, all published
// =============================================================================
console.log("Creating assessments…");
const aVals = [];
for (const sec of allSections) {
  const secId = secMap[`${sec.level}-${sec.name}`];
  for (const code of subjectsFor(sec.level, sec.name)) {
    const subId = subMap[code];
    for (const e of examsFor(sec.level))
      aVals.push(`((select id from public.assessment_type where code=${q(e.type)}), ${subId}, ${secId}, ${YID}, ${e.term}, ${q(e.name)}, ${q(e.date)}, ${e.max}, true, now())`);
  }
}
for (const b of chunk(aVals, 700)) await applyPart(`assessments(${b.length})`, `insert into public.assessment (assessment_type_id, subject_id, section_id, academic_year_id, term, name, assessed_on, max_marks, is_published, published_at) values ${b.join(",")};`);

const aMap = {};                    // "secId|subId|name" -> {id, max}
for (const r of await runSql(`select a.id, a.section_id, a.subject_id, a.name, a.max_marks from public.assessment a where a.academic_year_id=${YID}`)) aMap[`${r.section_id}|${r.subject_id}|${r.name}`] = { id: r.id, max: r.max_marks };

// =============================================================================
// 6. Marks — per pupil, per subject, per exam (ability + subject offset + trend)
// =============================================================================
console.log("Generating marks…");
const mVals = [];
for (const s of students) {
  const secId = secMap[`${s.level}-${s.secName}`];
  const subs = subjectsFor(s.level, s.secName);
  const exams = examsFor(s.level);
  for (const code of subs) {
    const subId = subMap[code];
    const subjOff = ri(-11, 11);
    exams.forEach((e, i) => {
      const a = aMap[`${secId}|${subId}|${e.name}`];
      if (!a) return;
      const drift = s.tr * i * (e.max >= 80 ? 1.6 : 1.1);
      const pct = clamp(s.base + subjOff + drift + ri(-5, 5), 4, 99);
      const marks = clamp(Math.round((pct / 100) * a.max * 10) / 10, 0, a.max);
      mVals.push(`(${a.id}, ${stuMap[s.admissionNo]}, ${marks})`);
    });
  }
}
console.log(`  ${mVals.length} marks`);
for (const b of chunk(mVals, 3000)) await applyPart(`marks(${b.length})`, `insert into public.mark (assessment_id, student_id, marks_obtained) values ${b.join(",")};`);

// =============================================================================
// 7. Attendance — full session (Mon & Thu school days, varied profiles)
// =============================================================================
console.log("Generating attendance…");
const HOLIDAYS = new Set(["2024-10-10","2024-10-11","2024-10-31","2024-12-25","2025-01-01","2025-01-26"]);
const days = [];
for (let d = new Date(Date.UTC(2024, 3, 1)); d <= new Date(Date.UTC(2025, 1, 28)); d = new Date(d.getTime() + 86400000)) {
  const wd = d.getUTCDay(), iso = d.toISOString().slice(0, 10);
  if ((wd === 1 || wd === 4) && !HOLIDAYS.has(iso)) days.push(iso);       // Mondays & Thursdays
}
console.log(`  ${days.length} school days × ${students.length} pupils`);
const atVals = [];
for (const s of students) {
  const secId = secMap[`${s.level}-${s.secName}`];
  for (const day of days) {
    const r = rng() * 100;
    let status;
    if (r < s.att) status = rng() < 0.05 ? "late" : "present";
    else status = "absent";
    atVals.push(`(${stuMap[s.admissionNo]}, ${secId}, ${YID}, ${q(day)}, null, null, ${q(status)})`);
  }
}
for (const b of chunk(atVals, 4000)) await applyPart(`attendance(${b.length})`, `insert into public.attendance_record (student_id, section_id, academic_year_id, on_date, period, subject_id, status) values ${b.join(",")};`);

// =============================================================================
// 8. Announcements, events, observations, slippage flags (demo context)
// =============================================================================
console.log("Adding communications…");
const viiiA = secSel(8, "A");
const misc = [`
insert into public.announcement (title, body, scope, class_id, section_id, academic_year_id, created_by) values
  ('Session 2024-25 Result Declared', 'Final examination results for all classes are now published on the portal.', 'school', null, null, ${YID}, ${staffSel("P01")}),
  ('Half-Yearly Examination Schedule', 'Half-yearly examinations begin 23 September 2024. Datesheet is on the notice board.', 'school', null, null, ${YID}, ${staffSel("P01")}),
  ('Class VIII Science Exhibition', 'Submit working models for the inter-section Science exhibition by 5 February.', 'class', (select id from public.class where level=8), null, ${YID}, ${staffSel(RAJARSHI)}),
  ('VIII-A Parent-Teacher Meeting', 'PTM for section VIII-A is scheduled this Saturday at 10 AM.', 'section', null, ${viiiA}, ${YID}, ${staffSel(ctBySec["8-A"].code)});

insert into public.event (title, description, event_type, start_date, end_date, remind_before_days, academic_year_id, created_by) values
  ('Independence Day', 'Flag hoisting and cultural programme.', 'holiday', '2024-08-15', '2024-08-15', 1, ${YID}, ${staffSel("P01")}),
  ('Half-Yearly Examinations', 'Half-yearly examinations for all classes.', 'exam', '2024-09-23', '2024-10-05', 7, ${YID}, ${staffSel("P01")}),
  ('Annual Sports Day', 'Inter-house athletics meet.', 'activity', '2024-12-14', '2024-12-14', 3, ${YID}, ${staffSel("P01")}),
  ('Final Examinations', 'Session-end final examinations.', 'exam', '2025-02-24', '2025-03-12', 7, ${YID}, ${staffSel("P01")}),
  ('Republic Day', 'Flag hoisting and prize distribution.', 'holiday', '2025-01-26', '2025-01-26', 1, ${YID}, ${staffSel("P01")});

insert into public.observation (student_id, staff_id, academic_year_id, subject_id, category, body, visible_to_guardian) values
  ((select id from public.student where admission_no=${q(byTag("STUDENT").admissionNo)}), ${staffSel(ctBySec["8-A"].code)}, ${YID}, null, 'progress', 'A consistent all-round performer who participates actively in class.', true),
  ((select id from public.student where admission_no=${q(byTag("SIBLING").admissionNo)}), ${staffSel(ctBySec["6-A"].code)}, ${YID}, ${subSel("MATH")}, 'strength', 'Strong number sense; enjoys problem solving.', true);
`];
await applyPart("communications", misc.join("\n"));

// slippage flags for declining pupils in Class VIII (Mathematics)
const slip = students.filter((s) => s.tr === -1 && s.level === 8).slice(0, 12).map((s) =>
  `(${stuMap[s.admissionNo]}, ${secMap[`${s.level}-${s.secName}`]}, ${YID}, ${subSel("MATH")}, 3, -14.0, 'Mathematics declined across the last three assessments.')`);
if (slip.length) await applyPart("slippage-flags", `insert into public.slippage_flag (student_id, section_id, academic_year_id, subject_id, window_size, trend_delta, reason) values ${slip.join(",")};`);

// =============================================================================
// 9. Demo auth users + profile links
// =============================================================================
console.log("Wiring demo logins…");
async function createUser(email, password, fullName) {
  const res = await fetch(`${AUTH_URL}/admin/users`, { method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }) });
  if (res.ok) return (await res.json()).id;
  const list = await fetch(`${AUTH_URL}/admin/users?per_page=300`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  const u = (await list.json()).users.find((x) => x.email === email);
  if (u) { await fetch(`${AUTH_URL}/admin/users/${u.id}`, { method: "PUT", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); return u.id; }
  throw new Error("could not create/find " + email);
}
const PW = "kviit@demo1";
const demos = [
  { email: "principal@kv.demo",    name: "Dr. Sudeshna Banerjee", role: "staff",    link: { staff: "P01" } },
  { email: "office@kv.demo",       name: "Mr. Amit Kar",          role: "staff",    link: { staff: "O01" } },
  { email: "classteacher@kv.demo", name: "Mrs. Anindita Sen",     role: "staff",    link: { staff: ctBySec["8-A"].code } },
  { email: "teacher@kv.demo",      name: "Mr. Rajarshi Dutta",    role: "staff",    link: { staff: RAJARSHI } },
  { email: "parent@kv.demo",       name: "Demo Parent",           role: "guardian", link: { guardianEmail: "parent@kv.demo" } },
  { email: "student@kv.demo",      name: byTag("STUDENT").name,   role: "student",  link: { student: byTag("STUDENT").admissionNo } },
];
for (const d of demos) {
  const uid = await createUser(d.email, PW, d.name);
  const staffId = d.link.staff ? staffSel(d.link.staff) : "null";
  const guardianId = d.link.guardianEmail ? `(select id from public.guardian where email=${q(d.link.guardianEmail)})` : "null";
  const studentId = d.link.student ? `(select id from public.student where admission_no=${q(d.link.student)})` : "null";
  await runSql(`insert into public.profile (id, role, full_name, staff_id, guardian_id, student_id)
    values ('${uid}', ${q(d.role)}, ${q(d.name)}, ${staffId}, ${guardianId}, ${studentId})
    on conflict (id) do update set role=excluded.role, full_name=excluded.full_name, staff_id=excluded.staff_id, guardian_id=excluded.guardian_id, student_id=excluded.student_id;`);
  console.log(`  ${d.email} → ${d.role}`);
}

const counts = await runSql(`select
  (select count(*) from public.class) classes, (select count(*) from public.section) sections,
  (select count(*) from public.student) students, (select count(*) from public.assessment) assessments,
  (select count(*) from public.mark) marks, (select count(*) from public.attendance_record) attendance,
  (select count(*) from public.teacher_allotment) allotments, (select count(*) from public.staff) staff;`);
console.log("\nDone. Row counts:", JSON.stringify(counts[0], null, 0));
