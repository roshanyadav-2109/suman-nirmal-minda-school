import { createClient } from "@/lib/supabase/server";
import { getCurrentYear } from "@/lib/session";
import { ClassesAdmin, type ClassRow } from "@/components/manage/classes/classes-admin";
import { SubjectsAdmin, type SubjectRow } from "@/components/manage/classes/subjects-admin";
import { ClassSubjectGrid } from "@/components/manage/classes/class-subject-grid";

// How many pupils sit in each section this year. The API returns at most 1000
// rows per request, so read the year's enrolments page by page.
async function countPupils(supabase: Awaited<ReturnType<typeof createClient>>, yearId: number) {
  const PAGE = 1000;
  const counts = new Map<number, number>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("student_enrollment")
      .select("id, section_id")
      .eq("academic_year_id", yearId)
      .order("id")
      .range(from, from + PAGE - 1);
    (data ?? []).forEach((e) => counts.set(e.section_id, (counts.get(e.section_id) ?? 0) + 1));
    if (!data || data.length < PAGE) break;
  }
  return counts;
}

// Manage School › Classes & Subjects.
export default async function ManageClassesPage() {
  const supabase = await createClient();
  const year = await getCurrentYear();

  const [classRes, sectionRes, subjectRes, csRes, pupils] = await Promise.all([
    supabase.from("class").select("id, name, level, stage").order("level"),
    supabase.from("section").select("id, class_id, name").order("name"),
    supabase.from("subject").select("id, name, code").order("name"),
    supabase.from("class_subject").select("class_id, subject_id"),
    year ? countPupils(supabase, year.id) : Promise.resolve(new Map<number, number>()),
  ]);

  const classes: ClassRow[] = (classRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    stage: c.stage,
    sections: (sectionRes.data ?? [])
      .filter((s) => s.class_id === c.id)
      .map((s) => ({ id: s.id, name: s.name, pupils: pupils.get(s.id) ?? 0 })),
  }));
  const subjects: SubjectRow[] = (subjectRes.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }));
  const pairs = (csRes.data ?? []).map((p) => `${p.class_id}:${p.subject_id}`).sort();

  return (
    <div className="space-y-6">
      <ClassesAdmin classes={classes} yearName={year?.name ?? null} />
      <SubjectsAdmin subjects={subjects} />
      <ClassSubjectGrid
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        subjects={subjects}
        pairs={pairs}
      />
    </div>
  );
}
