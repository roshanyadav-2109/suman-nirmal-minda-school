"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentYear, getSession } from "@/lib/session";
import type { Database } from "@/lib/database.types";

// Office-only changes to classes, sections, subjects and which subjects each
// class studies. RLS also refuses these from anyone but office/principal.

export type ActionResult = { ok: true } | { ok: false; error: string };
type Stage = Database["public"]["Enums"]["nep_stage"];
const STAGES: Stage[] = ["foundational", "preparatory", "middle", "senior"];

async function officeOnly(): Promise<string | null> {
  const session = await getSession();
  if (session?.staffRole !== "office") return "Only the school office can make this change.";
  return null;
}

function refresh() {
  revalidatePath("/manage/classes");
  revalidatePath("/manage/teachers");
  revalidatePath("/manage/exams");
  revalidatePath("/manage/students");
  revalidatePath("/allotments");
  revalidatePath("/marks");
  revalidatePath("/attendance");
}

function plainError(error: { code?: string; message: string }, duplicate: string): string {
  if (error.code === "23505") return duplicate;
  if (error.code === "42501") return "You are not allowed to make this change.";
  return `Could not save: ${error.message}`;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export async function addClass(input: { name: string; level: number; stage: Stage }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Please type the class name, for example “VI”." };
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 12) return { ok: false, error: "Level must be a number from 1 to 12." };
  if (!STAGES.includes(input.stage)) return { ok: false, error: "Please choose a stage." };
  const supabase = await createClient();
  const { error } = await supabase.from("class").insert({ name, level: input.level, stage: input.stage });
  if (error) return { ok: false, error: plainError(error, "A class with this name or level already exists.") };
  refresh();
  return { ok: true };
}

export async function updateClass(id: number, input: { name: string; stage: Stage }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Please type the class name." };
  if (!STAGES.includes(input.stage)) return { ok: false, error: "Please choose a stage." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("class").update({ name, stage: input.stage }).eq("id", id).select("id");
  if (error) return { ok: false, error: plainError(error, "Another class already has this name.") };
  if (!data?.length) return { ok: false, error: "This class could not be found. Please reload the page." };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export async function addSection(classId: number, rawName: string): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Please type the section name, for example “E” or “Sci-A”." };
  const supabase = await createClient();
  const { error } = await supabase.from("section").insert({ class_id: classId, name });
  if (error) return { ok: false, error: plainError(error, `This class already has a section called “${name}”.`) };
  refresh();
  return { ok: true };
}

export async function renameSection(id: number, rawName: string): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Please type the section name." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("section").update({ name }).eq("id", id).select("id");
  if (error) return { ok: false, error: plainError(error, `This class already has a section called “${name}”.`) };
  if (!data?.length) return { ok: false, error: "This section could not be found. Please reload the page." };
  refresh();
  return { ok: true };
}

// Deleting a section also deletes (in the database) everything hanging off it:
// enrolments, attendance, exams and their marks, teacher assignments. So it is
// allowed only for a section that holds no pupils' records at all.
export async function deleteSection(id: number): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const year = await getCurrentYear();
  const supabase = await createClient();

  const [thisYear, anyYear, attendance, exams] = await Promise.all([
    year
      ? supabase.from("student_enrollment").select("id", { count: "exact", head: true }).eq("section_id", id).eq("academic_year_id", year.id)
      : Promise.resolve({ count: 0, error: null }),
    supabase.from("student_enrollment").select("id", { count: "exact", head: true }).eq("section_id", id),
    supabase.from("attendance_record").select("id", { count: "exact", head: true }).eq("section_id", id),
    supabase.from("assessment").select("id").eq("section_id", id),
  ]);
  if (thisYear.error || anyYear.error || attendance.error || exams.error) {
    return { ok: false, error: "Could not check this section. Please try again." };
  }
  const nowCount = thisYear.count ?? 0;
  if (nowCount > 0) {
    return { ok: false, error: `${nowCount} ${nowCount === 1 ? "student is" : "students are"} in this section this year. Move them to another section first, then delete it.` };
  }
  if ((anyYear.count ?? 0) > 0) {
    return { ok: false, error: "This section has students’ records from earlier years. Deleting it would erase them, so it cannot be deleted." };
  }
  if ((attendance.count ?? 0) > 0) {
    return { ok: false, error: "Attendance has been taken in this section, so it cannot be deleted." };
  }
  const examIds = (exams.data ?? []).map((a) => a.id);
  if (examIds.length) {
    const { count, error } = await supabase.from("mark").select("id", { count: "exact", head: true }).in("assessment_id", examIds);
    if (error) return { ok: false, error: "Could not check this section. Please try again." };
    if ((count ?? 0) > 0) return { ok: false, error: "Marks have been entered for this section, so it cannot be deleted." };
  }

  const { data, error } = await supabase.from("section").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: plainError(error, "") };
  if (!data?.length) return { ok: false, error: "This section could not be deleted. Please reload the page." };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
function cleanSubject(input: { name: string; code: string }) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  if (!name) return { error: "Please type the subject name." };
  if (!code) return { error: "Please type a short code for the subject, for example “MATH”." };
  return { name, code };
}

export async function addSubject(input: { name: string; code: string }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const clean = cleanSubject(input);
  if ("error" in clean) return { ok: false, error: clean.error! };
  const supabase = await createClient();
  const { error } = await supabase.from("subject").insert({ name: clean.name, code: clean.code });
  if (error) return { ok: false, error: plainError(error, `Another subject already uses the code “${clean.code}”.`) };
  refresh();
  return { ok: true };
}

export async function updateSubject(id: number, input: { name: string; code: string }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const clean = cleanSubject(input);
  if ("error" in clean) return { ok: false, error: clean.error! };
  const supabase = await createClient();
  const { data, error } = await supabase.from("subject").update({ name: clean.name, code: clean.code }).eq("id", id).select("id");
  if (error) return { ok: false, error: plainError(error, `Another subject already uses the code “${clean.code}”.`) };
  if (!data?.length) return { ok: false, error: "This subject could not be found. Please reload the page." };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Which subjects each class studies
// ---------------------------------------------------------------------------
type Pair = { classId: number; subjectId: number };

export async function saveClassSubjects(input: { add: Pair[]; remove: Pair[] }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  if (!input.add.length && !input.remove.length) return { ok: true };
  const supabase = await createClient();

  if (input.add.length) {
    const { error } = await supabase
      .from("class_subject")
      .upsert(input.add.map((p) => ({ class_id: p.classId, subject_id: p.subjectId })), { onConflict: "class_id,subject_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: plainError(error, "") };
  }

  // Group removals by class so it is one request per class, not per tick.
  const byClass = new Map<number, number[]>();
  input.remove.forEach((p) => byClass.set(p.classId, [...(byClass.get(p.classId) ?? []), p.subjectId]));
  for (const [classId, subjectIds] of byClass) {
    const { error } = await supabase.from("class_subject").delete().eq("class_id", classId).in("subject_id", subjectIds);
    if (error) return { ok: false, error: plainError(error, "") };
  }
  refresh();
  return { ok: true };
}
