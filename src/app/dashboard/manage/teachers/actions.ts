"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentYear, getSession } from "@/lib/session";
import type { StaffRole } from "@/lib/session";

// Office-only changes to the staff list and to who teaches what. The database's
// own rules (RLS) also refuse these from anyone but office/principal.

export type ActionResult = { ok: true } | { ok: false; error: string };

const ROLES: StaffRole[] = ["subject_teacher", "class_teacher", "principal", "office", "transport"];

async function officeOnly(): Promise<string | null> {
  const session = await getSession();
  if (session?.staffRole !== "office") return "Only the school office can make this change.";
  return null;
}

function refresh() {
  revalidatePath("/dashboard/manage/teachers");
  revalidatePath("/dashboard/allotments");
  revalidatePath("/dashboard/marks");
  revalidatePath("/dashboard/attendance");
}

function plainError(error: { code?: string; message: string }, duplicate: string): string {
  if (error.code === "23505") return duplicate;
  if (error.code === "42501") return "You are not allowed to make this change.";
  return `Could not save: ${error.message}`;
}

// ---------------------------------------------------------------------------
// Staff list
// ---------------------------------------------------------------------------
export type StaffInput = {
  fullName: string;
  role: StaffRole;
  employeeCode: string;
  email: string;
  phone: string;
};

function cleanStaff(input: StaffInput) {
  const fullName = input.fullName.trim();
  if (!fullName) return { error: "Please type the person's full name." } as const;
  if (!ROLES.includes(input.role)) return { error: "Please choose a role." } as const;
  const email = input.email.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "That email address does not look right." } as const;
  return {
    row: {
      full_name: fullName,
      role: input.role,
      employee_code: input.employeeCode.trim() || null,
      email: email || null,
      phone: input.phone.trim() || null,
    },
  } as const;
}

export async function addStaff(input: StaffInput): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const clean = cleanStaff(input);
  if ("error" in clean) return { ok: false, error: clean.error as string };
  const supabase = await createClient();
  const { error } = await supabase.from("staff").insert(clean.row);
  if (error) return { ok: false, error: plainError(error, "Another staff member already has this employee code.") };
  refresh();
  return { ok: true };
}

export async function updateStaff(id: number, input: StaffInput): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const clean = cleanStaff(input);
  if ("error" in clean) return { ok: false, error: clean.error as string };
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff").update(clean.row).eq("id", id).select("id");
  if (error) return { ok: false, error: plainError(error, "Another staff member already has this employee code.") };
  if (!data?.length) return { ok: false, error: "This staff member could not be found. Please reload the page." };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assignments (teacher_allotment) for the current academic year
// ---------------------------------------------------------------------------
export async function addAssignment(input: { staffId: number; sectionId: number; subjectId: number }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  if (!input.staffId) return { ok: false, error: "Please choose a teacher." };
  if (!input.sectionId) return { ok: false, error: "Please choose a section." };
  if (!input.subjectId) return { ok: false, error: "Please choose a subject." };
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("teacher_allotment")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", input.staffId).eq("section_id", input.sectionId)
    .eq("subject_id", input.subjectId).eq("academic_year_id", year.id);
  if ((count ?? 0) > 0) return { ok: false, error: "This teacher already teaches this subject in this section." };

  const { error } = await supabase.from("teacher_allotment").insert({
    staff_id: input.staffId,
    section_id: input.sectionId,
    subject_id: input.subjectId,
    academic_year_id: year.id,
    is_class_teacher: false,
  });
  if (error) return { ok: false, error: plainError(error, "This teacher already teaches this subject in this section.") };
  refresh();
  return { ok: true };
}

export async function removeAssignment(id: number): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("teacher_allotment")
    .select("id, is_class_teacher, subject_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "This assignment was already removed. Please reload the page." };

  // A class-teacher row that also carries a subject: drop only the subject so
  // the teacher stays class teacher of the section.
  const { error } = row.is_class_teacher && row.subject_id !== null
    ? await supabase.from("teacher_allotment").update({ subject_id: null }).eq("id", id)
    : await supabase.from("teacher_allotment").delete().eq("id", id);
  if (error) return { ok: false, error: plainError(error, "Could not remove this assignment.") };
  refresh();
  return { ok: true };
}

type CtRow = { id: number; staff_id: number; subject_id: number | null };

// Take the class-teacher badge off whoever holds it in a section this year.
// A bare class-teacher row is deleted; a row that also teaches a subject keeps
// the subject and just stops being the class-teacher row.
async function clearClassTeacher(supabase: Awaited<ReturnType<typeof createClient>>, rows: CtRow[]) {
  for (const r of rows) {
    const { error } = r.subject_id === null
      ? await supabase.from("teacher_allotment").delete().eq("id", r.id)
      : await supabase.from("teacher_allotment").update({ is_class_teacher: false }).eq("id", r.id);
    if (error) return error;
  }
  return null;
}

export async function setClassTeacher(input: { sectionId: number; staffId: number }): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  if (!input.staffId) return { ok: false, error: "Please choose a teacher." };
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("teacher_allotment")
    .select("id, staff_id, subject_id")
    .eq("section_id", input.sectionId).eq("academic_year_id", year.id).eq("is_class_teacher", true);
  if (readErr) return { ok: false, error: plainError(readErr, "") };
  const previous = (current ?? []) as CtRow[];
  if (previous.length === 1 && previous[0].staff_id === input.staffId) return { ok: true };

  // One class teacher per section per year: clear the old one first.
  const clearErr = await clearClassTeacher(supabase, previous);
  if (clearErr) return { ok: false, error: plainError(clearErr, "") };

  const { data: own } = await supabase
    .from("teacher_allotment")
    .select("id")
    .eq("section_id", input.sectionId).eq("academic_year_id", year.id)
    .eq("staff_id", input.staffId).is("subject_id", null)
    .limit(1).maybeSingle();
  const { error } = own
    ? await supabase.from("teacher_allotment").update({ is_class_teacher: true }).eq("id", own.id)
    : await supabase.from("teacher_allotment").insert({
        staff_id: input.staffId, section_id: input.sectionId, subject_id: null,
        academic_year_id: year.id, is_class_teacher: true,
      });

  if (error) {
    // Put the previous class teacher back so the section is not left without one.
    for (const r of previous) {
      if (r.subject_id === null) {
        await supabase.from("teacher_allotment").insert({
          staff_id: r.staff_id, section_id: input.sectionId, subject_id: null,
          academic_year_id: year.id, is_class_teacher: true,
        });
      } else {
        await supabase.from("teacher_allotment").update({ is_class_teacher: true }).eq("id", r.id);
      }
    }
    return { ok: false, error: plainError(error, "This section already has a class teacher. Please reload the page.") };
  }
  refresh();
  return { ok: true };
}

export async function removeClassTeacher(sectionId: number): Promise<ActionResult> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const year = await getCurrentYear();
  if (!year) return { ok: false, error: "No current school year is set." };
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("teacher_allotment")
    .select("id, staff_id, subject_id")
    .eq("section_id", sectionId).eq("academic_year_id", year.id).eq("is_class_teacher", true);
  if (readErr) return { ok: false, error: plainError(readErr, "") };
  const err = await clearClassTeacher(supabase, (current ?? []) as CtRow[]);
  if (err) return { ok: false, error: plainError(err, "") };
  refresh();
  return { ok: true };
}
