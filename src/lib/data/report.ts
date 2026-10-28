import { createClient } from "@/lib/supabase/server";

export type ReportMark = { subject_name: string; assessment_name: string; percent: number; delta: number | null; prev_percent: number | null; band: string | null };
export type StudentReport = {
  student: { full_name: string; admission_no: string } | null;
  marks: ReportMark[];
  attendance: { present: number; total: number; pct: number | null } | null;
  notices: Array<{ title: string; published_at: string }>;
};
export type ClassReportRow = { id: number; roll: number | null; name: string; avg: number | null; attPct: number | null };

export function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day
  return { start, end };
}

// Academic-year date span (for the "yearly" report range).
export async function getYearBounds(yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("academic_year").select("start_date, end_date").eq("id", yearId).single();
  return { start: data?.start_date ?? "1900-01-01", end: data?.end_date ?? "2999-12-31" };
}

// Distinct exams that have marks in a section this year (for the exam picker).
export async function getSectionExamNames(sectionId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("v_mark_detail")
    .select("assessment_name, assessed_on")
    .eq("section_id", sectionId).eq("academic_year_id", yearId)
    .order("assessed_on", { ascending: true });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of data ?? []) if (r.assessment_name && !seen.has(r.assessment_name)) { seen.add(r.assessment_name); out.push(r.assessment_name); }
  return out;
}

// One student's report over a date range (monthly or yearly): marks + attendance + notices.
export async function getStudentReport(studentId: number, start: string, end: string): Promise<StudentReport> {
  const supabase = await createClient();
  const [{ data: student }, { data: marks }, { data: att }, { data: notices }] = await Promise.all([
    supabase.from("student").select("full_name, admission_no").eq("id", studentId).single(),
    supabase.from("v_student_subject_trend")
      .select("subject_name, assessment_name, percent, delta, prev_percent, band")
      .eq("student_id", studentId).gte("assessed_on", start).lte("assessed_on", end)
      .order("assessed_on"),
    supabase.from("attendance_record")
      .select("status").eq("student_id", studentId).is("period", null)
      .gte("on_date", start).lte("on_date", end),
    supabase.from("announcement")
      .select("title, published_at").gte("published_at", start).lte("published_at", `${end}T23:59:59`)
      .order("published_at", { ascending: false }),
  ]);

  const rows = (att ?? []).filter((a) => a.status !== "holiday");
  const total = rows.length;
  const present = rows.filter((a) => a.status === "present" || a.status === "late").length;

  return {
    student: student as { full_name: string; admission_no: string } | null,
    marks: (marks ?? []) as ReportMark[],
    attendance: { present, total, pct: total ? Math.round((present / total) * 1000) / 10 : null },
    notices: (notices ?? []) as Array<{ title: string; published_at: string }>,
  };
}

// One student's marks for a single exam across subjects (no attendance/notices).
export async function getStudentExamReport(studentId: number, yearId: number, examName: string): Promise<StudentReport> {
  const supabase = await createClient();
  const [{ data: student }, { data: marks }] = await Promise.all([
    supabase.from("student").select("full_name, admission_no").eq("id", studentId).single(),
    supabase.from("v_student_subject_trend")
      .select("subject_name, assessment_name, percent, delta, prev_percent, band")
      .eq("student_id", studentId).eq("academic_year_id", yearId).eq("assessment_name", examName)
      .order("subject_name"),
  ]);
  return {
    student: student as { full_name: string; admission_no: string } | null,
    marks: (marks ?? []) as ReportMark[],
    attendance: null,
    notices: [],
  };
}


// PostgREST returns at most 1,000 rows per request, so a year of marks for one
// section (~1,200) or a month for the whole school (~4,000) is read in pages:
// the first page also returns the total count, then every other page is sent
// at once. `make(from, to, withCount)` must build a fresh, stably ordered query.
type Page<T> = PromiseLike<{ data: T[] | null; count?: number | null; error: unknown }>;
const PAGE = 1000;
async function fetchAll<T>(make: (from: number, to: number, withCount: boolean) => Page<T>): Promise<T[]> {
  const first = await make(0, PAGE - 1, true);
  const rows = [...(first.data ?? [])];
  const total = first.count ?? rows.length;
  if (total <= PAGE) return rows;
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) => make((i + 1) * PAGE, (i + 2) * PAGE - 1, false)),
  );
  for (const p of pages) rows.push(...(p.data ?? []));
  return rows;
}

type AttRow = { student_id: number; present: number; total: number };
type Db = Awaited<ReturnType<typeof createClient>>;

