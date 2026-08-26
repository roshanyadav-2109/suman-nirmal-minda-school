"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

export type AttStatus = "present" | "absent" | "late" | "leave" | "holiday";

// Save whole-day attendance for a section+date. RLS (attendance_write) ensures
// the caller may only write for sections they are allotted. Delete-then-insert
// keeps one daily row per student (period is NULL for daily attendance).
export async function saveDailyAttendance(input: {
  sectionId: number;
  yearId: number;
  date: string;
  entries: { studentId: number; status: AttStatus }[];
}) {
  const supabase = await createClient();
  const session = await getSession();
  const studentIds = input.entries.map((e) => e.studentId);
  if (!studentIds.length) return { ok: true };

  await supabase
    .from("attendance_record")
    .delete()
    .eq("section_id", input.sectionId)
    .eq("on_date", input.date)
    .is("period", null)
    .in("student_id", studentIds);

  const rows = input.entries.map((e) => ({
    student_id: e.studentId,
    section_id: input.sectionId,
    academic_year_id: input.yearId,
    on_date: input.date,
    period: null,
    subject_id: null,
    status: e.status,
    marked_by: session?.staffId ?? null,
  }));
  const { error } = await supabase.from("attendance_record").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}
