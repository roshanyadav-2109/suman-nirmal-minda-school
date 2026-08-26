import { createClient } from "@/lib/supabase/server";

// School-wide KPIs for the principal dashboard (RLS-scoped).
export async function getSchoolOverview(yearId: number) {
  const supabase = await createClient();
  const [{ data: ov }, { data: cls }] = await Promise.all([
    supabase.rpc("school_overview", { p_year: yearId }),
    supabase.rpc("class_overview", { p_year: yearId }),
  ]);
  const o = (Array.isArray(ov) ? ov[0] : ov) as
    | { students: number; avg_percent: number | null; attendance_pct: number | null; slippage: number }
    | undefined;
  return {
    students: Number(o?.students ?? 0),
    avg: o?.avg_percent == null ? null : Number(o.avg_percent),
    attendancePct: o?.attendance_pct == null ? null : Number(o.attendance_pct),
    slippage: Number(o?.slippage ?? 0),
    classes: (cls ?? []).map((c: { class_id: number; class_name: string; class_level: number; avg_percent: number; students: number }) => ({
      id: c.class_id, name: c.class_name, level: c.class_level,
      avg: c.avg_percent == null ? null : Number(c.avg_percent), students: Number(c.students),
    })),
  };
}

// Admin counts for the office dashboard, incl. results awaiting release.
export async function getOfficeStats(yearId: number) {
  const supabase = await createClient();
  const [students, staff, allot, released, draft] = await Promise.all([
    supabase.from("student_enrollment").select("id", { count: "exact", head: true }).eq("academic_year_id", yearId),
    supabase.from("staff").select("id", { count: "exact", head: true }),
    supabase.from("teacher_allotment").select("id", { count: "exact", head: true }).eq("academic_year_id", yearId),
    supabase.from("assessment").select("id", { count: "exact", head: true }).eq("academic_year_id", yearId).eq("is_published", true),
    supabase.from("assessment").select("id", { count: "exact", head: true }).eq("academic_year_id", yearId).eq("is_published", false),
  ]);
  return {
    students: students.count ?? 0,
    staff: staff.count ?? 0,
    allotments: allot.count ?? 0,
    released: released.count ?? 0,
    draft: draft.count ?? 0,
  };
}
