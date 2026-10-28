"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";
import { getStaffScope } from "@/lib/data/scope";
import {
  checkStudentInput, parseDate, parseRoll, tidy,
  type ImportRow, type StudentInput,
} from "./rules";

// Every change to a student goes through here. The database's own rules
// (RLS) are the real lock; the checks below only turn its refusals into
// plain words before they happen.

export type Result = { ok: true } | { ok: false; error: string };
export type ImportResult = { ok: true; added: number; updated: number } | { ok: false; error: string };

type Supa = Awaited<ReturnType<typeof createClient>>;

const NOT_ALLOWED = "Only the school office can do this.";
const TRY_AGAIN = "Something went wrong while saving. Please try again.";

function refresh() {
  revalidatePath("/dashboard/manage/students");
  revalidatePath("/dashboard/students");
}

// `withPrincipal`: the principal may also edit a student's details (from the
// Students page); adding, removing and bulk upload stay with the office.
async function officeContext(withPrincipal = false) {
  const [session, year] = await Promise.all([getSession(), getCurrentYear()]);
  const allowed = session?.staffRole === "office" || (withPrincipal && session?.staffRole === "principal");
  if (!allowed) return { error: NOT_ALLOWED } as const;
  if (!year) return { error: "There is no current school year set up yet." } as const;
  return { yearId: year.id } as const;
}

const nullIfBlank = (s: string) => (tidy(s) ? tidy(s) : null);

// Saves (or creates) the student's primary parent and links them.
async function saveGuardian(supabase: Supa, studentId: number, g: StudentInput["guardian"]): Promise<string | null> {
  const fields = {
    full_name: tidy(g.fullName),
    relation: nullIfBlank(g.relation),
    phone: nullIfBlank(g.phone),
    email: nullIfBlank(g.email)?.toLowerCase() ?? null,
  };
  // A blank parent name never wipes out the parent already on file.
  if (!fields.full_name) return null;
  if (g.id) {
    const { data, error } = await supabase.from("guardian").update(fields).eq("id", g.id).select("id");
    if (error || !data?.length) return "The parent's details could not be saved.";
    return null;
  }
  const { data: created, error } = await supabase.from("guardian").insert(fields).select("id").single();
  if (error || !created) return "The parent could not be added.";
  const { error: linkErr } = await supabase
    .from("guardian_student")
    .insert({ guardian_id: created.id, student_id: studentId, is_primary: true });
  if (linkErr) {
    await supabase.from("guardian").delete().eq("id", created.id);
    return "The parent could not be added.";
  }
  return null;
}

// --- Office: add / edit ------------------------------------------------------

