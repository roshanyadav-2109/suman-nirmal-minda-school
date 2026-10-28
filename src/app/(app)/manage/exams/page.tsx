import { createClient } from "@/lib/supabase/server";
import { getCurrentYear } from "@/lib/session";
import { EmptyState } from "@/components/ui/empty";
import { ExamsAdmin, type ExamGroup, type ClassOpt } from "@/components/manage/exams/exams-admin";

type AssessRow = {
  id: number;
  name: string;
  term: number | null;
  assessed_on: string;
  max_marks: number;
  section_id: number;
  subject_id: number;
  mark: { count: number }[] | null;
};

// This year's assessment rows with how many marks each has. The API returns at
// most 1000 rows per request, so read them page by page.
async function loadAssessments(supabase: Awaited<ReturnType<typeof createClient>>, yearId: number) {
  const PAGE = 1000;
  const out: AssessRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("assessment")
      .select("id, name, term, assessed_on, max_marks, section_id, subject_id, mark(count)")
      .eq("academic_year_id", yearId)
      .order("id")
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as unknown as AssessRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// Manage School › Exams: this year's exams, grouped by class and exam name.
export default async function ManageExamsPage() {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return <EmptyState art="error" title="No current school year is set" hint="Ask the person who set up the portal to mark this year as current." />;

  const [classRes, sectionRes, subjectRes, csRes, assessments] = await Promise.all([
    supabase.from("class").select("id, name, level").order("level"),
    supabase.from("section").select("id, class_id, name").order("name"),
    supabase.from("subject").select("id, name").order("name"),
    supabase.from("class_subject").select("class_id, subject_id"),
    loadAssessments(supabase, year.id),
  ]);

  const classById = new Map((classRes.data ?? []).map((c) => [c.id, c]));
  const sectionById = new Map((sectionRes.data ?? []).map((s) => [s.id, s]));
  const subjectById = new Map((subjectRes.data ?? []).map((s) => [s.id, s]));
  const sectionsPerClass = new Map<number, number>();
  (sectionRes.data ?? []).forEach((s) => sectionsPerClass.set(s.class_id, (sectionsPerClass.get(s.class_id) ?? 0) + 1));

  // Group: one exam = same class + same name.
  type Acc = {
    classId: number; name: string; terms: Set<number>; dates: string[]; maxes: Set<number>;
    sections: Set<string>; subjects: Set<string>; papers: number; marks: number; papersWithMarks: number;
  };
  const groups = new Map<string, Acc>();
  for (const a of assessments) {
    const sec = sectionById.get(a.section_id);
    if (!sec) continue;
    const key = `${sec.class_id}::${a.name}`;
    let g = groups.get(key);
    if (!g) {
      g = { classId: sec.class_id, name: a.name, terms: new Set(), dates: [], maxes: new Set(), sections: new Set(), subjects: new Set(), papers: 0, marks: 0, papersWithMarks: 0 };
      groups.set(key, g);
    }
    if (a.term) g.terms.add(a.term);
    g.dates.push(a.assessed_on);
    g.maxes.add(Number(a.max_marks));
    g.sections.add(sec.name);
    g.subjects.add(subjectById.get(a.subject_id)?.name ?? "—");
    g.papers += 1;
    const n = a.mark?.[0]?.count ?? 0;
    g.marks += n;
    if (n > 0) g.papersWithMarks += 1;
  }

  const exams: ExamGroup[] = [...groups.entries()].map(([key, g]) => {
    const cls = classById.get(g.classId);
    const dates = [...g.dates].sort();
    return {
      key,
      classId: g.classId,
      className: cls?.name ?? "—",
      classLevel: cls?.level ?? 99,
      name: g.name,
      terms: [...g.terms].sort(),
      dateFrom: dates[0],
      dateTo: dates[dates.length - 1],
      maxMarks: [...g.maxes].sort((x, y) => x - y),
      sections: [...g.sections].sort(),
      sectionTotal: sectionsPerClass.get(g.classId) ?? g.sections.size,
      subjects: [...g.subjects].sort(),
      papers: g.papers,
      marks: g.marks,
      papersWithMarks: g.papersWithMarks,
    };
  }).sort((a, b) => a.classLevel - b.classLevel || a.dateFrom.localeCompare(b.dateFrom) || a.name.localeCompare(b.name));

  const classes: ClassOpt[] = (classRes.data ?? []).map((c) => {
    const ids = new Set((csRes.data ?? []).filter((p) => p.class_id === c.id).map((p) => p.subject_id));
    return {
      id: c.id,
      name: c.name,
      sectionCount: sectionsPerClass.get(c.id) ?? 0,
      subjects: (subjectRes.data ?? []).filter((s) => ids.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
    };
  });
  const allSubjects = (subjectRes.data ?? []).map((s) => ({ id: s.id, name: s.name }));

  return <ExamsAdmin yearName={year.name} exams={exams} classes={classes} allSubjects={allSubjects} />;
}
