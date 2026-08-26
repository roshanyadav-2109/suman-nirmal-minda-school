"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";

export async function applyLeave(input: { studentId: number; fromDate: string; toDate: string; reason: string }) {
  const supabase = await createClient();
  const session = await getSession();
  const year = await getCurrentYear();
  if (!session || !year) return { ok: false, error: "Not permitted" };

  const { data: enr } = await supabase
    .from("student_enrollment")
    .select("section_id")
    .eq("student_id", input.studentId)
    .eq("academic_year_id", year.id)
    .single();
  if (!enr) return { ok: false, error: "Student not enrolled this year" };

  const { error } = await supabase.from("leave_application").insert({
    student_id: input.studentId,
    section_id: enr.section_id,
    academic_year_id: year.id,
    applied_by: session.userId,
    from_date: input.fromDate,
    to_date: input.toDate,
    reason: input.reason,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leave");
  return { ok: true };
}

// Student/guardian supplies the reason for an auto-created absence notice.
export async function explainAbsence(id: number, reason: string) {
  const supabase = await createClient();
  const session = await getSession();
  const { error } = await supabase
    .from("absence_notice")
    .update({ reason, status: "explained", explained_by: session?.userId ?? null, explained_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leave");
  return { ok: true };
}

// Apply the same reason to several absent days at once.
export async function explainAbsences(ids: number[], reason: string) {
  if (!ids.length) return { ok: true };
  const supabase = await createClient();
  const session = await getSession();
  const { error } = await supabase
    .from("absence_notice")
    .update({ reason, status: "explained", explained_by: session?.userId ?? null, explained_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leave");
  return { ok: true };
}

export async function decideLeave(id: number, status: "approved" | "rejected", note?: string) {
  const supabase = await createClient();
  const session = await getSession();
  const { error } = await supabase
    .from("leave_application")
    .update({ status, decided_by: session?.staffId ?? null, decided_at: new Date().toISOString(), decision_note: note ?? null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leave");
  return { ok: true };
}
