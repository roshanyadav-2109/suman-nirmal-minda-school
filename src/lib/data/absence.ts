import { createClient } from "@/lib/supabase/server";

export type AbsenceNotice = {
  id: number;
  on_date: string;
  reason: string | null;
  status: string;
  studentName: string;
};

// Absence notices for the CURRENT session only (RLS: own children, or staff
// sections). Nothing from past years — a notice is valid per session.
export async function getAbsenceNotices(): Promise<AbsenceNotice[]> {
  const supabase = await createClient();
  const { data: year } = await supabase.from("academic_year").select("id").eq("is_current", true).single();
  let query = supabase
    .from("absence_notice")
    .select("id, on_date, reason, status, student:student_id(full_name)")
    .order("on_date", { ascending: false })
    .limit(80);
  if (year) query = query.eq("academic_year_id", year.id);
  const { data } = await query;
  return (data ?? []).map((n) => ({
    id: n.id,
    on_date: n.on_date,
    reason: n.reason,
    status: n.status,
    studentName: (n.student as unknown as { full_name: string } | null)?.full_name ?? "—",
  }));
}