// Per-pupil present/total for one section over a date range, counted in the
// database (one small row per pupil instead of thousands of daily records).
async function sectionAttendance(supabase: Db, sectionId: number, yearId: number, start: string, end: string): Promise<AttRow[]> {
  const { data } = await supabase.rpc("section_attendance_range", { p_section: sectionId, p_start: start, p_end: end, p_year: yearId });
  return (data ?? []).map((r) => ({ student_id: r.student_id, present: Number(r.present), total: Number(r.total) }));
}

// Whole-class report over a date range: per-student average marks + attendance %.
export async function getClassReport(sectionId: number, yearId: number, start: string, end: string): Promise<ClassReportRow[]> {
  const supabase = await createClient();
  const [marks, att, { data: roster }] = await Promise.all([
    fetchAll<{ student_id: number | null; percent: number | null }>((from, to, withCount) =>
      supabase.from("v_mark_detail").select("student_id, percent", withCount ? { count: "exact" } : undefined)
        .eq("section_id", sectionId).eq("academic_year_id", yearId)
        .gte("assessed_on", start).lte("assessed_on", end)
        .order("mark_id").range(from, to)),
    sectionAttendance(supabase, sectionId, yearId, start, end),
    supabase.from("student_enrollment").select("roll_no, student:student_id(id, full_name)")
      .eq("section_id", sectionId).eq("academic_year_id", yearId).order("roll_no"),
  ]);
  return rollUp(roster, marks, att);
}

// Whole-class report for a single exam: per-student average % in that exam (no attendance).
export async function getClassExamReport(sectionId: number, yearId: number, examName: string): Promise<ClassReportRow[]> {
  const supabase = await createClient();
  const [marks, { data: roster }] = await Promise.all([
    fetchAll<{ student_id: number | null; percent: number | null }>((from, to, withCount) =>
      supabase.from("v_mark_detail").select("student_id, percent", withCount ? { count: "exact" } : undefined)
        .eq("section_id", sectionId).eq("academic_year_id", yearId).eq("assessment_name", examName)
        .order("mark_id").range(from, to)),
    supabase.from("student_enrollment").select("roll_no, student:student_id(id, full_name)")
      .eq("section_id", sectionId).eq("academic_year_id", yearId).order("roll_no"),
  ]);
  return rollUp(roster, marks, null);
}

