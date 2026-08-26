import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

export type YearOpt = { id: number; name: string; is_current: boolean };
export type SectionOpt = { id: number; name: string; class_id: number; class_name: string; class_level: number };
export type SubjectOpt = { id: number; name: string; code: string };
export type ClassOpt = { id: number; name: string; level: number };

// Per-section access for a teacher: their own class (full, all subjects) vs
// sections where they only teach a subject.
export type SectionMeta = {
  id: number;
  classId: number;
  label: string;        // "VIII-A"
  className: string;
  classLevel: number;
  sectionName: string;
  isClassTeacher: boolean;   // full access to this section
  subjects: SubjectOpt[];    // subjects the teacher may act on here
};

export type StaffScope = {
  isAdmin: boolean;
  years: YearOpt[];
  currentYearId: number | null;
  classes: ClassOpt[];
  sections: SectionOpt[];
  subjects: SubjectOpt[];
  classSectionId: number | null;   // the teacher's own class-teacher section
  sectionMeta: SectionMeta[];       // full/subject split per section
  subjectsByClass: Record<number, SubjectOpt[]>; // subjects offered per class
};

// Filter options limited to the caller's allotment (brief §2.3). Principal/office
// see everything; a teacher sees only sections/subjects they are allotted.
export async function getStaffScope(): Promise<StaffScope> {
  const supabase = await createClient();
  const session = await getSession();

  const { data: years } = await supabase
    .from("academic_year")
    .select("id, name, is_current")
    .order("start_date", { ascending: false });
  const yearList = (years ?? []) as YearOpt[];
  const currentYearId = yearList.find((y) => y.is_current)?.id ?? yearList[0]?.id ?? null;

  const isAdmin = !!session?.isAdminScope;

  const { data: allSubs } = await supabase.from("subject").select("id, name, code").order("name");
  const allSubjects = (allSubs ?? []) as SubjectOpt[];
  const subById = new Map<number, SubjectOpt>(allSubjects.map((s) => [s.id, s]));

  const toMeta = (s: SectionOpt, isCt: boolean, subjects: SubjectOpt[]): SectionMeta => ({
    id: s.id, classId: s.class_id, label: `${s.class_name}-${s.name}`, className: s.class_name, classLevel: s.class_level,
    sectionName: s.name, isClassTeacher: isCt, subjects,
  });

  // class_id → its offered subjects (from class_subject), sorted by name.
  const buildClassSubjects = async (classIds: number[]): Promise<Map<number, SubjectOpt[]>> => {
    const map = new Map<number, SubjectOpt[]>();
    if (!classIds.length) return map;
    const { data } = await supabase.from("class_subject").select("class_id, subject_id").in("class_id", classIds);
    for (const row of data ?? []) {
      const s = subById.get(row.subject_id);
      if (!s) continue;
      const arr = map.get(row.class_id) ?? [];
      arr.push(s);
      map.set(row.class_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  };

  if (isAdmin) {
    const { data: secs } = await supabase
      .from("section")
      .select("id, name, class:class_id(id, name, level)")
      .order("name");
    const sections: SectionOpt[] = (secs ?? []).map((s) => {
      const c = s.class as unknown as ClassOpt;
      return { id: s.id, name: s.name, class_id: c.id, class_name: c.name, class_level: c.level };
    }).sort((a, b) => a.class_level - b.class_level || a.name.localeCompare(b.name));
    const classes = dedupeClasses(sections);
    const clsSubs = await buildClassSubjects(classes.map((c) => c.id));
    const forClass = (cid: number) => clsSubs.get(cid) ?? allSubjects;
    const sectionMeta = sections.map((s) => toMeta(s, false, forClass(s.class_id)));
    const subjectsByClass = Object.fromEntries(classes.map((c) => [c.id, forClass(c.id)]));
    return { isAdmin, years: yearList, currentYearId, classes, sections, subjects: allSubjects, classSectionId: null, sectionMeta, subjectsByClass };
  }

  // Teacher: derive scope from their own allotments (RLS: allot_read = own rows).
  const { data: allots } = await supabase
    .from("teacher_allotment")
    .select("section_id, subject_id, is_class_teacher, section:section_id(id, name, class:class_id(id, name, level))")
    .eq("academic_year_id", currentYearId ?? -1);

  type Info = { sec: SectionOpt; isCt: boolean; subj: Set<number> };
  const secInfo = new Map<number, Info>();
  const ctClassIds = new Set<number>();
  let classSectionId: number | null = null;

  for (const a of allots ?? []) {
    const sec = a.section as unknown as { id: number; name: string; class: ClassOpt } | null;
    if (!sec) continue;
    let info = secInfo.get(sec.id);
    if (!info) {
      info = { sec: { id: sec.id, name: sec.name, class_id: sec.class.id, class_name: sec.class.name, class_level: sec.class.level }, isCt: false, subj: new Set() };
      secInfo.set(sec.id, info);
    }
    if (a.is_class_teacher) { info.isCt = true; ctClassIds.add(sec.class.id); classSectionId = sec.id; }
    if (a.subject_id) info.subj.add(a.subject_id);
  }

  // Class teacher teaches every subject of their class.
  const classSubjects = new Map<number, number[]>();
  if (ctClassIds.size) {
    const { data: cs } = await supabase.from("class_subject").select("class_id, subject_id").in("class_id", [...ctClassIds]);
    for (const row of cs ?? []) {
      const arr = classSubjects.get(row.class_id) ?? [];
      arr.push(row.subject_id);
      classSubjects.set(row.class_id, arr);
    }
  }

  const sectionMeta: SectionMeta[] = [...secInfo.values()].map((info) => {
    const ids = info.isCt ? (classSubjects.get(info.sec.class_id) ?? [...info.subj]) : [...info.subj];
    const subjects = ids.map((id) => subById.get(id)).filter(Boolean) as SubjectOpt[];
    subjects.sort((a, b) => a.name.localeCompare(b.name));
    return toMeta(info.sec, info.isCt, subjects);
  }).sort((a, b) => Number(b.isClassTeacher) - Number(a.isClassTeacher) || a.classLevel - b.classLevel || a.label.localeCompare(b.label));

  const sections = [...secInfo.values()].map((i) => i.sec).sort((a, b) => a.class_level - b.class_level || a.name.localeCompare(b.name));
  const subjMap = new Map<number, SubjectOpt>();
  for (const m of sectionMeta) for (const s of m.subjects) subjMap.set(s.id, s);
  const subjects = [...subjMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Union each class's subjects across the teacher's sections of that class.
  const byClass = new Map<number, Map<number, SubjectOpt>>();
  for (const m of sectionMeta) {
    const cur = byClass.get(m.classId) ?? new Map<number, SubjectOpt>();
    for (const s of m.subjects) cur.set(s.id, s);
    byClass.set(m.classId, cur);
  }
  const subjectsByClass = Object.fromEntries(
    [...byClass.entries()].map(([cid, m]) => [cid, [...m.values()].sort((a, b) => a.name.localeCompare(b.name))]),
  );

  return { isAdmin, years: yearList, currentYearId, classes: dedupeClasses(sections), sections, subjects, classSectionId, sectionMeta, subjectsByClass };
}

function dedupeClasses(sections: SectionOpt[]): ClassOpt[] {
  const m = new Map<number, ClassOpt>();
  for (const s of sections) m.set(s.class_id, { id: s.class_id, name: s.class_name, level: s.class_level });
  return [...m.values()].sort((a, b) => a.level - b.level);
}

// Students of a section for a year (roster), RLS-scoped.
export async function getSectionStudents(sectionId: number, yearId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_enrollment")
    .select("roll_no, student:student_id(id, full_name, admission_no)")
    .eq("section_id", sectionId)
    .eq("academic_year_id", yearId)
    .order("roll_no");
  return (data ?? []).map((e) => {
    const s = e.student as unknown as { id: number; full_name: string; admission_no: string };
    return { id: s.id, name: s.full_name, admissionNo: s.admission_no, roll: e.roll_no };
  });
}
