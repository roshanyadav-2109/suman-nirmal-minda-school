"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";

export async function sendFeedback(input: { studentId: number; subject: string; body: string }) {
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

  const { error } = await supabase.from("feedback").insert({
    student_id: input.studentId,
    section_id: enr.section_id,
    from_profile: session.userId,
    subject: input.subject,
    body: input.body,
    status: "new",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feedback");
  return { ok: true };
}

export async function respondFeedback(id: number, response: string) {
  const supabase = await createClient();
  const session = await getSession();
  const { error } = await supabase
    .from("feedback")
    .update({ response, status: "responded", responded_by: session?.staffId ?? null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feedback");
  return { ok: true };
}
