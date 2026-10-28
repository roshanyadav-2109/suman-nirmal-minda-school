"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentYear, getSession } from "@/lib/session";
import { createClassExam } from "@/app/dashboard/marks/actions";

// Office-only exam management. One "exam" on this screen is every assessment
// row of the current year with the same name in the same class (one row per
// section per subject), so edits and deletes apply to all of them together.

export type ActionResult = { ok: true } | { ok: false; error: string };

async function officeOnly(): Promise<string | null> {
  const session = await getSession();
  if (session?.staffRole !== "office") return "Only the school office can make this change.";
  return null;
}

function refresh() {
  revalidatePath("/dashboard/manage/exams");
  revalidatePath("/dashboard/marks");
  revalidatePath("/dashboard/progress");
  revalidatePath("/dashboard/reports");
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

// All assessment rows of one exam (class + name) in the current year.
async function examRows(supabase: Awaited<ReturnType<typeof createClient>>, classId: number, name: string, yearId: number) {
  const { data: sections, error: secErr } = await supabase.from("section").select("id").eq("class_id", classId);
  if (secErr) return { error: secErr.message } as const;
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (!sectionIds.length) return { ids: [] as number[] } as const;
  const { data, error } = await supabase
    .from("assessment")
    .select("id")
    .eq("academic_year_id", yearId)
    .eq("name", name)
    .in("section_id", sectionIds);
  if (error) return { error: error.message } as const;
  return { ids: (data ?? []).map((a) => a.id) } as const;
}

// Create an exam for a whole class: one call of the existing createClassExam
// (create_class_exam RPC) per chosen subject, each fanning out to every section.
export async function createExam(input: {
  classId: number; name: string; term: number; max: number; date: string; subjectIds: number[];
}): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = input.name.trim();
  if (!input.classId) return { ok: false, error: "Please choose a class." };
  if (!name) return { ok: false, error: "Please type the exam name, for example “Periodic Test 1”." };
  if (input.term !== 1 && input.term !== 2) return { ok: false, error: "Please choose Term 1 or Term 2." };
  if (!Number.isFinite(input.max) || input.max < 1 || input.max > 100) return { ok: false, error: "Maximum marks must be between 1 and 100." };
  if (!isDate(input.date)) return { ok: false, error: "Please choose the exam date." };
  const subjectIds = [...new Set(input.subjectIds)].filter((id) => id > 0);
  if (!subjectIds.length) return { ok: false, error: "Please tick at least one subject." };
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };

  let created = 0;
  let skipped = 0;
  for (const subjectId of subjectIds) {
    const res = await createClassExam({ classId: input.classId, subjectId, name, term: input.term, max: input.max, date: input.date, yearId: year.id });
    if (!res.ok) {
      refresh();
      return { ok: false, error: created ? `Some subjects were created, then this failed: ${res.error}` : `Could not create the exam: ${res.error}` };
    }
    if (res.created) created += res.created; else skipped += 1;
  }
  refresh();
  return { ok: true, created, skipped };
}

export async function updateExam(input: {
  classId: number; oldName: string; name: string;
  /** null keeps each paper's own date / maximum (they may differ by subject). */
  date: string | null; max: number | null;
}): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Please type the exam name." };
  if (input.date !== null && !isDate(input.date)) return { ok: false, error: "Please choose the exam date." };
  if (input.max !== null && (!Number.isFinite(input.max) || input.max < 1 || input.max > 100)) {
    return { ok: false, error: "Maximum marks must be between 1 and 100." };
  }
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };
  const supabase = await createClient();

  const found = await examRows(supabase, input.classId, input.oldName, year.id);
  if ("error" in found) return { ok: false, error: `Could not find the exam: ${found.error}` };
  if (!found.ids.length) return { ok: false, error: "This exam could not be found. Please reload the page." };

  // A new name must not clash with another exam in the same class, or the two
  // would merge into one.
  if (name !== input.oldName) {
    const clash = await examRows(supabase, input.classId, name, year.id);
    if ("error" in clash) return { ok: false, error: `Could not check the name: ${clash.error}` };
    if (clash.ids.length) return { ok: false, error: `This class already has an exam called “${name}”. Please choose another name.` };
  }

  // Lowering the maximum below a mark already entered would make that mark impossible.
  if (input.max !== null) {
    const { count: over, error: overErr } = await supabase
      .from("mark")
      .select("id", { count: "exact", head: true })
      .in("assessment_id", found.ids)
      .gt("marks_obtained", input.max);
    if (overErr) return { ok: false, error: `Could not check the marks: ${overErr.message}` };
    if ((over ?? 0) > 0) {
      return { ok: false, error: `${over} ${over === 1 ? "student has" : "students have"} marks higher than ${input.max}. Correct those marks first, or keep the maximum higher.` };
    }
  }

  const patch: { name: string; assessed_on?: string; max_marks?: number } = { name };
  if (input.date !== null) patch.assessed_on = input.date;
  if (input.max !== null) patch.max_marks = input.max;
  const { error } = await supabase
    .from("assessment")
    .update(patch)
    .in("id", found.ids);
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  refresh();
  return { ok: true };
}

export async function deleteExam(input: { classId: number; name: string }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };
  const supabase = await createClient();

  const found = await examRows(supabase, input.classId, input.name, year.id);
  if ("error" in found) return { ok: false, error: `Could not find the exam: ${found.error}` };
  if (!found.ids.length) return { ok: false, error: "This exam was already deleted. Please reload the page." };

  const { count, error: countErr } = await supabase
    .from("mark")
    .select("id", { count: "exact", head: true })
    .in("assessment_id", found.ids);
  if (countErr) return { ok: false, error: `Could not check the marks: ${countErr.message}` };
  if ((count ?? 0) > 0) {
    return { ok: false, error: `Marks have already been entered for this exam (${count}), so it cannot be deleted. You can still rename it or change its date.` };
  }

  const { error } = await supabase.from("assessment").delete().in("id", found.ids);
  if (error) return { ok: false, error: `Could not delete: ${error.message}` };
  refresh();
  return { ok: true };
}
