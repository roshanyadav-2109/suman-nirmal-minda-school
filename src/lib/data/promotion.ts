import { createClient } from "@/lib/supabase/server";

export type PromClass = { id: number; name: string; level: number; students: number; promoted: number };
export type PromRow = {
  id: number; name: string; roll: number | null; sectionId: number; sectionName: string;
  status: string; outcome: string | null; toSectionId: number | null;
};
export type SectionOpt = { id: number; name: string };

// Classes in the source year with pupil counts + how many already promoted.
export async function getPromotableClasses(fromYear: number, toYear: number): Promise<PromClass[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("promotable_classes", { p_from_year: fromYear, p_to_year: toYear });
  return ((data ?? []) as Array<{ class_id: number; class_name: string; class_level: number; students: number; promoted: number }>)
    .map((r) => ({ id: r.class_id, name: r.class_name, level: r.class_level, students: Number(r.students), promoted: Number(r.promoted) }));
}

// One class's roster for the source year, with any existing decision.
export async function getPromotionRoster(fromYear: number, toYear: number, classId: number): Promise<PromRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("promotion_roster", { p_from_year: fromYear, p_to_year: toYear, p_class: classId });
  return ((data ?? []) as Array<{ student_id: number; full_name: string; roll_no: number; section_id: number; section_name: string; status: string; outcome: string | null; to_section_id: number | null }>)
    .map((r) => ({ id: r.student_id, name: r.full_name, roll: r.roll_no, sectionId: r.section_id, sectionName: r.section_name, status: r.status, outcome: r.outcome, toSectionId: r.to_section_id }));
}

// Sections of a class by LEVEL (used to list the target class's sections).
export async function getSectionsByLevel(level: number): Promise<{ level: number; className: string; sections: SectionOpt[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class")
    .select("name, level, section(id, name)")
    .eq("level", level)
    .maybeSingle();
  if (!data) return null;
  const sections = ((data.section ?? []) as Array<{ id: number; name: string }>)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { level: data.level, className: data.name, sections };
}

export type PromSummaryRow = {
  classId: number; className: string; level: number;
  promoted: number; retained: number; transferred: number; graduated: number; total: number;
};

// Per-class promotion summary for a target year (RLS-scoped by promotion_read).
export async function getPromotionSummary(toYear: number): Promise<PromSummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("promotion_summary", { p_to_year: toYear });
  return ((data ?? []) as Array<{ class_id: number; class_name: string; class_level: number; promoted: number; retained: number; transferred: number; graduated: number; total: number }>)
    .map((r) => ({ classId: r.class_id, className: r.class_name, level: r.class_level, promoted: Number(r.promoted), retained: Number(r.retained), transferred: Number(r.transferred), graduated: Number(r.graduated), total: Number(r.total) }));
}

// The two years for a promotion: the current year → the next chronological year.
export async function getPromotionYears() {
  const supabase = await createClient();
  const { data } = await supabase.from("academic_year").select("id, name, is_current, start_date").order("start_date", { ascending: true });
  const years = (data ?? []) as Array<{ id: number; name: string; is_current: boolean; start_date: string }>;
  const fromIdx = years.findIndex((y) => y.is_current);
  const from = fromIdx >= 0 ? years[fromIdx] : years[years.length - 1];
  const to = years.find((y) => y.start_date > (from?.start_date ?? "")) ?? null;
  return { from: from ?? null, to, all: years };
}