export async function saveStudent(input: StudentInput): Promise<Result> {
  // Editing an existing student is open to the principal too; adding one is not.
  const ctx = await officeContext(!!input.id);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const problem = checkStudentInput(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const dob = input.dob ? (parseDate(input.dob) as string) : null;
  const roll = input.rollNo ? (parseRoll(input.rollNo) as number) : null;
  const studentFields = {
    full_name: tidy(input.fullName),
    admission_no: tidy(input.admissionNo),
    dob,
    gender: input.gender || null,
    email: nullIfBlank(input.studentEmail)?.toLowerCase() ?? null,
    phone: nullIfBlank(input.studentPhone),
  };

  // Admission numbers are unique across the whole school, every year.
  const { data: clash } = await supabase
    .from("student").select("id, full_name").eq("admission_no", studentFields.admission_no);
  const other = (clash ?? []).find((s) => s.id !== input.id);
  if (other) return { ok: false, error: `Admission no ${studentFields.admission_no} is already given to ${other.full_name}.` };

  if (input.id) {
    const { data, error } = await supabase.from("student").update(studentFields).eq("id", input.id).select("id");
    if (error || !data?.length) return { ok: false, error: TRY_AGAIN };
    // Their class this year: move the existing enrollment, or enroll them.
    const { error: enrErr } = await supabase
      .from("student_enrollment")
      .upsert(
        { student_id: input.id, academic_year_id: ctx.yearId, section_id: input.sectionId!, roll_no: roll },
        { onConflict: "student_id,academic_year_id" },
      );
    if (enrErr) return { ok: false, error: "The details were saved, but the class could not be changed." };
    const gErr = await saveGuardian(supabase, input.id, input.guardian);
    if (gErr) return { ok: false, error: gErr };
    refresh();
    return { ok: true };
  }

  const { data: created, error } = await supabase.from("student").insert(studentFields).select("id").single();
  if (error || !created) {
    return { ok: false, error: error?.code === "23505" ? `Admission no ${studentFields.admission_no} is already used.` : TRY_AGAIN };
  }
  const { error: enrErr } = await supabase
    .from("student_enrollment")
    .insert({ student_id: created.id, academic_year_id: ctx.yearId, section_id: input.sectionId!, roll_no: roll });
  if (enrErr) {
    // Without a class the new record is half-made; take it back out.
    await supabase.from("student").delete().eq("id", created.id);
    return { ok: false, error: TRY_AGAIN };
  }
  const gErr = await saveGuardian(supabase, created.id, { ...input.guardian, id: null });
  refresh();
  if (gErr) return { ok: false, error: `The student was added, but ${gErr.charAt(0).toLowerCase()}${gErr.slice(1)} Open Edit to try again.` };
  return { ok: true };
}

// --- Office: left the school ---------------------------------------------------

// Marks this year's enrollment as transferred (history is kept), or undoes it.
export async function setStudentLeft(studentId: number, left: boolean): Promise<Result> {
  const ctx = await officeContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_enrollment")
    .update({ status: left ? "transferred" : "active" })
    .eq("student_id", studentId)
    .eq("academic_year_id", ctx.yearId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: TRY_AGAIN };
  // The student's own status matches what the promotion screen writes.
  await supabase
    .from("student")
    .update(left
      ? { status: "transferred", left_on: new Date().toISOString().slice(0, 10) }
      : { status: "active", left_on: null })
    .eq("id", studentId);
  refresh();
  return { ok: true };
}

// --- Office: bulk upload --------------------------------------------------------

// Which of these admission numbers are already in the school (so the preview
// can say "will update" instead of "new").
export async function findExistingAdmissionNos(admissionNos: string[]): Promise<string[]> {
  const ctx = await officeContext();
  if ("error" in ctx) return [];
  const list = [...new Set(admissionNos.map(tidy).filter(Boolean))].slice(0, 5000);
  if (!list.length) return [];
  const supabase = await createClient();
  const found: string[] = [];
  for (let i = 0; i < list.length; i += 300) {
    const { data } = await supabase.from("student").select("admission_no").in("admission_no", list.slice(i, i + 300));
    for (const r of data ?? []) found.push(r.admission_no);
  }
  return found;
}

const MAX_IMPORT = 2000;

// Adds or updates students by admission no. Blank cells never wipe out what is
// already saved: only filled-in columns are written for existing students.
export async function importStudents(rows: ImportRow[]): Promise<ImportResult> {
  const ctx = await officeContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: "There are no students to import." };
  if (rows.length > MAX_IMPORT) return { ok: false, error: `Please upload at most ${MAX_IMPORT} students at a time.` };

  const supabase = await createClient();
  const { data: secs } = await supabase.from("section").select("id");
  const validSections = new Set((secs ?? []).map((s) => s.id));

  // Check every row again here; the browser's preview is only a convenience.
  const seen = new Set<string>();
  for (const r of rows) {
    const adm = tidy(r.admissionNo);
    const bad =
      !tidy(r.fullName) || !adm || seen.has(adm.toUpperCase()) ||
      !r.sectionId || !validSections.has(r.sectionId) ||
      (r.dob !== null && parseDate(r.dob) === "bad") ||
      (r.gender !== null && !["male", "female", "other"].includes(r.gender)) ||
      (r.rollNo !== null && (!Number.isInteger(r.rollNo) || r.rollNo < 1 || r.rollNo > 9999)) ||
      (!!tidy(r.studentEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tidy(r.studentEmail)));
    if (bad) return { ok: false, error: `Line ${r.line} has a problem. Please fix the file and upload it again.` };
    seen.add(adm.toUpperCase());
  }

  const existing = new Set((await findExistingAdmissionNos(rows.map((r) => r.admissionNo))).map((a) => a.toUpperCase()));

  // 1. Students. Rows are grouped by which optional columns are filled in, so
  //    each upsert writes only those columns and leaves the rest alone.
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const rec: Record<string, unknown> = { admission_no: tidy(r.admissionNo), full_name: tidy(r.fullName) };
    if (r.dob) rec.dob = r.dob;
    if (r.gender) rec.gender = r.gender;
    if (tidy(r.studentEmail)) rec.email = tidy(r.studentEmail).toLowerCase();
    if (tidy(r.studentPhone)) rec.phone = tidy(r.studentPhone);
    const key = Object.keys(rec).join(",");
    groups.set(key, [...(groups.get(key) ?? []), rec]);
  }
  const idByAdm = new Map<string, number>();
  for (const recs of groups.values()) {
    for (let i = 0; i < recs.length; i += 500) {
      const { data, error } = await supabase
        .from("student")
        .upsert(recs.slice(i, i + 500) as never, { onConflict: "admission_no" })
        .select("id, admission_no");
      if (error) return { ok: false, error: `${TRY_AGAIN} (${idByAdm.size} students were saved before it stopped.)` };
      for (const s of (data ?? []) as { id: number; admission_no: string }[]) idByAdm.set(s.admission_no.toUpperCase(), s.id);
    }
  }

  // 2. This year's class and roll no.
  const withRoll: Record<string, unknown>[] = [];
  const withoutRoll: Record<string, unknown>[] = [];
  for (const r of rows) {
    const id = idByAdm.get(tidy(r.admissionNo).toUpperCase());
    if (!id) continue;
    const rec: Record<string, unknown> = { student_id: id, academic_year_id: ctx.yearId, section_id: r.sectionId };
    if (r.rollNo !== null) { rec.roll_no = r.rollNo; withRoll.push(rec); } else withoutRoll.push(rec);
  }
  for (const recs of [withRoll, withoutRoll]) {
    for (let i = 0; i < recs.length; i += 500) {
      const { error } = await supabase
        .from("student_enrollment")
        .upsert(recs.slice(i, i + 500) as never, { onConflict: "student_id,academic_year_id" });
      if (error) {
        refresh();
        return { ok: false, error: "The students were saved, but some could not be put in their class. Please upload the file again." };
      }
    }
  }

  // 3. Parents: update the student's existing parent, or add one.
  const parentRows = rows.filter((r) => tidy(r.parentName) && idByAdm.has(tidy(r.admissionNo).toUpperCase()));
  if (parentRows.length) {
    const ids = parentRows.map((r) => idByAdm.get(tidy(r.admissionNo).toUpperCase())!);
    const linkByStudent = new Map<number, number>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase
        .from("guardian_student")
        .select("guardian_id, student_id, is_primary")
        .in("student_id", ids.slice(i, i + 300))
        .order("is_primary", { ascending: false });
      for (const l of data ?? []) if (!linkByStudent.has(l.student_id)) linkByStudent.set(l.student_id, l.guardian_id);
    }
    let failed = 0;
    const jobs = parentRows.map((r) => async () => {
      const studentId = idByAdm.get(tidy(r.admissionNo).toUpperCase())!;
      const guardianId = linkByStudent.get(studentId);
      if (guardianId) {
        const patch: { full_name: string; relation?: string; phone?: string; email?: string } = { full_name: tidy(r.parentName) };
        if (tidy(r.relation)) patch.relation = tidy(r.relation);
        if (tidy(r.phone)) patch.phone = tidy(r.phone);
        if (tidy(r.email)) patch.email = tidy(r.email).toLowerCase();
        const { error } = await supabase.from("guardian").update(patch).eq("id", guardianId);
        if (error) failed++;
      } else {
        const err = await saveGuardian(supabase, studentId, {
          fullName: r.parentName, relation: r.relation, phone: r.phone, email: r.email,
        });
        if (err) failed++;
      }
    });
    // A few at a time: quick, without flooding the database.
    for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map((j) => j()));
    if (failed) {
      refresh();
      return { ok: false, error: `The students were saved, but ${failed} parent record${failed === 1 ? "" : "s"} could not be saved.` };
    }
  }

  refresh();
  let added = 0;
  for (const r of rows) if (!existing.has(tidy(r.admissionNo).toUpperCase())) added++;
  return { ok: true, added, updated: rows.length - added };
}

