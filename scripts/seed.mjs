// =============================================================================
// KV IIT KGP ERP — deterministic synthetic seed (no real PII).
// Applies via the Supabase Management API in batches, then creates demo logins.
//   node scripts/seed.mjs
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
  const res = await fetch(MGMT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) { console.error("SQL FAILED:\n", text.slice(0, 1200)); throw new Error("sql failed"); }
  try { return JSON.parse(text); } catch { return []; }
}

// deterministic PRNG (mulberry32)
let _s = 0x9e3779b9;
function rng() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- name pools (mix of pan-Indian + Bengali, apt for KGP) --------------------
const maleFirst = ["Aarav","Rohan","Aditya","Arjun","Ishaan","Soham","Aryan","Rudra","Kabir","Vivaan","Ayaan","Dev","Reyansh","Arnav","Ansh","Sourav","Debjit","Arka","Rishav","Snehashish","Ritwik","Subhankar","Pritam","Anirban","Sayan","Tanmoy","Diptayan","Abhronil","Sagnik","Rajarshi"];
const femaleFirst = ["Aadhya","Ananya","Diya","Ira","Myra","Sara","Aarohi","Anika","Kiara","Riya","Navya","Prisha","Trisha","Ishani","Meghna","Rimjhim","Sohini","Ankita","Poulomi","Debolina","Srijita","Ritika","Paromita","Ahana","Oindrila","Madhurima","Susmita","Antara","Rupsa","Barsha"];
const surnames = ["Sharma","Verma","Gupta","Nair","Iyer","Reddy","Das","Ghosh","Banerjee","Chatterjee","Mukherjee","Bose","Dutta","Sen","Roy","Chakraborty","Bhattacharya","Sarkar","Mondal","Pal","Dey","Kar","Saha","Nag","Basu","Rao","Menon","Singh","Yadav","Mishra"];

const YEAR_PREV = "2024-25", YEAR_CUR = "2025-26";
const SUBJECTS = [["ENG","English"],["HIN","Hindi"],["BEN","Bengali"],["MATH","Mathematics"],["SCI","Science"],["SST","Social Science"],["SANS","Sanskrit"]];
const SECTIONS = ["A","B","C"];
// cohort -> current class level; previous = level-1
const COHORTS = [{ startId: 1,   cur: 8 }, { startId: 91,  cur: 7 }, { startId: 181, cur: 6 }];
const ASSESSMENTS = [
  { name: "Periodic Test 1", type: "periodic_test", term: 1, max: 20, m: "07-15" },
  { name: "Periodic Test 2", type: "periodic_test", term: 1, max: 20, m: "08-20" },
  { name: "Half-Yearly",     type: "half_yearly",   term: 1, max: 80, m: "09-25" },
  { name: "Periodic Test 3", type: "periodic_test", term: 2, max: 20, m: "11-15" },
  { name: "Periodic Test 4", type: "periodic_test", term: 2, max: 20, m: "12-20" },
  { name: "Annual",          type: "annual",        term: 2, max: 80, m: "02-25" },
];
const ROMAN = { 5: "V", 6: "VI", 7: "VII", 8: "VIII" };
// students deliberately declining (for slippage/needs-support demos)
const DECLINERS = new Set([2, 5, 34, 95, 188]);

// =============================================================================
// 1. Build the student roster in JS (drives enrollments, assessments, marks)
// =============================================================================
const students = [];   // {sid, admissionNo, name, gender, curLevel, section, roll, base}
for (const co of COHORTS) {
  for (let i = 0; i < 90; i++) {
    const sid = co.startId + i;
    const section = SECTIONS[Math.floor(i / 30)];
    const roll = (i % 30) + 1;
    const gender = rng() < 0.5 ? "male" : "female";
    const name = `${pick(gender === "male" ? maleFirst : femaleFirst)} ${pick(surnames)}`;
    students.push({ sid, admissionNo: `S${String(sid).padStart(4, "0")}`, name, gender,
      curLevel: co.cur, section, roll, base: ri(48, 86) });
  }
}
const byId = Object.fromEntries(students.map((s) => [s.sid, s]));

