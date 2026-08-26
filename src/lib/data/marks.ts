import { createClient } from "@/lib/supabase/server";

export type AssessmentOpt = { id: number; name: string; max_marks: number; assessed_on: string; type_code: string; is_published: boolean };

export async function getAssessments(sectionId: number, subjectId: number, yearId: number): Promise<AssessmentOpt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment")
    .select("id, name, max_marks, assessed_on, is_published, assessment_type:assessment_type_id(code)")
    .eq("section_id", sectionId)
    .eq("subject_id", subjectId)
    .eq("academic_year_id", yearId)
    .order("assessed_on", { ascending: true });
  return (data ?? []).map((a) => ({
    id: a.id, name: a.name, max_marks: Number(a.max_marks), assessed_on: a.assessed_on,
    is_published: !!a.is_published,
    type_code: (a.assessment_type as unknown as { code: string } | null)?.code ?? "",
  }));
}

export async function getAssessmentMarks(assessmentId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mark")
    .select("student_id, marks_obtained, is_absent")
    .eq("assessment_id", assessmentId);
  const map = new Map<number, { marks: number | null; absent: boolean }>();
  for (const r of data ?? []) map.set(r.student_id, { marks: r.marks_obtained == null ? null : Number(r.marks_obtained), absent: r.is_absent });
  return map;
}
