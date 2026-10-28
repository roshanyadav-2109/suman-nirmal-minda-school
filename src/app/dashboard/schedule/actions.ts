"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { untyped, isMissingTable, getNames, DAYS, type SlotRow } from "@/lib/data/schedule";

type Result = { ok: true } | { ok: false; error: string };

const NOT_READY = "The timetable isn't set up yet. Please ask the main developer to finish the setup.";

async function officeOnly(): Promise<string | null> {
  const s = await getSession();
  if (!s || !s.isAdminScope) return "Only the office can change the timetable.";
  return null;
}

export type CellInput = { day: number; period: number; subjectId: number | null; staffId: number | null; room: string | null };

// Save a section's week: upsert filled cells, delete cleared ones. Refuses if a
// teacher would be in two different classes in the same period.
export async function saveTimetable(input: {
  sectionId: number;
  yearId: number;
  upserts: CellInput[];
  deletes: { day: number; period: number }[];
}): Promise<Result> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const db = await untyped();
  const { sectionId, yearId } = input;

  const valid = (d: number, p: number) => Number.isInteger(d) && d >= 1 && d <= 6 && Number.isInteger(p) && p >= 1;
  if (![...input.upserts, ...input.deletes].every((c) => valid(c.day, c.period))) {
    return { ok: false, error: "Some cells were not valid. Please reload the page and try again." };
  }

  // Clash check: same teacher, same day and period, another section.
  const staffIds = [...new Set(input.upserts.map((c) => c.staffId).filter((x): x is number => x != null))];
  if (staffIds.length) {
    const { data, error } = await db.from("timetable_slot")
      .select("section_id, day_of_week, period_no, staff_id")
      .eq("academic_year_id", yearId).neq("section_id", sectionId).in("staff_id", staffIds);
    if (error) return { ok: false, error: isMissingTable(error) ? NOT_READY : "Could not check for clashes. Please try again." };
    const busy = new Map<string, number>();
    for (const r of (data ?? []) as Pick<SlotRow, "section_id" | "day_of_week" | "period_no" | "staff_id">[]) {
      busy.set(`${r.staff_id}-${r.day_of_week}-${r.period_no}`, r.section_id);
    }
    for (const c of input.upserts) {
      if (c.staffId == null) continue;
      const other = busy.get(`${c.staffId}-${c.day}-${c.period}`);
      if (other != null) {
        const names = await getNames({ staffIds: [c.staffId], sectionIds: [other] });
        const day = DAYS.find((d) => d.n === c.day)?.long ?? "that day";
        return {
          ok: false,
          error: `${names.staffName.get(c.staffId) ?? "This teacher"} already has ${names.section.get(other) ?? "another class"} on ${day} in period ${c.period}. Please pick another teacher or period.`,
        };
      }
    }
  }

  if (input.upserts.length) {
    const rows = input.upserts.map((c) => ({
      academic_year_id: yearId,
      section_id: sectionId,
      day_of_week: c.day,
      period_no: c.period,
      subject_id: c.subjectId,
      staff_id: c.staffId,
      room: c.room?.trim() ? c.room.trim().slice(0, 40) : null,
    }));
    const { error } = await db.from("timetable_slot")
      .upsert(rows, { onConflict: "academic_year_id,section_id,day_of_week,period_no" });
    if (error) return { ok: false, error: isMissingTable(error) ? NOT_READY : "Could not save the timetable. Please try again." };
  }

  for (const d of input.deletes) {
    const { error } = await db.from("timetable_slot").delete()
      .eq("academic_year_id", yearId).eq("section_id", sectionId)
      .eq("day_of_week", d.day).eq("period_no", d.period);
    if (error) return { ok: false, error: "Some cleared periods could not be removed. Please try again." };
  }

  revalidatePath("/dashboard/schedule");
  return { ok: true };
}

// Read another section's week, so the office can copy it as a starting point.
export async function loadSectionForCopy(input: { sectionId: number; yearId: number }):
  Promise<{ ok: true; slots: SlotRow[] } | { ok: false; error: string }> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  const db = await untyped();
  const { data, error } = await db.from("timetable_slot")
    .select("id, section_id, day_of_week, period_no, subject_id, staff_id, room")
    .eq("academic_year_id", input.yearId).eq("section_id", input.sectionId);
  if (error) return { ok: false, error: isMissingTable(error) ? NOT_READY : "Could not load that class's timetable." };
  return { ok: true, slots: (data ?? []) as SlotRow[] };
}

export type PeriodInput = { periodNo: number; label: string; start: string; end: string; isBreak: boolean };

// Save the bell schedule. Periods left out of the list are removed (which also
// clears them from every class's timetable).
export async function saveBellSchedule(rows: PeriodInput[]): Promise<Result> {
  const denied = await officeOnly();
  if (denied) return { ok: false, error: denied };
  if (!rows.length) return { ok: false, error: "Please keep at least one period." };

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const seen = new Set<number>();
  for (const r of rows) {
    if (!Number.isInteger(r.periodNo) || r.periodNo < 1 || r.periodNo > 20) return { ok: false, error: "Period numbers must be between 1 and 20." };
    if (seen.has(r.periodNo)) return { ok: false, error: `Period number ${r.periodNo} is used twice.` };
    seen.add(r.periodNo);
    if (!r.label.trim()) return { ok: false, error: `Please give row ${r.periodNo} a name, like "Period 1" or "Lunch".` };
    if (!timeRe.test(r.start) || !timeRe.test(r.end)) return { ok: false, error: `Please enter both times for "${r.label.trim()}".` };
    if (r.end <= r.start) return { ok: false, error: `"${r.label.trim()}" must end after it starts.` };
  }

  const db = await untyped();
  const { data: existing, error: readErr } = await db.from("timetable_period").select("period_no");
  if (readErr) return { ok: false, error: isMissingTable(readErr) ? NOT_READY : "Could not load the bell schedule." };

  const { error } = await db.from("timetable_period").upsert(
    rows.map((r) => ({ period_no: r.periodNo, label: r.label.trim().slice(0, 40), start_time: r.start, end_time: r.end, is_break: r.isBreak })),
    { onConflict: "period_no" },
  );
  if (error) return { ok: false, error: "Could not save the bell schedule. Please try again." };

  const removed = ((existing ?? []) as { period_no: number }[]).map((p) => p.period_no).filter((n) => !seen.has(n));
  if (removed.length) {
    const { error: delErr } = await db.from("timetable_period").delete().in("period_no", removed);
    if (delErr) return { ok: false, error: "The times were saved, but removed periods could not be deleted." };
  }

  revalidatePath("/dashboard/schedule");
  return { ok: true };
}
