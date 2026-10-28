import { createClient } from "@/lib/supabase/server";
import { getCurrentYear } from "@/lib/session";
import { EmptyState } from "@/components/ui/empty";
import { StaffList, type StaffRow } from "@/components/manage/teachers/staff-list";
import { Assignments, type AssignRow, type SectionOpt, type SubjectOpt } from "@/components/manage/teachers/assignments";

// The API returns at most 1000 rows per request, so read the year's
// assignments page by page.
async function loadAllotments(supabase: Awaited<ReturnType<typeof createClient>>, yearId: number) {
  const PAGE = 1000;
  const out: { id: number; staff_id: number; section_id: number; subject_id: number | null; is_class_teacher: boolean }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("teacher_allotment")
      .select("id, staff_id, section_id, subject_id, is_class_teacher")
      .eq("academic_year_id", yearId)
      .order("id")
      .range(from, from + PAGE - 1);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// Manage School › Assigned Teachers: the staff list, and who teaches which
// subject in which section (plus each section's class teacher) this year.
export default async function ManageTeachersPage() {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return <EmptyState art="error" title="No current school year is set" hint="Ask the person who set up the portal to mark this year as current." />;

  const [staffRes, loginRes, sectionRes, subjectRes, classSubjectRes, allotRes] = await Promise.all([
    supabase.from("staff").select("id, full_name, role, employee_code, email, phone").order("full_name"),
    supabase.from("profile").select("staff_id").not("staff_id", "is", null),
    supabase.from("section").select("id, name, class:class_id(id, name, level)"),
    supabase.from("subject").select("id, name, code").order("name"),
    supabase.from("class_subject").select("class_id, subject_id"),
    loadAllotments(supabase, year.id),
  ]);

  const withLogin = new Set((loginRes.data ?? []).map((p) => p.staff_id));
  const staff: StaffRow[] = (staffRes.data ?? []).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    role: s.role,
    employeeCode: s.employee_code ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    hasLogin: withLogin.has(s.id),
  }));

  const sections: SectionOpt[] = (sectionRes.data ?? [])
    .map((s) => {
      const c = s.class as unknown as { id: number; name: string; level: number } | null;
      return { id: s.id, name: s.name, classId: c?.id ?? 0, className: c?.name ?? "—", classLevel: c?.level ?? 99 };
    })
    .sort((a, b) => a.classLevel - b.classLevel || a.name.localeCompare(b.name));

  const subjects: SubjectOpt[] = (subjectRes.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }));
  const classSubjects = (classSubjectRes.data ?? []).map((cs) => [cs.class_id, cs.subject_id] as [number, number]);
  const rows: AssignRow[] = allotRes.map((a) => ({
    id: a.id, staffId: a.staff_id, sectionId: a.section_id, subjectId: a.subject_id, isClassTeacher: a.is_class_teacher,
  }));

  return (
    <div className="space-y-6">
      <StaffList staff={staff} />
      <Assignments
        yearName={year.name}
        staff={staff.map((s) => ({ id: s.id, fullName: s.fullName, role: s.role }))}
        sections={sections}
        subjects={subjects}
        classSubjects={classSubjects}
        rows={rows}
      />
    </div>
  );
}
