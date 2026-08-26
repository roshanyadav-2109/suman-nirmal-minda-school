import { createClient } from "@/lib/supabase/server";

// Insight lines are returned as translation key + params so the UI renders them
// with t() in the active locale (not pre-formatted English).
export type Insight = { key: string; vars?: Record<string, string | number> };

// ---------------------------------------------------------------------------
// Section / class analytics for staff (all RLS-scoped by the caller).
// ---------------------------------------------------------------------------
export async function getSectionAnalytics(
  sectionId: number,
  classId: number,
  yearId: number,
  subjectId: number | null,
) {
  const supabase = await createClient();

  const [{ data: summary }, { data: dist }, top, needs, comparison] = await Promise.all([
    supabase.from("v_section_subject_summary")
      .select("subject_id, subject_name, term, avg_percent, n_students")
      .eq("section_id", sectionId).eq("academic_year_id", yearId),
    supabase.from("v_section_distribution")
      .select("band, n, subject_id")
      .eq("section_id", sectionId).eq("academic_year_id", yearId),
    supabase.rpc("top_performers", { p_section: sectionId, p_year: yearId, p_subject: subjectId ?? undefined, p_limit: 5 }),
    supabase.rpc("needs_support", { p_section: sectionId, p_year: yearId, p_threshold: 40 }),
    subjectId
      ? supabase.rpc("section_comparison", { p_class: classId, p_subject: subjectId, p_year: yearId })
      : Promise.resolve({ data: [] }),
  ]);

  // subject vs subject (average across terms) + per-subject term series
  const subjAgg = new Map<string, { sum: number; n: number }>();
  const termAgg = new Map<number, { sum: number; n: number }>();
  const subjTerm = new Map<string, Map<number, number>>();
  for (const r of summary ?? []) {
    const s = subjAgg.get(r.subject_name!) ?? { sum: 0, n: 0 };
    s.sum += Number(r.avg_percent); s.n += 1; subjAgg.set(r.subject_name!, s);
    if (r.term != null) {
      const t = termAgg.get(r.term) ?? { sum: 0, n: 0 };
      t.sum += Number(r.avg_percent); t.n += 1; termAgg.set(r.term, t);
      const m = subjTerm.get(r.subject_name!) ?? new Map<number, number>();
      m.set(r.term, Number(r.avg_percent)); subjTerm.set(r.subject_name!, m);
    }
  }
  const subjectAverages = [...subjAgg.entries()]
    .map(([subject, v]) => ({ subject, avg: Math.round((v.sum / v.n) * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg);
  const termTrend = [...termAgg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([term, v]) => ({ term: `Term ${term}`, avg: Math.round((v.sum / v.n) * 10) / 10 }));

  // steepest term-over-term subject drop
  let biggestDrop: { subject: string; drop: number } | null = null;
  for (const [subject, m] of subjTerm) {
    const terms = [...m.keys()].sort((a, b) => a - b);
    for (let i = 1; i < terms.length; i++) {
      const d = m.get(terms[i])! - m.get(terms[i - 1])!;
      if (d < 0 && (!biggestDrop || d < biggestDrop.drop)) biggestDrop = { subject, drop: d };
    }
  }

  const bands = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];
  const bandAgg = new Map<string, number>();
  for (const r of dist ?? []) {
    if (subjectId && r.subject_id !== subjectId) continue;
    bandAgg.set(r.band!, (bandAgg.get(r.band!) ?? 0) + Number(r.n));
  }
  const distribution = bands.map((band) => ({ band, n: bandAgg.get(band) ?? 0 }));

  const needsSupport = (needs.data ?? []) as Array<{ student_id: number; student_name: string; avg_percent: number; weak_subjects: string | null; recent_trend: number }>;

  const conclusions: Insight[] = [];
  if (subjectAverages.length) conclusions.push({ key: "x.insightStrongest", vars: { subject: subjectAverages[0].subject, avg: subjectAverages[0].avg } });
  if (biggestDrop && biggestDrop.drop <= -3) conclusions.push({ key: "x.insightTermDrop", vars: { subject: biggestDrop.subject, pts: Math.abs(Math.round(biggestDrop.drop * 10) / 10) } });
  if (needsSupport.length) conclusions.push({ key: "x.insightNeedSupport", vars: { n: needsSupport.length } });

  return {
    subjectAverages,
    termTrend,
    distribution,
    topPerformers: (top.data ?? []) as Array<{ student_id: number; student_name: string; avg_percent: number; n_marks: number }>,
    needsSupport,
    conclusions,
    sectionComparison: (comparison.data ?? []) as Array<{ section_name: string; avg_percent: number; n_students: number }>,
  };
}

// ---------------------------------------------------------------------------
// Whole-class analytics: aggregate across all sections of a class, plus
// section-vs-section comparison. RLS scopes rows to what the caller may see.
// ---------------------------------------------------------------------------
export async function getClassAnalytics(
  classId: number, sectionIds: number[], yearId: number, subjectId: number | null,
) {
  const supabase = await createClient();
  const [{ data: summary }, { data: dist }, top, needs, comparison] = await Promise.all([
    supabase.from("v_section_subject_summary")
      .select("section_id, section_name, subject_id, subject_name, term, avg_percent")
      .eq("class_id", classId).eq("academic_year_id", yearId),
    supabase.from("v_section_distribution")
      .select("band, n, subject_id").in("section_id", sectionIds).eq("academic_year_id", yearId),
    supabase.rpc("top_performers_class", { p_class: classId, p_year: yearId, p_subject: subjectId ?? undefined, p_limit: 6 }),
    supabase.rpc("needs_support_class", { p_class: classId, p_year: yearId, p_threshold: 40 }),
    subjectId ? supabase.rpc("section_comparison", { p_class: classId, p_subject: subjectId, p_year: yearId }) : Promise.resolve({ data: [] }),
  ]);

  // subject vs subject across the whole class
  const subjAgg = new Map<string, { sum: number; n: number }>();
  const secAgg = new Map<string, { sum: number; n: number }>();
  for (const r of summary ?? []) {
    const s = subjAgg.get(r.subject_name!) ?? { sum: 0, n: 0 };
    s.sum += Number(r.avg_percent); s.n += 1; subjAgg.set(r.subject_name!, s);
    const sc = secAgg.get(r.section_name!) ?? { sum: 0, n: 0 };
    sc.sum += Number(r.avg_percent); sc.n += 1; secAgg.set(r.section_name!, sc);
  }
  const subjectAverages = [...subjAgg.entries()].map(([subject, v]) => ({ subject, avg: Math.round((v.sum / v.n) * 10) / 10 })).sort((a, b) => b.avg - a.avg);

  // section comparison: use the subject RPC when a subject is chosen, else overall
  const sectionComparison = subjectId
    ? (comparison.data ?? []).map((c: { section_name: string; avg_percent: number }) => ({ name: c.section_name, avg: Math.round(Number(c.avg_percent) * 10) / 10 }))
    : [...secAgg.entries()].map(([name, v]) => ({ name, avg: Math.round((v.sum / v.n) * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name));

  const bands = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];
  const bandAgg = new Map<string, number>();
  for (const r of dist ?? []) { if (subjectId && r.subject_id !== subjectId) continue; bandAgg.set(r.band!, (bandAgg.get(r.band!) ?? 0) + Number(r.n)); }
  const distribution = bands.map((band) => ({ band, n: bandAgg.get(band) ?? 0 }));

  const topPerformers = (top.data ?? []) as Array<{ student_id: number; student_name: string; section_name: string; avg_percent: number }>;
  const needsSupport = (needs.data ?? []) as Array<{ student_id: number; student_name: string; section_name: string; avg_percent: number; weak_subjects: string | null; recent_trend: number }>;

  // structured class conclusions (rendered via t() in the active locale)
  const conclusions: Insight[] = [];
  if (subjectAverages.length) conclusions.push({ key: "x.insightStrongest", vars: { subject: subjectAverages[0].subject, avg: subjectAverages[0].avg } });
  if (sectionComparison.length > 1) {
    const best = [...sectionComparison].sort((a, b) => b.avg - a.avg)[0];
    const worst = [...sectionComparison].sort((a, b) => a.avg - b.avg)[0];
    conclusions.push({ key: "x.insightLeadTrail", vars: { best: best.name, bestAvg: best.avg, worst: worst.name, worstAvg: worst.avg } });
  }
  if (needsSupport.length) conclusions.push({ key: "x.insightNeedSupport", vars: { n: needsSupport.length } });

  return { subjectAverages, sectionComparison, distribution, topPerformers, needsSupport, conclusions };
}

// CBSE band from a percentage (matches the grade_band SQL helper).
function gradeBand(pct: number): string {
  if (pct >= 91) return "A1";
  if (pct >= 81) return "A2";
  if (pct >= 71) return "B1";
  if (pct >= 61) return "B2";
  if (pct >= 51) return "C1";
  if (pct >= 41) return "C2";
  if (pct >= 33) return "D";
  return "E";
}

// Distinct exams (assessments) across the given sections (optionally a single
// subject), ordered by date. Drives the "Exam" filter in the analytics bar.
export async function getScopeExams(sectionIds: number[], subjectId: number | null, yearId: number) {
  if (!sectionIds.length) return [] as { name: string }[];
  const supabase = await createClient();
  let q = supabase
    .from("assessment")
    .select("name, assessed_on")
    .in("section_id", sectionIds)
    .eq("academic_year_id", yearId)
    .order("assessed_on", { ascending: true });
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { data } = await q;
  const seen = new Set<string>();
  const out: { name: string }[] = [];
  for (const a of data ?? []) if (a.name && !seen.has(a.name)) { seen.add(a.name); out.push({ name: a.name }); }
  return out;
}

// Analytics for one exam across the sections in scope, optionally narrowed to a
// subject (else averaged across every subject the pupil sat in that exam):
// band distribution, top performers, and section-vs-section comparison.
export async function getExamAnalytics(sectionIds: number[], subjectId: number | null, yearId: number, examName: string) {
  const supabase = await createClient();
  const empty = { distribution: gradeBands(), topPerformers: [] as ExamTop[], sectionComparison: [] as ExamSection[], average: null as number | null, count: 0 };
  if (!sectionIds.length) return empty;

  let aq = supabase
    .from("assessment")
    .select("id, max_marks, section:section_id(name)")
    .in("section_id", sectionIds)
    .eq("academic_year_id", yearId)
    .eq("name", examName);
  if (subjectId) aq = aq.eq("subject_id", subjectId);
  const { data: asmts } = await aq;
  const list = asmts ?? [];
  if (!list.length) return empty;

  const maxById = new Map(list.map((a) => [a.id, Number(a.max_marks) || 100]));
  const secById = new Map(list.map((a) => [a.id, (a.section as unknown as { name: string } | null)?.name ?? "—"]));

  const { data: marks } = await supabase
    .from("mark")
    .select("student_id, marks_obtained, is_absent, assessment_id, student:student_id(full_name)")
    .in("assessment_id", list.map((a) => a.id));

  // Average each pupil's percentage across the exam (one subject → their single
  // paper; no subject → mean of all their papers in that exam).
  const perStudent = new Map<number, { name: string; section: string; sum: number; n: number }>();
  for (const m of marks ?? []) {
    if (m.is_absent || m.marks_obtained == null) continue;
    const pct = (Number(m.marks_obtained) / (maxById.get(m.assessment_id) || 100)) * 100;
    const cur = perStudent.get(m.student_id) ?? {
      name: (m.student as unknown as { full_name: string } | null)?.full_name ?? "—",
      section: secById.get(m.assessment_id) ?? "—",
      sum: 0, n: 0,
    };
    cur.sum += pct; cur.n += 1; perStudent.set(m.student_id, cur);
  }
  const recs = [...perStudent.values()].map((s) => ({ name: s.name, section: s.section, pct: Math.round((s.sum / s.n) * 10) / 10 }));
  if (!recs.length) return empty;

  const bandAgg = new Map<string, number>();
  for (const r of recs) bandAgg.set(gradeBand(r.pct), (bandAgg.get(gradeBand(r.pct)) ?? 0) + 1);
  const distribution = BANDS.map((band) => ({ band, n: bandAgg.get(band) ?? 0 }));

  const topPerformers: ExamTop[] = [...recs].sort((a, b) => b.pct - a.pct).slice(0, 6)
    .map((r) => ({ student_name: r.name, section_name: r.section, avg_percent: r.pct }));

  const secAgg = new Map<string, { sum: number; n: number }>();
  for (const r of recs) { const s = secAgg.get(r.section) ?? { sum: 0, n: 0 }; s.sum += r.pct; s.n += 1; secAgg.set(r.section, s); }
  const sectionComparison: ExamSection[] = [...secAgg.entries()]
    .map(([name, v]) => ({ name, avg: Math.round((v.sum / v.n) * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const average = Math.round((recs.reduce((a, r) => a + r.pct, 0) / recs.length) * 10) / 10;
  return { distribution, topPerformers, sectionComparison, average, count: recs.length };
}

type ExamTop = { student_name: string; section_name: string; avg_percent: number };
type ExamSection = { name: string; avg: number };
const BANDS = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];
const gradeBands = () => BANDS.map((band) => ({ band, n: 0 }));

// ---------------------------------------------------------------------------
// Per-student continuous progress record (owner or staff-in-scope).
// ---------------------------------------------------------------------------
type TrendRow = {
  subject_id: number; subject_name: string; subject_code: string;
  assessment_name: string; assessed_on: string; percent: number; delta: number | null;
  prev_percent: number | null; band: string | null; year_name: string; academic_year_id: number;
  is_current: boolean; term: number | null;
};

export async function getStudentProgress(studentId: number, yearId?: number | null) {
  const supabase = await createClient();

  const [{ data: student }, { data: rows }, { data: obs }] = await Promise.all([
    supabase.from("student").select("id, full_name, admission_no").eq("id", studentId).single(),
    supabase.from("v_student_subject_trend")
      .select("subject_id, subject_name, subject_code, assessment_name, assessed_on, percent, delta, prev_percent, band, year_name, academic_year_id, is_current, term")
      .eq("student_id", studentId)
      .order("assessed_on", { ascending: true }),
    supabase.from("observation")
      .select("id, observed_on, category, body, subject:subject_id(name), staff:staff_id(full_name)")
      .eq("student_id", studentId)
      .order("observed_on", { ascending: false })
      .limit(12),
  ]);

  const allTrend = (rows ?? []) as TrendRow[];

  // All sessions (years) the pupil has records for — drives the session chooser.
  const yearsMap = new Map<number, { yearId: number; yearName: string; isCurrent: boolean }>();
  for (const r of allTrend) if (!yearsMap.has(r.academic_year_id)) yearsMap.set(r.academic_year_id, { yearId: r.academic_year_id, yearName: r.year_name, isCurrent: r.is_current });
  const years = [...yearsMap.values()].sort((a, b) => b.yearId - a.yearId);

  // Scope to one session, or keep the full lifetime history (yearId omitted/null).
  const trend = yearId ? allTrend.filter((r) => r.academic_year_id === yearId) : allTrend;

  // Per-subject summary (latest result + delta + full point list)
  const bySubject = new Map<number, { name: string; code: string; points: { label: string; percent: number }[]; latest: number; delta: number | null; prev: number | null; band: string | null }>();
  for (const r of trend) {
    const s = bySubject.get(r.subject_id) ?? { name: r.subject_name, code: r.subject_code, points: [], latest: 0, delta: null, prev: null, band: null };
    s.points.push({ label: shortLabel(r.assessment_name, r.year_name), percent: Number(r.percent) });
    s.latest = Number(r.percent); s.delta = r.delta; s.prev = r.prev_percent; s.band = r.band;
    bySubject.set(r.subject_id, s);
  }
  const subjects = [...bySubject.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Pivot for multi-subject line chart: one row per (year, assessment), a column per subject code.
  const labelOrder: string[] = [];
  const pivot = new Map<string, Record<string, number | string>>();
  for (const r of trend) {
    const label = shortLabel(r.assessment_name, r.year_name);
    if (!pivot.has(label)) { pivot.set(label, { label }); labelOrder.push(label); }
    pivot.get(label)![r.subject_code] = Number(r.percent);
  }
  const chartData = labelOrder.map((l) => pivot.get(l)!);
  const seriesSubjects = subjects.map((s) => ({ code: s.code, name: s.name }));

  // Year-on-year overall average
  const yearAgg = new Map<string, { sum: number; n: number; id: number }>();
  for (const r of trend) {
    const y = yearAgg.get(r.year_name) ?? { sum: 0, n: 0, id: r.academic_year_id };
    y.sum += Number(r.percent); y.n += 1; yearAgg.set(r.year_name, y);
  }
  const yearOnYear = [...yearAgg.entries()].map(([year, v]) => ({ year, avg: Math.round((v.sum / v.n) * 10) / 10 }));
  const currentAvg = (() => {
    // A specific session → that session's mean; lifetime → the current year's mean.
    const base = yearId ? trend : trend.filter((r) => r.is_current);
    const rowsForAvg = base.length ? base : trend;
    if (!rowsForAvg.length) return null;
    return Math.round((rowsForAvg.reduce((a, r) => a + Number(r.percent), 0) / rowsForAvg.length) * 10) / 10;
  })();

  // Every session (year) in detail: subjects × assessments grid.
  const sessMap = new Map<number, {
    yearId: number; yearName: string; isCurrent: boolean;
    assessments: string[]; assessSet: Set<string>;
    subjects: Map<string, { name: string; code: string; cells: Record<string, { percent: number; band: string | null; delta: number | null }> }>;
  }>();
  for (const r of trend) {
    let s = sessMap.get(r.academic_year_id);
    if (!s) { s = { yearId: r.academic_year_id, yearName: r.year_name, isCurrent: r.is_current, assessments: [], assessSet: new Set(), subjects: new Map() }; sessMap.set(r.academic_year_id, s); }
    const aName = shortName(r.assessment_name);
    if (!s.assessSet.has(aName)) { s.assessSet.add(aName); s.assessments.push(aName); }
    let subj = s.subjects.get(r.subject_code);
    if (!subj) { subj = { name: r.subject_name, code: r.subject_code, cells: {} }; s.subjects.set(r.subject_code, subj); }
    subj.cells[aName] = { percent: Number(r.percent), band: r.band, delta: r.delta };
  }
  const sessions = [...sessMap.values()]
    .sort((a, b) => b.yearId - a.yearId)
    .map((s) => ({ yearId: s.yearId, yearName: s.yearName, isCurrent: s.isCurrent, assessments: s.assessments, subjects: [...s.subjects.values()].sort((a, b) => a.name.localeCompare(b.name)) }));

  const observations = (obs ?? []).map((o) => ({
    id: o.id,
    date: o.observed_on,
    category: o.category,
    body: o.body,
    subject: (o.subject as unknown as { name: string } | null)?.name ?? null,
    staff: (o.staff as unknown as { full_name: string } | null)?.full_name ?? "—",
  }));

  return {
    student: student as { id: number; full_name: string; admission_no: string } | null,
    subjects, chartData, seriesSubjects, yearOnYear, currentAvg, observations, sessions, years,
    hasData: trend.length > 0,
  };
}

// Class & section rank for a student (owner or staff-in-scope). Uses a
// SECURITY DEFINER RPC that returns only ranks + aggregates, never other pupils.
export async function getStudentStanding(studentId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("student_standing", { p_student: studentId, p_year: yearId });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || row.section_rank == null) return null;
  return {
    sectionRank: row.section_rank, sectionSize: row.section_size,
    classRank: row.class_rank, classSize: row.class_size,
    studentAvg: row.student_avg == null ? null : Number(row.student_avg),
    sectionAvg: row.section_avg == null ? null : Number(row.section_avg),
    classAvg: row.class_avg == null ? null : Number(row.class_avg),
  };
}

function shortName(assessment: string): string {
  const map: Record<string, string> = {
    "Periodic Test 1": "PT1", "Periodic Test 2": "PT2", "Periodic Test 3": "PT3", "Periodic Test 4": "PT4",
    "Half-Yearly Examination": "HY", "Half-Yearly": "HY",
    "Final Examination": "Final", "Annual": "Annual",
  };
  if (map[assessment]) return map[assessment];
  const m = assessment.match(/Monthly Test\s*[—–-]\s*([A-Za-z]{3})/); // "Monthly Test — July" -> "Jul"
  if (m) return m[1];
  return assessment.length > 10 ? assessment.slice(0, 9) + "…" : assessment;
}

function shortLabel(assessment: string, year: string): string {
  return `${shortName(assessment)} '${year.slice(2, 4)}`; // '2024-25' -> '24'
}

// Children of the signed-in guardian (for the child switcher).
export async function getMyChildren() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guardian_student")
    .select("student:student_id(id, full_name, admission_no)")
    .order("student_id");
  return (data ?? []).map((g) => g.student as unknown as { id: number; full_name: string; admission_no: string });
}
