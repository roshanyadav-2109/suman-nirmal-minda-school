"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PromotionDecision = {
  student_id: number;
  outcome: "promoted" | "retained" | "transferred" | "graduated";
  to_section_id?: number | null;
  remark?: string;
};

// Apply a batch of promotion decisions for a class (office/admin only, enforced
// by the commit_promotion RPC). Creates next-year enrollments, marks TC/alumni,
// and records every outcome for the principal/class-teacher summary.
export async function commitPromotion(input: { fromYear: number; toYear: number; rows: PromotionDecision[] }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_promotion", {
    p_from_year: input.fromYear,
    p_to_year: input.toYear,
    p_rows: input.rows,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/promotion");
  revalidatePath("/students");
  return { ok: true as const, count: Number(data ?? 0) };
}

// Create a new academic session (office/admin only, enforced by RLS). Added as
// a non-current year so the office can then promote the cohort into it.
export async function createAcademicYear(input: { name: string; startDate: string; endDate: string }) {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name || !input.startDate || !input.endDate) return { ok: false as const, error: "All fields are required" };
  const { error } = await supabase.from("academic_year").insert({
    name, start_date: input.startDate, end_date: input.endDate, is_current: false,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/promotion");
  return { ok: true as const };
}
