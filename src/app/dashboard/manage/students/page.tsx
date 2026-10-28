import { EmptyState } from "@/components/ui/empty";
import { getCurrentYear } from "@/lib/session";
import { getStaffScope } from "@/lib/data/scope";
import { numParam, strParam } from "@/lib/utils";
import { StudentAdmin } from "@/components/manage/students/student-admin";
import { listStudents } from "./data";
import type { SectionRef } from "./rules";

type SP = Promise<Record<string, string | string[] | undefined>>;

// Manage School → Students (office only; the layout checks). This year's
// students, with search, class filter and paging in the address bar.
export default async function ManageStudentsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [year, scope] = await Promise.all([getCurrentYear(), getStaffScope()]);
  if (!year) {
    return <EmptyState art="nothing-yet" title="No school year is set up yet" hint="Once the current school year is added, students can be managed here." />;
  }

  const sections: SectionRef[] = scope.sections.map((s) => ({
    id: s.id, label: `${s.class_name}-${s.name}`, className: s.class_name, sectionName: s.name, classLevel: s.class_level,
  }));
  const sectionId = numParam(sp.section);
  const page = Math.max(0, Math.floor(numParam(sp.page) ?? 0));
  const list = await listStudents({
    yearId: year.id,
    sectionId: sectionId && sections.some((s) => s.id === sectionId) ? sectionId : null,
    q: (strParam(sp.q) ?? "").trim(),
    left: strParam(sp.show) === "left",
    page,
  });

  return (
    <StudentAdmin
      rows={list.rows}
      total={list.total}
      page={list.page}
      pageSize={list.pageSize}
      sections={sections}
      yearName={year.name}
    />
  );
}