// =============================================================================
// 2. Structural + people SQL (natural keys; no id capture needed)
// =============================================================================
const parts = [];
parts.push(`
delete from public.slippage_flag; delete from public.mark; delete from public.attendance_record;
delete from public.observation; delete from public.hpc_input; delete from public.assessment;
delete from public.feedback; delete from public.leave_application; delete from public.announcement;
delete from public.event; delete from public.monthly_report;
delete from public.teacher_allotment; delete from public.student_enrollment;
delete from public.guardian_student; delete from public.profile;
delete from public.guardian; delete from public.student; delete from public.staff;
delete from public.class_subject; delete from public.assessment_type;
delete from public.section; delete from public.subject; delete from public.class;
delete from public.academic_year; delete from public.school;

insert into public.school (name, code) values ('Kendriya Vidyalaya IIT Kharagpur', 'KV-IITKGP');

insert into public.academic_year (name, start_date, end_date, is_current) values
  ('${YEAR_PREV}', '2024-04-01', '2025-03-31', false),
  ('${YEAR_CUR}',  '2025-04-01', '2026-03-31', true);
`);

// classes I..XII with NEP stages
const classRows = [];
const stageOf = (lvl) => lvl <= 2 ? "foundational" : lvl <= 5 ? "preparatory" : lvl <= 8 ? "middle" : "senior";
const roman12 = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
for (let lvl = 1; lvl <= 12; lvl++) classRows.push(`(${q(roman12[lvl - 1])}, ${lvl}, ${q(stageOf(lvl))})`);
parts.push(`insert into public.class (name, level, stage) values ${classRows.join(",")};`);

// sections for classes V..VIII
const secRows = [];
for (const lvl of [5, 6, 7, 8]) for (const s of SECTIONS)
  secRows.push(`((select id from public.class where level=${lvl}), ${q(s)})`);
parts.push(`insert into public.section (class_id, name) values ${secRows.join(",")};`);

// subjects + class_subject (all 7 for classes V..VIII)
parts.push(`insert into public.subject (code, name) values ${SUBJECTS.map(([c, n]) => `(${q(c)}, ${q(n)})`).join(",")};`);
parts.push(`insert into public.class_subject (class_id, subject_id)
  select c.id, s.id from public.class c cross join public.subject s where c.level between 5 and 8;`);

// assessment types
parts.push(`insert into public.assessment_type (code, name, is_numeric, weightage) values
  ('periodic_test','Periodic Test', true, null),
  ('half_yearly','Half-Yearly Examination', true, null),
  ('annual','Annual Examination', true, null),
  ('notebook','Notebook', true, 5),
  ('enrichment','Subject Enrichment', true, 5),
  ('observation','Observation', false, null);`);

// ---- staff ------------------------------------------------------------------
// 9 class teachers (one per current section) + subject teachers + principal + office
const staff = [];
staff.push({ code: "P01", name: "Dr. Sudeshna Banerjee", role: "principal" });
staff.push({ code: "O01", name: "Mr. Amit Kar", role: "office" });
let ctIdx = 0;
const ctForSection = {};   // 'VIII-A' -> staff code
for (const lvl of [8, 7, 6]) for (const s of SECTIONS) {
  const code = `CT${String(++ctIdx).padStart(2, "0")}`;
  staff.push({ code, name: `${pick(femaleFirst)} ${pick(surnames)}`, role: "class_teacher" });
  ctForSection[`${lvl}-${s}`] = code;
}
// subject teachers: 2 per subject
const stForSubject = {};
let stIdx = 0;
for (const [code] of SUBJECTS) {
  stForSubject[code] = [];
  for (let k = 0; k < 2; k++) {
    const sc = `ST${String(++stIdx).padStart(2, "0")}`;
    staff.push({ code: sc, name: `${pick(rng() < 0.5 ? maleFirst : femaleFirst)} ${pick(surnames)}`, role: "subject_teacher" });
    stForSubject[code].push(sc);
  }
}
// demo, stable staff identities
const DEMO_CT = ctForSection["8-A"];                 // class teacher of VIII-A
staff.find((s) => s.code === DEMO_CT).name = "Mrs. Anindita Sen";
const DEMO_ST = stForSubject["MATH"][0];             // Mathematics teacher (VIII sections)
staff.find((s) => s.code === DEMO_ST).name = "Mr. Rajarshi Dutta";

