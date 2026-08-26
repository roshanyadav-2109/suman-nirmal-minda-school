import { createClient } from "@/lib/supabase/server";

export async function getDateAttendance(sectionId: number, date: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_record")
    .select("student_id, status")
    .eq("section_id", sectionId)
    .eq("on_date", date)
    .is("period", null);
  const map = new Map<number, string>();
  for (const r of data ?? []) map.set(r.student_id, r.status);
  return map;
}

export type AttSummary = { studentId: number; present: number; total: number; pct: number };

// Per-student attendance % for a section across the year (present+late count).
export async function getSectionAttendanceSummary(sectionId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_record")
    .select("student_id, status")
    .eq("section_id", sectionId)
    .eq("academic_year_id", yearId)
    .is("period", null);
  const agg = new Map<number, { present: number; total: number }>();
  for (const r of data ?? []) {
    if (r.status === "holiday") continue; // holidays don't count toward %
    const a = agg.get(r.student_id) ?? { present: 0, total: 0 };
    a.total += 1;
    if (r.status === "present" || r.status === "late") a.present += 1;
    agg.set(r.student_id, a);
  }
  const out = new Map<number, AttSummary>();
  for (const [studentId, a] of agg) {
    out.set(studentId, { studentId, present: a.present, total: a.total, pct: a.total ? Math.round((a.present / a.total) * 1000) / 10 : 0 });
  }
  return out;
}

// Owner view: a student's own attendance summary + recent days.
export async function getStudentAttendance(studentId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_record")
    .select("on_date, status")
    .eq("student_id", studentId)
    .eq("academic_year_id", yearId)
    .is("period", null)
    .order("on_date", { ascending: false });
  const rows = data ?? [];
  const counted = rows.filter((r) => r.status !== "holiday"); // holidays excluded
  const total = counted.length;
  const present = counted.filter((r) => r.status === "present" || r.status === "late").length;
  const pct = total ? Math.round((present / total) * 1000) / 10 : 0;
  return { pct, present, total, recent: rows.slice(0, 30) };
}

// Dates that already have attendance in a section (for the date picker default).
export async function getLatestAttendanceDate(sectionId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_record")
    .select("on_date")
    .eq("section_id", sectionId)
    .order("on_date", { ascending: false })
    .limit(1);
  return data?.[0]?.on_date ?? null;
}

// Most recent day with any attendance in the year (admin overview default).
// Year-scoped so it can use idx_att_year_date (fast at full-school scale).
export async function getLatestAttendanceDateAll(yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_record")
    .select("on_date")
    .eq("academic_year_id", yearId)
    .is("period", null)
    .order("on_date", { ascending: false })
    .limit(1);
  return data?.[0]?.on_date ?? null;
}

// Aggregate attendance over a date range: students attended per section, rolled
// up to class-wise and school-wide totals (principal/office overview).
// Day view passes start==end; month view passes the month bounds.
export async function getAttendanceOverview(start: string, end: string, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("attendance_overview_range", { p_start: start, p_end: end, p_year: yearId });
  const rows = (data ?? []) as Array<{ class_id: number; class_name: string; class_level: number; section_id: number; section_name: string; present: number; total: number }>;

  const classes = new Map<number, { id: number; name: string; level: number; present: number; total: number; sections: { id: number; name: string; present: number; total: number; pct: number | null }[] }>();
  let schoolPresent = 0, schoolTotal = 0;
  for (const r of rows) {
    const p = Number(r.present), tot = Number(r.total);
    const c = classes.get(r.class_id) ?? { id: r.class_id, name: r.class_name, level: r.class_level, present: 0, total: 0, sections: [] };
    c.present += p; c.total += tot;
    c.sections.push({ id: r.section_id, name: r.section_name, present: p, total: tot, pct: tot ? Math.round((p / tot) * 1000) / 10 : null });
    classes.set(r.class_id, c);
    schoolPresent += p; schoolTotal += tot;
  }
  return {
    school: { present: schoolPresent, total: schoolTotal, pct: schoolTotal ? Math.round((schoolPresent / schoolTotal) * 1000) / 10 : null },
    classes: [...classes.values()].sort((a, b) => a.level - b.level).map((c) => ({ ...c, pct: c.total ? Math.round((c.present / c.total) * 1000) / 10 : null })),
  };
}

// Per-student attendance over a range for the principal's detailed drill-down.
export async function getSectionAttendanceRange(sectionId: number, start: string, end: string, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("section_attendance_range", { p_section: sectionId, p_start: start, p_end: end, p_year: yearId });
  return ((data ?? []) as Array<{ student_id: number; full_name: string; roll_no: number; present: number; total: number }>).map((r) => ({
    id: r.student_id,
    name: r.full_name,
    roll: r.roll_no,
    present: Number(r.present),
    total: Number(r.total),
    pct: Number(r.total) ? Math.round((Number(r.present) / Number(r.total)) * 1000) / 10 : null,
  }));
}
