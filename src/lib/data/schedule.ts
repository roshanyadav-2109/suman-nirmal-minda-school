import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Weekly timetable data (migration 0034). The generated database types do not
// know these tables yet, so queries go through an untyped client and every
// result is cast to the explicit row types below.

import { cellKey, type GridCells, type Named, type Period, type SlotRow } from "@/components/schedule/shared";
export { DAYS, cellKey } from "@/components/schedule/shared";
export type { GridCell, GridCells, Named, Period, SlotRow } from "@/components/schedule/shared";

type PgError = { code?: string; message?: string } | null;

// True when the error means migration 0034 has not been applied yet.
export function isMissingTable(error: PgError): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST200") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("timetable_") && (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"));
}

export async function untyped(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const hhmm = (t: string) => (t ?? "").slice(0, 5);

// The bell schedule. `missing` = the tables are not there yet.
export async function getPeriods(): Promise<{ missing: true } | { missing: false; periods: Period[] }> {
  const db = await untyped();
  const { data, error } = await db
    .from("timetable_period")
    .select("period_no, label, start_time, end_time, is_break")
    .order("period_no");
  if (error) {
    if (isMissingTable(error)) return { missing: true };
    throw new Error(error.message);
  }
  const periods = ((data ?? []) as Period[]).map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) }));
  return { missing: false, periods };
}

const SLOT_COLS = "id, section_id, day_of_week, period_no, subject_id, staff_id, room";

export async function getSectionSlots(sectionId: number, yearId: number): Promise<SlotRow[]> {
  const db = await untyped();
  const { data, error } = await db.from("timetable_slot").select(SLOT_COLS)
    .eq("section_id", sectionId).eq("academic_year_id", yearId);
  if (error) throw new Error(error.message);
  return (data ?? []) as SlotRow[];
}

export async function getStaffSlots(staffId: number, yearId: number): Promise<SlotRow[]> {
  const db = await untyped();
  const { data, error } = await db.from("timetable_slot").select(SLOT_COLS)
    .eq("staff_id", staffId).eq("academic_year_id", yearId);
  if (error) throw new Error(error.message);
  return (data ?? []) as SlotRow[];
}

// Name look-ups for whatever ids appear in a set of slots.
export async function getNames(opts: { subjectIds?: (number | null)[]; staffIds?: (number | null)[]; sectionIds?: (number | null)[] }) {
  const supabase = await createClient();
  const uniq = (a?: (number | null)[]) => [...new Set((a ?? []).filter((x): x is number => x != null))];
  const subIds = uniq(opts.subjectIds), staffIds = uniq(opts.staffIds), secIds = uniq(opts.sectionIds);
  const [subs, staff, secs] = await Promise.all([
    subIds.length ? supabase.from("subject").select("id, name").in("id", subIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    staffIds.length ? supabase.from("staff").select("id, full_name").in("id", staffIds) : Promise.resolve({ data: [] as { id: number; full_name: string }[] }),
    secIds.length ? supabase.from("section").select("id, name, class:class_id(name)").in("id", secIds) : Promise.resolve({ data: [] as { id: number; name: string; class: unknown }[] }),
  ]);
  const subject = new Map<number, string>((subs.data ?? []).map((s) => [s.id, s.name]));
  const staffName = new Map<number, string>((staff.data ?? []).map((s) => [s.id, s.full_name]));
  const section = new Map<number, string>((secs.data ?? []).map((s) => {
    const c = s.class as { name: string } | null;
    return [s.id, c ? `${c.name}-${s.name}` : s.name];
  }));
  return { subject, staffName, section };
}

// A section's week: each cell shows the subject and who takes it.
export async function sectionCells(slots: SlotRow[]): Promise<GridCells> {
  const names = await getNames({ subjectIds: slots.map((s) => s.subject_id), staffIds: slots.map((s) => s.staff_id) });
  const out: GridCells = {};
  for (const s of slots) {
    const title = s.subject_id ? names.subject.get(s.subject_id) ?? "Subject" : "Free period";
    const sub = s.staff_id ? names.staffName.get(s.staff_id) : undefined;
    out[cellKey(s.day_of_week, s.period_no)] = { title, sub, room: s.room, tint: s.subject_id ?? undefined };
  }
  return out;
}

// A teacher's week: each cell shows the class-section and the subject.
export async function teacherCells(slots: SlotRow[]): Promise<GridCells> {
  const names = await getNames({ subjectIds: slots.map((s) => s.subject_id), sectionIds: slots.map((s) => s.section_id) });
  const out: GridCells = {};
  for (const s of slots) {
    const k = cellKey(s.day_of_week, s.period_no);
    const title = names.section.get(s.section_id) ?? "Class";
    const sub = s.subject_id ? names.subject.get(s.subject_id) : undefined;
    // Two sections in the same period (a combined class) — show both.
    const prev = out[k];
    out[k] = prev
      ? { ...prev, title: `${prev.title}, ${title}` }
      : { title, sub, room: s.room, tint: s.subject_id ?? undefined };
  }
  return out;
}

// The current-year section of a student, with its label ("VIII-A").
export async function getStudentSection(studentId: number, yearId: number): Promise<{ id: number; label: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_enrollment")
    .select("section_id, section:section_id(name, class:class_id(name))")
    .eq("student_id", studentId)
    .eq("academic_year_id", yearId)
    .maybeSingle();
  if (!data?.section_id) return null;
  const sec = data.section as unknown as { name: string; class: { name: string } | null } | null;
  return { id: data.section_id, label: sec ? (sec.class ? `${sec.class.name}-${sec.name}` : sec.name) : "" };
}

// Everyone who can be put in front of a class (for the office pickers).
export async function getTeachingStaff(): Promise<Named[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, full_name, role")
    .in("role", ["subject_teacher", "class_teacher", "principal"])
    .order("full_name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.full_name }));
}

// Teachers allotted to a section this year, per subject. A class teacher with
// no subject row is listed under `classTeacher` (they may take any subject).
export async function getSectionAllotments(sectionId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teacher_allotment")
    .select("staff_id, subject_id, is_class_teacher, staff:staff_id(full_name)")
    .eq("section_id", sectionId)
    .eq("academic_year_id", yearId);
  const bySubject: Record<number, Named[]> = {};
  let classTeacher: Named | null = null;
  for (const a of data ?? []) {
    const name = (a.staff as unknown as { full_name: string } | null)?.full_name ?? "Teacher";
    const person = { id: a.staff_id, name };
    if (a.is_class_teacher) classTeacher = person;
    if (a.subject_id) {
      const list = (bySubject[a.subject_id] ??= []);
      if (!list.some((p) => p.id === person.id)) list.push(person);
    }
  }
  return { bySubject, classTeacher };
}

// Today's weekday in school time (India), 1 = Mon .. 7 = Sun.
export function schoolToday(): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(new Date());
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[wd] ?? 1;
}