parts.push(`insert into public.staff (employee_code, full_name, role) values
  ${staff.map((s) => `(${q(s.code)}, ${q(s.name)}, ${q(s.role)})`).join(",")};`);

// ---- students ---------------------------------------------------------------
const stRows = students.map((s) =>
  `(${q(s.admissionNo)}, ${q(s.name)}, ${q(s.gender)}, '20${String(20 - s.curLevel).padStart(2, "0")}-0${ri(1,9)}-1${ri(0,9)}')`);
parts.push(`insert into public.student (admission_no, full_name, gender, dob) values ${stRows.join(",")};`);

// ---- guardians + links (demo parent owns S0001 [VIII-A] and S0181 [VI-A]) ---
const DEMO_KIDS = ["S0001", "S0181"];
const guardianRows = [], gsRows = [];
guardianRows.push(`(${q("Demo Parent (Guardian)")}, 'Father', 'parent@kv.demo', '9800000001')`);
for (const s of students) {
  if (DEMO_KIDS.includes(s.admissionNo)) continue;
  const rel = rng() < 0.5 ? "Father" : "Mother";
  guardianRows.push(`(${q(`${s.name.split(" ").slice(-1)[0]} (${rel})`)}, ${q(rel)}, null, '9${ri(700000000,899999999)}')`);
}
parts.push(`insert into public.guardian (full_name, relation, email, phone) values ${guardianRows.join(",")};`);
// link demo guardian to its two kids
for (const adm of DEMO_KIDS)
  gsRows.push(`((select id from public.guardian where email='parent@kv.demo'),
     (select id from public.student where admission_no=${q(adm)}), true)`);
// link each other guardian to its student by matching phone order is fragile; link by row order via a CTE instead:
parts.push(`insert into public.guardian_student (guardian_id, student_id, is_primary) values ${gsRows.join(",")};`);
// bulk-link remaining students to a guardian each (match on surname-derived name is ambiguous;
// instead assign the i-th non-demo guardian to the i-th non-demo student deterministically)
parts.push(`
with g as (select id, row_number() over (order by id) rn from public.guardian where email is distinct from 'parent@kv.demo'),
     s as (select id, row_number() over (order by admission_no) rn from public.student
           where admission_no not in ('S0001','S0181'))
insert into public.guardian_student (guardian_id, student_id, is_primary)
select g.id, s.id, true from g join s using (rn);`);

// =============================================================================
// 3. Enrollments (both years) + allotments (current year)
// =============================================================================
const enrollRows = [];
for (const s of students) {
  const secCur = `(select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=${s.curLevel} and sec.name=${q(s.section)})`;
  const secPrev = `(select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=${s.curLevel - 1} and sec.name=${q(s.section)})`;
  const yCur = `(select id from public.academic_year where name=${q(YEAR_CUR)})`;
  const yPrev = `(select id from public.academic_year where name=${q(YEAR_PREV)})`;
  const stId = `(select id from public.student where admission_no=${q(s.admissionNo)})`;
  enrollRows.push(`(${stId}, ${yCur}, ${secCur}, ${s.roll})`);
  enrollRows.push(`(${stId}, ${yPrev}, ${secPrev}, ${s.roll})`);
}
parts.push(`insert into public.student_enrollment (student_id, academic_year_id, section_id, roll_no) values ${enrollRows.join(",")};`);

// allotments (current year): class teacher per current section + subject teachers
const allotRows = [];
const yCurSub = `(select id from public.academic_year where name=${q(YEAR_CUR)})`;
for (const lvl of [8, 7, 6]) for (const s of SECTIONS) {
  const secId = `(select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=${lvl} and sec.name=${q(s)})`;
  // class-teacher row (no subject)
  allotRows.push(`((select id from public.staff where employee_code=${q(ctForSection[`${lvl}-${s}`])}), ${secId}, null, ${yCurSub}, true)`);
  // subject teachers across the 7 subjects
  SUBJECTS.forEach(([code], k) => {
    const teacher = stForSubject[code][(lvl + SECTIONS.indexOf(s)) % 2];
    const subId = `(select id from public.subject where code=${q(code)})`;
    allotRows.push(`((select id from public.staff where employee_code=${q(teacher)}), ${secId}, ${subId}, ${yCurSub}, false)`);
  });
}
parts.push(`insert into public.teacher_allotment (staff_id, section_id, subject_id, academic_year_id, is_class_teacher) values ${allotRows.join(",")};`);

