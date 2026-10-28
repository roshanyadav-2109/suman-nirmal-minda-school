import Link from "next/link";
import { RosterGrid } from "@/components/students/roster-grid";
import { getSession } from "@/lib/session";
import { getStudentRecords } from "@/app/dashboard/manage/students/data";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { ScopeBar } from "@/components/scope-bar";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import { createClient } from "@/lib/supabase/server";

import { numParam, strParam } from "@/lib/utils";
import { guardTab } from "@/lib/access";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;

export default async function StudentsPage({ searchParams }: { searchParams: SP }) {
  const denied = await guardTab("/dashboard/students");
  if (denied) return denied;
  const sp = await searchParams;
  const { t } = await getT();
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (<div><PageHeader title={t("nav.students")} /><EmptyState title={t("common.noData")} /></div>);
  }
  const yearId = num(sp.year) ?? scope.currentYearId;

  // Search from the top bar: name or admission number, across every section
  // this person may see (the database limits it to their own scope).
  const q = (strParam(sp.q) ?? "").trim();
  if (q) {
    const results = await searchStudents(q, scope.currentYearId);
    return (
      <div>
        <PageHeader title={t("nav.students")} description={t("x.searchResults", { q })} />
        {results.length ? (
          <Card>
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[14px]">
                <thead>
                  <tr className="text-left text-[13px] text-ink-700">
                    <th className="py-2 font-semibold">{t("common.student")}</th>
                    <th className="py-2 font-semibold">{t("transport.admissionNo")}</th>
                    <th className="py-2 font-semibold">{t("common.class")}</th>
                    <th className="py-2 font-semibold">{t("dashboard.rollNo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-panel">
                      <td className="py-2">
                        <Link prefetch={false} className="font-medium text-[#0F6CBD] hover:underline"
                          href={r.sectionId ? `/dashboard/progress?studentId=${r.id}&section=${r.sectionId}&year=${scope.currentYearId}` : `/dashboard/progress?studentId=${r.id}`}>
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 tabular text-ink-900">{r.admissionNo}</td>
                      <td className="py-2 text-ink-900">{r.classSection ?? "—"}</td>
                      <td className="py-2 tabular text-ink-900">{r.roll ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ) : (
          <EmptyState art="no-results" title={t("transport.noResults")} hint={t("x.searchNone", { q })} />
        )}
      </div>
    );
  }

  const section = scope.sections.find((s) => s.id === num(sp.section)) ?? scope.sections[0];

  // Who may edit details here: the office and principal for everyone, a class
  // teacher for their own class — and only this year's roster (that is what an edit changes).
  const session = await getSession();
  const isOffice = session?.staffRole === "office" || session?.staffRole === "principal";
  const ownClass = scope.sectionMeta.some((m) => m.id === section.id && m.isClassTeacher);
  const mode: "none" | "teacher" | "office" =
    yearId !== scope.currentYearId ? "none" : isOffice ? "office" : ownClass ? "teacher" : "none";

  const roster = await getSectionStudents(section.id, yearId);
  const records = mode === "none" ? [] : [...(await getStudentRecords(roster.map((s) => s.id), yearId)).values()];
  const sectionRefs = scope.sections.map((s) => ({
    id: s.id, label: `${s.class_name}-${s.name}`, className: s.class_name, sectionName: s.name, classLevel: s.class_level,
  }));

  return (
    <div>
      <PageHeader title={t("nav.students")} />
      <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
      <Card>
        <CardBody>
          <RosterGrid roster={roster} records={records} sectionId={section.id} yearId={yearId} mode={mode} sections={sectionRefs} />
        </CardBody>
      </Card>
    </div>
  );
}

// Students whose name or admission number contains the search text, with their
// class and roll number for this year. RLS keeps each person to their own scope.
async function searchStudents(q: string, yearId: number) {
  const supabase = await createClient();
  // Characters that would break the filter syntax are dropped, not escaped.
  const term = q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
  if (!term) return [];
  const { data: students } = await supabase
    .from("student")
    .select("id, full_name, admission_no")
    .or(`full_name.ilike.%${term}%,admission_no.ilike.%${term}%`)
    .order("full_name")
    .limit(50);
  const ids = (students ?? []).map((s) => s.id);
  if (!ids.length) return [];
  const { data: enr } = await supabase
    .from("student_enrollment")
    .select("student_id, roll_no, section_id, section:section_id(name, class:class_id(name))")
    .eq("academic_year_id", yearId)
    .in("student_id", ids);
  const byStudent = new Map((enr ?? []).map((e) => [e.student_id, e]));
  return (students ?? []).map((s) => {
    const e = byStudent.get(s.id);
    const sec = e?.section as unknown as { name: string; class: { name: string } | null } | null;
    return {
      id: s.id,
      name: s.full_name,
      admissionNo: s.admission_no,
      roll: e?.roll_no ?? null,
      sectionId: e?.section_id ?? null,
      classSection: sec ? (sec.class ? `${sec.class.name}-${sec.name}` : sec.name) : null,
    };
  });
}
