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

// Whole-class report over a date range: per-student average marks + attendance %.
export async function getClassReport(sectionId: number, yearId: number, start: string, end: string): Promise<ClassReportRow[]> {
  const supabase = await createClient();
  const [{ data: marks }, { data: att }, { data: roster }] = await Promise.all([
    supabase.from("v_mark_detail").select("student_id, percent")
      .eq("section_id", sectionId).eq("academic_year_id", yearId)
      .gte("assessed_on", start).lte("assessed_on", end),
    supabase.from("attendance_record").select("student_id, status")
      .eq("section_id", sectionId).is("period", null).gte("on_date", start).lte("on_date", end),
    supabase.from("student_enrollment").select("roll_no, student:student_id(id, full_name)")
      .eq("section_id", sectionId).eq("academic_year_id", yearId).order("roll_no"),
  ]);
  return rollUp(roster, marks, att);
}

// Whole-class report for a single exam: per-student average % in that exam (no attendance).
export async function getClassExamReport(sectionId: number, yearId: number, examName: string): Promise<ClassReportRow[]> {
  const supabase = await createClient();
  const [{ data: marks }, { data: roster }] = await Promise.all([
    supabase.from("v_mark_detail").select("student_id, percent")
      .eq("section_id", sectionId).eq("academic_year_id", yearId).eq("assessment_name", examName),
    supabase.from("student_enrollment").select("roll_no, student:student_id(id, full_name)")
      .eq("section_id", sectionId).eq("academic_year_id", yearId).order("roll_no"),
  ]);
  return rollUp(roster, marks, null);
}

type RosterRow = { roll_no: number | null; student: unknown } | null;
function rollUp(
  roster: RosterRow[] | null,
  marks: { student_id: number | null; percent: number | null }[] | null,
  att: { student_id: number | null; status: string }[] | null,
): ClassReportRow[] {
  const markAgg = new Map<number, { sum: number; n: number }>();
  for (const m of marks ?? []) {
    if (m.student_id == null || m.percent == null) continue;
    const a = markAgg.get(m.student_id) ?? { sum: 0, n: 0 };
    a.sum += Number(m.percent); a.n += 1; markAgg.set(m.student_id, a);
  }
  const attAgg = new Map<number, { p: number; t: number }>();
  for (const a of att ?? []) {
    if (a.student_id == null || a.status === "holiday") continue;
    const x = attAgg.get(a.student_id) ?? { p: 0, t: 0 };
    x.t += 1; if (a.status === "present" || a.status === "late") x.p += 1; attAgg.set(a.student_id, x);
  }
  return (roster ?? []).map((e) => {
    const s = e!.student as unknown as { id: number; full_name: string };
    const mk = markAgg.get(s.id);
    const at = attAgg.get(s.id);
    return {
      id: s.id, roll: e!.roll_no, name: s.full_name,
      avg: mk ? Math.round((mk.sum / mk.n) * 10) / 10 : null,
      attPct: att && at && at.t ? Math.round((at.p / at.t) * 1000) / 10 : null,
    };
  });
}