// =============================================================================
// Apply structural batch(es)
// =============================================================================
const seedSqlDump = [];
async function applyPart(label, sql) {
  seedSqlDump.push(`-- ${label}\n${sql}`);
  process.stdout.write(`  applying ${label} … `);
  await runSql(sql);
  console.log("ok");
}

console.log("Seeding structure & people…");
for (let i = 0; i < parts.length; i++) await applyPart(`structure#${i + 1}`, parts[i]);

// =============================================================================
// 4. Fetch id maps for generated data
// =============================================================================
console.log("Fetching id maps…");
const secMap = {};   // 'lvl-Sec' -> id
for (const r of await runSql(`select sec.id, c.level, sec.name from public.section sec join public.class c on c.id=sec.class_id`))
  secMap[`${r.level}-${r.name}`] = r.id;
const subMap = {};
for (const r of await runSql(`select id, code from public.subject`)) subMap[r.code] = r.id;
const yearMap = {};
for (const r of await runSql(`select id, name from public.academic_year`)) yearMap[r.name] = r.id;
const stuMap = {};
for (const r of await runSql(`select id, admission_no from public.student`)) stuMap[r.admission_no] = r.id;

// enrollments actually present: (studentId, year, level, section)
const enrollments = [];
for (const s of students) {
  enrollments.push({ s, year: YEAR_CUR, level: s.curLevel });
  enrollments.push({ s, year: YEAR_PREV, level: s.curLevel - 1 });
}
// unique (level, section, year) => needs assessments
const sectionYears = new Map();
for (const e of enrollments) {
  const key = `${e.level}-${e.s.section}-${e.year}`;
  if (!sectionYears.has(key)) sectionYears.set(key, { level: e.level, section: e.s.section, year: e.year });
}

// =============================================================================
// 5. Assessments  (insert, then read back ids)
// =============================================================================
console.log("Creating assessments…");
const assessValues = [];
for (const { level, section, year } of sectionYears.values()) {
  const secId = secMap[`${level}-${section}`];
  const yId = yearMap[year];
  const yStart = year === YEAR_CUR ? 2025 : 2024;
  for (const [, code] of SUBJECTS.map((x) => x)) { /* placeholder */ }
  for (const [code] of SUBJECTS) {
    const subId = subMap[code];
    for (const a of ASSESSMENTS) {
      const yr = a.term === 2 && a.m.startsWith("02") ? yStart + 1 : yStart;
      const date = `${yr}-${a.m}`;
      assessValues.push(`((select id from public.assessment_type where code=${q(a.type)}), ${subId}, ${secId}, ${yId}, ${a.term}, ${q(a.name)}, ${q(date)}, ${a.max})`);
    }
  }
}
// batch assessment inserts
for (const batch of chunk(assessValues, 800))
  await applyPart(`assessments(${batch.length})`,
    `insert into public.assessment (assessment_type_id, subject_id, section_id, academic_year_id, term, name, assessed_on, max_marks) values ${batch.join(",")};`);

// read assessment ids keyed by section|subject|year|name
const assessMap = {};
for (const r of await runSql(`select id, section_id, subject_id, academic_year_id, name from public.assessment`))
  assessMap[`${r.section_id}|${r.subject_id}|${r.academic_year_id}|${r.name}`] = r.id;

// =============================================================================
// 6. Marks  (deterministic trends + decliners)
// =============================================================================
console.log("Generating marks…");
const markValues = [];
for (const e of enrollments) {
  const s = e.s, level = e.level, section = s.section, year = e.year;
  const secId = secMap[`${level}-${section}`], yId = yearMap[year];
  const decliner = DECLINERS.has(s.sid);
  const prevYear = year === YEAR_PREV;
  const yearBase = decliner ? (prevYear ? s.base + 5 : s.base - 6) : (prevYear ? s.base - 3 : s.base + 3);
  for (const [code] of SUBJECTS) {
    const subId = subMap[code];
    const subjOff = ri(-8, 8) + (decliner && code === "MATH" ? -10 : 0);
    ASSESSMENTS.forEach((a, i) => {
      const aid = assessMap[`${secId}|${subId}|${yId}|${a.name}`];
      if (!aid) return;
      const drift = decliner ? -(i * (code === "MATH" ? 3.2 : 1.6)) : i * 0.8;
      const pct = clamp(yearBase + subjOff + drift + ri(-4, 4), 8, 99);
      const marks = Math.round((pct / 100) * a.max * 100) / 100;
      markValues.push(`(${aid}, ${stuMap[s.admissionNo]}, ${marks})`);
    });
  }
}
for (const batch of chunk(markValues, 3000))
  await applyPart(`marks(${batch.length})`,
    `insert into public.mark (assessment_id, student_id, marks_obtained) values ${batch.join(",")};`);

