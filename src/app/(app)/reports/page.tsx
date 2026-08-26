import Link from "next/link";
import { getSession, getCurrentYear } from "@/lib/session";
import { getT } from "@/i18n/server";
import { fmtMonth, fmtPercent } from "@/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReportControls } from "@/components/report/report-controls";
import { StaffReportBar } from "@/components/report/staff-report-bar";
import { ReportCard } from "@/components/report/monthly-report-card";
import { ScopeBar } from "@/components/scope-bar";
import { ReportIcon } from "@/components/icons";
import { getMyChildren } from "@/lib/data/analytics";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import {
  getStudentReport, getStudentExamReport, getClassReport, getClassExamReport,
  getSectionExamNames, getYearBounds, monthBounds, type StudentReport, type ClassReportRow,
} from "@/lib/data/report";
import { numParam, strParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;
const str = strParam;
const DEFAULT_MONTH = "2026-02";
type ReportType = "monthly" | "yearly" | "exam";

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const { t, locale } = await getT();
  const month = str(sp.month) ?? DEFAULT_MONTH;

  // ---- Owner: their own / their child's monthly report card ----
  if (session.role === "student" || session.role === "guardian") {
    let studentId = session.studentId;
    let children: { id: number; full_name: string; admission_no: string }[] = [];
    if (session.role === "guardian") {
      children = await getMyChildren();
      studentId = num(sp.child) ?? children[0]?.id ?? null;
    }
    if (!studentId) return <EmptyState icon={ReportIcon} title={t("common.noData")} />;
    const { start, end } = monthBounds(month);
    const r = await getStudentReport(studentId, start, end);
    return (
      <div>
        <PageHeader title={t("report.title")} />
        {session.role === "guardian" && children.length > 1 && (
          <div className="no-print mb-3 flex flex-wrap gap-2">
            {children.map((c) => (
              <Link key={c.id} href={`/reports?child=${c.id}&month=${month}`} className={`rounded-sm border px-3 py-1.5 text-[13px] font-medium ${c.id === studentId ? "border-gold-500 bg-gold-100 text-ink-900" : "border-hair bg-surface text-ink-500 hover:bg-panel"}`}>{c.full_name}</Link>
            ))}
          </div>
        )}
        <ReportControls month={month} />
        <ReportCard report={r} periodLabel={fmtMonth(locale, `${month}-01`)} />
      </div>
    );
  }

  // ---- Staff: monthly / yearly / exam report, class or student detail ----
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (<div><PageHeader title={t("report.title")} /><EmptyState icon={ReportIcon} title={t("common.noData")} /></div>);
  }
  const yearId = num(sp.year) ?? scope.currentYearId;
  const yearName = scope.years.find((y) => y.id === yearId)?.name ?? (await getCurrentYear())?.name ?? "";
  const section = scope.sections.find((s) => s.id === num(sp.section)) ?? scope.sections[0];
  const type: ReportType = str(sp.type) === "yearly" ? "yearly" : str(sp.type) === "exam" ? "exam" : "monthly";
  const view = str(sp.view) === "student" ? "student" : "overview";

  const roster = await getSectionStudents(section.id, yearId);
  const exams = type === "exam" ? await getSectionExamNames(section.id, yearId) : [];
  const examName = str(sp.exam) ?? (type === "exam" ? exams[0] ?? null : null);
  const studentId = num(sp.student) ?? (view === "student" ? roster[0]?.id ?? null : null);

  const periodLabel = type === "exam" ? (examName ?? "—") : type === "yearly" ? yearName : fmtMonth(locale, `${month}-01`);
  const showAtt = type !== "exam";

  // Resolve the date range for monthly/yearly reports.
  const range = type === "yearly" ? await getYearBounds(yearId) : monthBounds(month);

  // ---- Student detail: one pupil's report card ----
  if (view === "student") {
    let report: StudentReport | null = null;
    if (studentId) {
      report = type === "exam"
        ? (examName ? await getStudentExamReport(studentId, yearId, examName) : null)
        : await getStudentReport(studentId, range.start, range.end);
    }
    return (
      <div>
        <PageHeader eyebrow={`${section.class_name}-${section.name}`} title={t("report.title")} description={t("report.studentDetail")} />
        <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
        <StaffReportBar type={type} view={view} month={month} examName={examName} exams={exams}
          students={roster.map((s) => ({ id: s.id, name: s.name }))} studentId={studentId} sort="roll" />
        {report ? (
          <ReportCard report={report} periodLabel={periodLabel} />
        ) : (
          <EmptyState icon={ReportIcon} title={type === "exam" && !exams.length ? t("common.noData") : t("x.reportPickStudent")} />
        )}
      </div>
    );
  }

  // ---- Class detail: every pupil in the section ----
  let rows: ClassReportRow[] = [];
  if (type === "exam") { if (examName) rows = await getClassExamReport(section.id, yearId, examName); }
  else rows = await getClassReport(section.id, yearId, range.start, range.end);

  // Order: by roll number (register order) or by average marks, highest first.
  const sort = str(sp.sort) === "marks" ? "marks" : "roll";
  rows = [...rows].sort((a, b) => sort === "marks"
    ? (b.avg ?? -1) - (a.avg ?? -1)
    : (a.roll ?? Number.MAX_SAFE_INTEGER) - (b.roll ?? Number.MAX_SAFE_INTEGER));

  const headers = ["#", t("common.student"), t("report.avgMarks"), ...(showAtt ? [t("attendance.percent")] : [])];
  const xlsx = {
    filename: `${section.class_name}-${section.name} ${periodLabel}`,
    sheetName: `${section.class_name}-${section.name}`,
    headers,
    rows: rows.map((r) => [r.roll ?? "", r.name, r.avg ?? "", ...(showAtt ? [r.attPct ?? ""] : [])] as (string | number | null)[]),
  };

  return (
    <div>
      <PageHeader eyebrow={`${section.class_name}-${section.name}`} title={t("report.title")} description={t("report.classDetail")} />
      <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
      <StaffReportBar type={type} view={view} month={month} examName={examName} exams={exams}
        students={roster.map((s) => ({ id: s.id, name: s.name }))} studentId={studentId} sort={sort} xlsx={xlsx} />
      <Card className="print-area">
        <CardHeader eyebrow={`${section.class_name}-${section.name} · ${periodLabel}`} title={yearName} />
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="pb-2 font-semibold">#</th>
                  <th className="pb-2 font-semibold">{t("common.student")}</th>
                  <th className="pb-2 text-right font-semibold">{t("report.avgMarks")}</th>
                  {showAtt && <th className="pb-2 text-right font-semibold">{t("attendance.percent")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-hair">
                    <td className="py-2 text-muted tabular">{r.roll ?? "–"}</td>
                    <td className="py-2 text-ink-900">{r.name}</td>
                    <td className="py-2 text-right font-normal tabular text-ink-900">{r.avg != null ? fmtPercent(locale, r.avg, 1) : "—"}</td>
                    {showAtt && <td className={`py-2 text-right tabular ${r.attPct != null && r.attPct < 75 ? "font-semibold text-down" : "text-ink-700"}`}>{r.attPct != null ? `${r.attPct}%` : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p className="py-3 text-[13px] text-ink-900">{t("common.noData")}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
