import { ArrowRightIcon } from "@/components/icons";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { ScopeBar } from "@/components/scope-bar";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import { createClient } from "@/lib/supabase/server";

import { numParam, strParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;

export default async function StudentsPage({ searchParams }: { searchParams: SP }) {
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
                          href={r.sectionId ? `/progress?studentId=${r.id}&section=${r.sectionId}&year=${scope.currentYearId}` : `/progress?studentId=${r.id}`}>
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
  const roster = await getSectionStudents(section.id, yearId);

  return (
    <div>
      <PageHeader eyebrow={`${section.class_name}-${section.name}`} title={t("nav.students")} />
      <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
      <Card>
        <CardBody>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((s) => (
              <Link prefetch={false} key={s.id} href={`/progress?studentId=${s.id}&section=${section.id}&year=${yearId}`}
                className="group flex items-center gap-2.5 rounded-sm border border-hair bg-surface px-3 py-2 transition-colors hover:border-[#0F6CBD]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-700 tabular">{s.roll ?? "–"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{s.name}</span>
                  <span className="block truncate text-[11px] text-muted tabular">{s.admissionNo}</span>
                </span>
                <ArrowRightIcon size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900" />
              </Link>
            ))}
          </div>
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
