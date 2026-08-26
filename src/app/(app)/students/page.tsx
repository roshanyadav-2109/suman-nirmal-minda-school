import Link from "next/link";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { ScopeBar } from "@/components/scope-bar";
import { StudentsIcon, ArrowRightIcon } from "@/components/icons";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";

import { numParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;

export default async function StudentsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { t } = await getT();
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (<div><PageHeader title={t("nav.students")} /><EmptyState icon={StudentsIcon} title={t("common.noData")} /></div>);
  }
  const yearId = num(sp.year) ?? scope.currentYearId;
  const section = scope.sections.find((s) => s.id === num(sp.section)) ?? scope.sections[0];
  const roster = await getSectionStudents(section.id, yearId);

  return (
    <div>
      <PageHeader eyebrow={`${section.class_name}-${section.name}`} title={t("nav.students")} description={`${roster.length} ${t("common.students").toLowerCase()}`} />
      <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
      <Card>
        <CardBody>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((s) => (
              <Link key={s.id} href={`/progress?studentId=${s.id}&section=${section.id}&year=${yearId}`}
                className="group flex items-center gap-2.5 rounded-sm border border-hair bg-surface px-3 py-2 transition-colors hover:border-black">
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