// =============================================================================
// 7. Attendance (current year, ~30 recent school days for VI/VII/VIII)
// =============================================================================
console.log("Generating attendance…");
const yCurId = yearMap[YEAR_CUR];
const days = [];
{ let d = new Date(Date.UTC(2026, 0, 5)); // Jan 5 2026
  while (days.length < 30) { const wd = d.getUTCDay(); if (wd !== 0) days.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); } }
const attValues = [];
for (const s of students) {
  const secId = secMap[`${s.curLevel}-${s.section}`];
  const lowAtt = s.sid === 2 || s.sid === 34;   // demo low-attendance students
  for (const day of days) {
    const r = rng();
    let status = "present";
    if (lowAtt) status = r < 0.35 ? "absent" : r < 0.45 ? "late" : "present";
    else status = r < 0.06 ? "absent" : r < 0.09 ? "late" : "present";
    attValues.push(`(${stuMap[s.admissionNo]}, ${secId}, ${yCurId}, ${q(day)}, null, null, ${q(status)})`);
  }
}
for (const batch of chunk(attValues, 3000))
  await applyPart(`attendance(${batch.length})`,
    `insert into public.attendance_record (student_id, section_id, academic_year_id, on_date, period, subject_id, status) values ${batch.join(",")};`);

// =============================================================================
// 8. Observations, announcements, events, leave, feedback, slippage
// =============================================================================
console.log("Adding observations & communications…");
const misc = [];
// observations from the VIII-A class teacher on a couple of students incl. a decliner
misc.push(`insert into public.observation (student_id, staff_id, academic_year_id, subject_id, category, body, visible_to_guardian) values
  ((select id from public.student where admission_no='S0001'),
   (select id from public.staff where employee_code=${q(DEMO_CT)}), ${yCurId},
   null, 'progress', 'Consistent all-round performer; participates actively in class discussions.', true),
  ((select id from public.student where admission_no='S0002'),
   (select id from public.staff where employee_code=${q(DEMO_CT)}), ${yCurId},
   (select id from public.subject where code='MATH'), 'difficulty',
   'Mathematics scores have slipped across the last three tests. Recommend remedial sessions and a parent conversation.', false);`);

// announcements
misc.push(`insert into public.announcement (title, body, scope, class_id, section_id, academic_year_id, created_by) values
  ('Winter Break', 'The school will remain closed from 25 Dec to 1 Jan for winter break.', 'school', null, null, ${yCurId}, (select id from public.staff where employee_code='P01')),
  ('Half-Yearly Results Published', 'Half-yearly examination results are now available on the portal.', 'school', null, null, ${yCurId}, (select id from public.staff where employee_code='P01')),
  ('Class VIII Science Project', 'Submit your Science working models by 20 January.', 'class', (select id from public.class where level=8), null, ${yCurId}, (select id from public.staff where employee_code=${q(DEMO_ST)})),
  ('VIII-A Parent-Teacher Meeting', 'PTM for section VIII-A scheduled this Saturday, 10 AM.', 'section', null, (select sec.id from public.section sec join public.class c on c.id=sec.class_id where c.level=8 and sec.name='A'), ${yCurId}, (select id from public.staff where employee_code=${q(DEMO_CT)}));`);