type RosterRow = { roll_no: number | null; student: unknown } | null;
function rollUp(
  roster: RosterRow[] | null,
  marks: { student_id: number | null; percent: number | null }[] | null,
  att: AttRow[] | null,
): ClassReportRow[] {
  const markAgg = new Map<number, { sum: number; n: number }>();
  for (const m of marks ?? []) {
    if (m.student_id == null || m.percent == null) continue;
    const a = markAgg.get(m.student_id) ?? { sum: 0, n: 0 };
    a.sum += Number(m.percent); a.n += 1; markAgg.set(m.student_id, a);
  }
  const attAgg = new Map<number, AttRow>((att ?? []).map((a) => [a.student_id, a]));
  return (roster ?? []).map((e) => {
    const s = e!.student as unknown as { id: number; full_name: string };
    const mk = markAgg.get(s.id);
    const at = attAgg.get(s.id);
    return {
      id: s.id, roll: e!.roll_no, name: s.full_name,
      avg: mk ? Math.round((mk.sum / mk.n) * 10) / 10 : null,
      attPct: att && at && at.total ? Math.round((at.present / at.total) * 1000) / 10 : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Whole school (principal / office): every pupil, grouped by class then section.
// ---------------------------------------------------------------------------
export type SchoolSectionRef = { id: number; name: string; class_name: string; class_level: number };
export type SchoolReportSection = {
  sectionId: number; className: string; classLevel: number; sectionName: string;
  rows: ClassReportRow[];
  avg: number | null;      // mean of the pupils' averages
  attPct: number | null;   // all days present / all school days in the section
};
export type SchoolReportPeriod =
  | { kind: "range"; start: string; end: string; yearly: boolean }
  | { kind: "exam"; examName: string };

// Distinct exam names across the whole school this year (for the exam picker).
export async function getSchoolExamNames(yearId: number) {
  const supabase = await createClient();
  const rows = await fetchAll<{ name: string }>((from, to, withCount) =>
    supabase.from("assessment").select("name", withCount ? { count: "exact" } : undefined)
      .eq("academic_year_id", yearId).order("assessed_on").order("id").range(from, to));
  return [...new Set(rows.map((r) => r.name).filter(Boolean))];
}

// Set-based: the roster (2 pages), the marks (paged for a month / one exam, or
// averaged in the database per section for a full year) and attendance counted
// in the database per section. Every request is sent at the same time.
export async function getSchoolReport(yearId: number, sections: SchoolSectionRef[], period: SchoolReportPeriod): Promise<SchoolReportSection[]> {
  const supabase = await createClient();

  const rosterP = fetchAll<{ section_id: number; roll_no: number | null; student: unknown }>((from, to, withCount) =>
    supabase.from("student_enrollment").select("section_id, roll_no, student:student_id(id, full_name)", withCount ? { count: "exact" } : undefined)
      .eq("academic_year_id", yearId).order("id").range(from, to));

  // student_id -> average %
  const marksF = async (): Promise<Map<number, number>> => {
    const avg = new Map<number, number>();
    if (period.kind === "range" && period.yearly) {
      // A full year is ~55k marks: let the database average them, one call per section.
      const res = await Promise.all(sections.map((s) =>
        supabase.rpc("top_performers", { p_section: s.id, p_year: yearId, p_limit: 5000 })));
      for (const r of res) for (const x of r.data ?? []) {
        if (x.avg_percent != null) avg.set(x.student_id, Math.round(Number(x.avg_percent) * 10) / 10);
      }
      return avg;
    }
    const rows = await fetchAll<{ id: number; student_id: number; marks_obtained: number | null; assessment: unknown }>((from, to, withCount) => {
      const q = supabase.from("mark")
        .select("id, student_id, marks_obtained, assessment!inner(max_marks)", withCount ? { count: "exact" } : undefined)
        .eq("assessment.academic_year_id", yearId).not("marks_obtained", "is", null);
      const f = period.kind === "exam"
        ? q.eq("assessment.name", period.examName)
        : q.gte("assessment.assessed_on", period.start).lte("assessment.assessed_on", period.end);
      return f.order("id").range(from, to);
    });
    const agg = new Map<number, { sum: number; n: number }>();
    for (const m of rows) {
      const max = Number((m.assessment as { max_marks: number } | null)?.max_marks ?? 0);
      if (m.marks_obtained == null || !(max > 0)) continue;
      const a = agg.get(m.student_id) ?? { sum: 0, n: 0 };
      a.sum += (Number(m.marks_obtained) / max) * 100; a.n += 1; agg.set(m.student_id, a);
    }
    for (const [id, a] of agg) avg.set(id, Math.round((a.sum / a.n) * 10) / 10);
    return avg;
  };

  const attF = (): Promise<Map<number, AttRow> | null> => period.kind === "range"
    ? Promise.all(sections.map((s) => sectionAttendance(supabase, s.id, yearId, period.start, period.end)))
        .then((all) => new Map(all.flat().map((a) => [a.student_id, a])))
    : Promise.resolve(null);

  // Fast path: one database call for every pupil's figures (migration 0035).
  // Until that is applied the call fails and the per-section requests above run instead.
  type Summary = { student_id: number; avg_percent: number | string | null; present: number | string; total: number | string };
  const summaryP = supabase.rpc("school_report_summary" as never, (period.kind === "exam"
    ? { p_year: yearId, p_exam: period.examName }
    : { p_year: yearId, p_start: period.start, p_end: period.end }) as never) as unknown as PromiseLike<{ data: Summary[] | null; error: unknown }>;

  const [roster, summary] = await Promise.all([rosterP, summaryP]);
  let avg: Map<number, number>;
  let att: Map<number, AttRow> | null;
  if (!summary.error && summary.data) {
    avg = new Map();
    for (const r of summary.data) if (r.avg_percent != null) avg.set(r.student_id, Number(r.avg_percent));
    att = period.kind === "range"
      ? new Map(summary.data.map((r) => [r.student_id, { student_id: r.student_id, present: Number(r.present), total: Number(r.total) }]))
      : null;
  } else {
    [avg, att] = await Promise.all([marksF(), attF()]);
  }

  const bySection = new Map<number, ClassReportRow[]>();
  const attTotals = new Map<number, { p: number; t: number }>();
  for (const e of roster) {
    const s = e.student as { id: number; full_name: string } | null;
    if (!s) continue;
    const a = att?.get(s.id);
    const row: ClassReportRow = {
      id: s.id, roll: e.roll_no, name: s.full_name,
      avg: avg.get(s.id) ?? null,
      attPct: a && a.total ? Math.round((a.present / a.total) * 1000) / 10 : null,
    };
    const list = bySection.get(e.section_id);
    if (list) list.push(row); else bySection.set(e.section_id, [row]);
    if (a) {
      const t = attTotals.get(e.section_id) ?? { p: 0, t: 0 };
      t.p += a.present; t.t += a.total; attTotals.set(e.section_id, t);
    }
  }

  return [...sections]
    .sort((a, b) => a.class_level - b.class_level || a.name.localeCompare(b.name))
    .map((s) => {
      const rows = (bySection.get(s.id) ?? []).sort((a, b) => (a.roll ?? Number.MAX_SAFE_INTEGER) - (b.roll ?? Number.MAX_SAFE_INTEGER));
      const avgs = rows.map((r) => r.avg).filter((v): v is number => v != null);
      const t = attTotals.get(s.id);
      return {
        sectionId: s.id, className: s.class_name, classLevel: s.class_level, sectionName: s.name, rows,
        avg: avgs.length ? Math.round((avgs.reduce((x, y) => x + y, 0) / avgs.length) * 10) / 10 : null,
        attPct: t && t.t ? Math.round((t.p / t.t) * 1000) / 10 : null,
      };
    })
    .filter((s) => s.rows.length > 0);
}

// ---------------------------------------------------------------------------
// Every pupil's report card for one section (the "All report cards" PDF):
// the same contents as getStudentReport / getStudentExamReport, fetched for
// the whole class in a few set-based queries. In roll-number order.
// ---------------------------------------------------------------------------
export type ClassCard = StudentReport & { roll: number | null };

export async function getClassReportCards(
  sectionId: number, yearId: number,
  period: { kind: "range"; start: string; end: string } | { kind: "exam"; examName: string },
): Promise<ClassCard[]> {
  const supabase = await createClient();
  const { data: roster } = await supabase.from("student_enrollment")
    .select("roll_no, status, student:student_id(id, full_name, admission_no)")
    .eq("section_id", sectionId).eq("academic_year_id", yearId).neq("status", "transferred")
    .order("roll_no");
  const pupils = (roster ?? []).map((e) => ({ roll: e.roll_no, ...(e.student as unknown as { id: number; full_name: string; admission_no: string }) }));
  if (!pupils.length) return [];
  const ids = pupils.map((p) => p.id);

  type Mark = ReportMark & { student_id: number };
  const marksP = fetchAll<Mark>((from, to, withCount) => {
    const q = supabase.from("v_student_subject_trend")
      .select("student_id, subject_name, assessment_name, percent, delta, prev_percent, band", withCount ? { count: "exact" } : undefined)
      .in("student_id", ids);
    const f = period.kind === "exam"
      ? q.eq("academic_year_id", yearId).eq("assessment_name", period.examName)
      : q.gte("assessed_on", period.start).lte("assessed_on", period.end);
    return f.order("student_id").order("assessed_on").order("mark_id").range(from, to) as unknown as Page<Mark>;
  });
  const attP = period.kind === "range"
    ? sectionAttendance(supabase, sectionId, yearId, period.start, period.end)
    : Promise.resolve(null);
  const noticesP = period.kind === "range"
    ? supabase.from("announcement").select("title, published_at")
        .gte("published_at", period.start).lte("published_at", `${period.end}T23:59:59`)
        .order("published_at", { ascending: false })
    : Promise.resolve({ data: [] as Array<{ title: string; published_at: string }> });

  const [marks, att, { data: notices }] = await Promise.all([marksP, attP, noticesP]);
  const marksBy = new Map<number, ReportMark[]>();
  for (const { student_id, ...m } of marks) marksBy.set(student_id, [...(marksBy.get(student_id) ?? []), m]);
  const attBy = new Map((att ?? []).map((a) => [a.student_id, a]));

  return pupils.map((p) => {
    const a = attBy.get(p.id);
    return {
      roll: p.roll,
      student: { full_name: p.full_name, admission_no: p.admission_no },
      marks: period.kind === "exam" ? (marksBy.get(p.id) ?? []).sort((x, y) => x.subject_name.localeCompare(y.subject_name)) : marksBy.get(p.id) ?? [],
      attendance: period.kind === "range"
        ? { present: a?.present ?? 0, total: a?.total ?? 0, pct: a && a.total ? Math.round((a.present / a.total) * 1000) / 10 : null }
        : null,
      notices: (notices ?? []) as Array<{ title: string; published_at: string }>,
    };
  });
}