// --- Class teacher (and office) from the Students page --------------------------

// A class teacher may change name, date of birth, gender, roll no, the
// student's email and the parent's contact for students in their own class this year. Not the class
// and not the admission no.
export async function updateStudentDetails(input: StudentInput): Promise<Result> {
  const [session, year, scope] = await Promise.all([getSession(), getCurrentYear(), getStaffScope()]);
  if (!session?.staffId || !year || !input.id) return { ok: false, error: "You can't change this student's details." };
  const problem = checkStudentInput(input, true);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { data: enr } = await supabase
    .from("student_enrollment")
    .select("id, section_id")
    .eq("student_id", input.id)
    .eq("academic_year_id", year.id)
    .maybeSingle();
  const isOffice = session.staffRole === "office" || session.staffRole === "principal";
  const ownClass = !!enr && scope.sectionMeta.some((m) => m.id === enr.section_id && m.isClassTeacher);
  if (!enr || (!isOffice && !ownClass)) {
    return { ok: false, error: "You can only change details of students in your own class." };
  }

  const blocked = "Your changes could not be saved. Please ask the school office to update these details.";
  const { data: s, error } = await supabase
    .from("student")
    .update({
      full_name: tidy(input.fullName),
      dob: input.dob ? (parseDate(input.dob) as string) : null,
      gender: input.gender || null,
      email: nullIfBlank(input.studentEmail)?.toLowerCase() ?? null,
      phone: nullIfBlank(input.studentPhone),
    })
    .eq("id", input.id)
    .select("id");
  if (error || !s?.length) return { ok: false, error: blocked };

  const roll = input.rollNo ? (parseRoll(input.rollNo) as number) : null;
  const { data: e, error: eErr } = await supabase
    .from("student_enrollment").update({ roll_no: roll }).eq("id", enr.id).select("id");
  if (eErr || !e?.length) return { ok: false, error: "The details were saved, but the roll no could not be changed." };

  const g = input.guardian;
  if (g.id) {
    const gErr = await saveGuardian(supabase, input.id, g);
    if (gErr) return { ok: false, error: gErr };
  } else if (tidy(g.fullName)) {
    // Adding a brand-new parent record is the office's job.
    if (!isOffice) return { ok: false, error: "The details were saved. This student has no parent on record yet — please ask the school office to add one." };
    const gErr = await saveGuardian(supabase, input.id, g);
    if (gErr) return { ok: false, error: gErr };
  }
  refresh();
  return { ok: true };
}