// events
misc.push(`insert into public.event (title, description, event_type, start_date, end_date, remind_before_days, academic_year_id, created_by) values
  ('Republic Day', 'Flag hoisting and cultural programme.', 'holiday', '2026-01-26', '2026-01-26', 1, ${yCurId}, (select id from public.staff where employee_code='P01')),
  ('Annual Examination begins', 'Annual examinations for all classes.', 'exam', '2026-02-25', '2026-03-10', 7, ${yCurId}, (select id from public.staff where employee_code='P01')),
  ('Parent-Teacher Meeting', 'Term-2 PTM for all sections.', 'ptm', '2026-01-17', '2026-01-17', 3, ${yCurId}, (select id from public.staff where employee_code='P01')),
  ('Science Exhibition', 'Inter-section science exhibition.', 'activity', '2026-02-05', '2026-02-05', 2, ${yCurId}, (select id from public.staff where employee_code=${q(DEMO_ST)}));`);

parts.length = 0;
await applyPart("misc-observations-comms", misc.join("\n"));

// slippage flags for decliners (Mathematics, current year)
const slip = [];
for (const sid of DECLINERS) {
  const s = byId[sid];
  if (!s) continue;
  const secId = secMap[`${s.curLevel}-${s.section}`];
  slip.push(`(${stuMap[s.admissionNo]}, ${secId}, ${yCurId}, (select id from public.subject where code='MATH'), 3, -18.0, 'Mathematics fell sharply across the last three assessments.')`);
}
await applyPart("slippage-flags",
  `insert into public.slippage_flag (student_id, section_id, academic_year_id, subject_id, window_size, trend_delta, reason) values ${slip.join(",")};`);

// =============================================================================
// 9. Demo auth users + profile links
// =============================================================================
console.log("Creating demo auth users…");
async function createUser(email, password, fullName) {
  let res = await fetch(`${AUTH_URL}/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  if (res.ok) return (await res.json()).id;
  // already exists → look it up
  const list = await fetch(`${AUTH_URL}/admin/users?per_page=200`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  const u = (await list.json()).users.find((x) => x.email === email);
  if (u) { // reset password to known value for demo
    await fetch(`${AUTH_URL}/admin/users/${u.id}`, { method: "PUT",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }) });
    return u.id;
  }
  throw new Error("could not create/find " + email);
}

const PW = "kviit@demo1";
const demos = [
  { email: "principal@kv.demo",   name: "Dr. Sudeshna Banerjee", role: "staff",    link: { staff: "P01" } },
  { email: "office@kv.demo",      name: "Mr. Amit Kar",          role: "staff",    link: { staff: "O01" } },
  { email: "classteacher@kv.demo",name: "Mrs. Anindita Sen",     role: "staff",    link: { staff: DEMO_CT } },
  { email: "teacher@kv.demo",     name: "Mr. Rajarshi Dutta",    role: "staff",    link: { staff: DEMO_ST } },
  { email: "parent@kv.demo",      name: "Demo Parent",           role: "guardian", link: { guardianEmail: "parent@kv.demo" } },
  { email: "student@kv.demo",     name: byId[1].name,            role: "student",  link: { student: "S0001" } },
];
for (const d of demos) {
  const uid = await createUser(d.email, PW, d.name);
  let staffId = "null", guardianId = "null", studentId = "null";
  if (d.link.staff) staffId = `(select id from public.staff where employee_code=${q(d.link.staff)})`;
  if (d.link.guardianEmail) guardianId = `(select id from public.guardian where email=${q(d.link.guardianEmail)})`;
  if (d.link.student) studentId = `(select id from public.student where admission_no=${q(d.link.student)})`;
  await runSql(`insert into public.profile (id, role, full_name, staff_id, guardian_id, student_id)
    values ('${uid}', ${q(d.role)}, ${q(d.name)}, ${staffId}, ${guardianId}, ${studentId})
    on conflict (id) do update set role=excluded.role, full_name=excluded.full_name,
      staff_id=excluded.staff_id, guardian_id=excluded.guardian_id, student_id=excluded.student_id;`);
  console.log(`  ${d.email} → ${d.role}`);
}

writeFileSync("supabase/seed.sql", seedSqlDump.join("\n\n"));
const counts = await runSql(`select
  (select count(*) from public.student) students,
  (select count(*) from public.mark) marks,
  (select count(*) from public.attendance_record) attendance,
  (select count(*) from public.teacher_allotment) allotments,
  (select count(*) from public.profile) profiles;`);
console.log("\nDone. Row counts:", JSON.stringify(counts[0]));

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
