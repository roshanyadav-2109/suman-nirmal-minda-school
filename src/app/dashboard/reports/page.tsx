import { TrendArrow } from "@/components/ui/status";
import Link from "next/link";
import { getSession, getCurrentYear } from "@/lib/session";
import { getT } from "@/i18n/server";
import { fmtMonth, fmtPercent } from "@/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReportControls } from "@/components/report/report-controls";
import { StaffReportBar } from "@/components/report/staff-report-bar";
import { ReportScopeBar } from "@/components/report/report-scope-bar";
import { ReportCard } from "@/components/report/monthly-report-card";
import type { XlsxExport } from "@/components/report/report-downloads";
import { ScopeBar } from "@/components/scope-bar";
import { getMyChildren } from "@/lib/data/analytics";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import {
  getStudentReport, getStudentExamReport, getClassReport, getClassExamReport,
  getSectionExamNames, getSchoolExamNames, getSchoolReport, getYearBounds, monthBounds,
  type StudentReport, type ClassReportRow, type SchoolReportSection,
} from "@/lib/data/report";
import { studentCardPdf, classListPdf, schoolListPdf } from "@/lib/pdf-report";
import { numParam, strParam } from "@/lib/utils";
import { guardTab } from "@/lib/access";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;
const str = strParam;
const DEFAULT_MONTH = "2026-02";
type ReportType = "monthly" | "yearly" | "exam";
type Sort = "roll" | "marks";

const byRollOrMarks = (sort: Sort) => (a: ClassReportRow, b: ClassReportRow) => sort === "marks"
  ? (b.avg ?? -1) - (a.avg ?? -1)
  : (a.roll ?? Number.MAX_SAFE_INTEGER) - (b.roll ?? Number.MAX_SAFE_INTEGER);

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const denied = await guardTab("/dashboard/reports");
  if (denied) return denied;
  const sp = await searchParams;
  const session = (await getSession())!;
  const { t, locale } = await getT();
  const month = str(sp.month) ?? DEFAULT_MONTH;
  // PDFs are always in English (the built-in PDF fonts cannot draw Hindi/Bengali).
  const monthEn = fmtMonth("en", `${month}-01`);

  // ---- Owner: their own / their child's monthly report card ----
  if (session.role === "student" || session.role === "guardian") {
    let studentId = session.studentId;
    let children: { id: number; full_name: string; admission_no: string }[] = [];
    if (session.role === "guardian") {
      children = await getMyChildren();
      studentId = num(sp.child) ?? children[0]?.id ?? null;
    }
    if (!studentId) return <EmptyState title={t("common.noData")} />;
    const { start, end } = monthBounds(month);
    const r = await getStudentReport(studentId, start, end);
    return (
      <div>
        <PageHeader title={t("report.title")} />
        {session.role === "guardian" && children.length > 1 && (
          <div className="seg no-print mb-3 flex flex-wrap gap-2">
            {children.map((c) => (
              <Link prefetch={false} key={c.id} href={`/dashboard/reports?child=${c.id}&month=${month}`} className={`rounded-sm border px-3 py-1.5 text-[13px] font-medium ${c.id === studentId ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]"}`}>{c.full_name}</Link>
            ))}
          </div>
        )}
        <ReportControls month={month} pdf={studentCardPdf(r, { kind: "monthly", period: monthEn, yearName: "" })} />
        <ReportCard report={r} periodLabel={fmtMonth(locale, `${month}-01`)} />
      </div>
    );
  }

  // ---- Staff: monthly / yearly / exam report, class or student detail ----
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (<div><PageHeader title={t("report.title")} /><EmptyState title={t("common.noData")} /></div>);
  }
  const yearId = num(sp.year) ?? scope.currentYearId;
  const yearName = scope.years.find((y) => y.id === yearId)?.name ?? (await getCurrentYear())?.name ?? "";
  const type: ReportType = str(sp.type) === "yearly" ? "yearly" : str(sp.type) === "exam" ? "exam" : "monthly";
  const sort: Sort = str(sp.sort) === "marks" ? "marks" : "roll";
  const showAtt = type !== "exam";
  const periodFor = (examName: string | null, monthLabel: string) =>
    type === "exam" ? (examName ?? "—") : type === "yearly" ? yearName : monthLabel;

  // ---- Whole school (office / principal): every section at once ----
  if (session.isAdminScope && str(sp.section) === "all") {
    const exams = type === "exam" ? await getSchoolExamNames(yearId) : [];
    const examName = str(sp.exam) ?? (type === "exam" ? exams[0] ?? null : null);
    const range = type === "yearly" ? await getYearBounds(yearId) : monthBounds(month);
    const sections: SchoolReportSection[] = type === "exam" && !examName ? [] : await getSchoolReport(
      yearId, scope.sections,
      type === "exam" ? { kind: "exam", examName: examName! } : { kind: "range", start: range.start, end: range.end, yearly: type === "yearly" },
    );
    for (const s of sections) s.rows.sort(byRollOrMarks(sort));
    return (
      <SchoolView sections={sections} t={t} locale={locale} showAtt={showAtt}
        scopeBar={<ReportScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId="all" />}
        bar={(xlsx, pdf) => (
          <StaffReportBar type={type} view="overview" month={month} examName={examName} exams={exams}
            students={[]} studentId={null} sort={sort} xlsx={xlsx} pdf={pdf} wholeSchool />
        )}
        periodLabel={periodFor(examName, fmtMonth(locale, `${month}-01`))}
        periodEn={periodFor(examName, monthEn)} kind={type} yearName={yearName} noExam={type === "exam" && !exams.length} />
    );
  }

  const section = scope.sections.find((s) => s.id === num(sp.section)) ?? scope.sections[0];
  const sectionLabel = `${section.class_name}-${section.name}`;
  const view = str(sp.view) === "student" ? "student" : "overview";
  const scopeBar = session.isAdminScope
    ? <ReportScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />
    : <ScopeBar years={scope.years} sections={scope.sections} yearId={yearId} sectionId={section.id} />;

  const roster = await getSectionStudents(section.id, yearId);
  const exams = type === "exam" ? await getSectionExamNames(section.id, yearId) : [];
  const examName = str(sp.exam) ?? (type === "exam" ? exams[0] ?? null : null);
  const studentId = num(sp.student) ?? (view === "student" ? roster[0]?.id ?? null : null);

  const periodLabel = periodFor(examName, fmtMonth(locale, `${month}-01`));
  const periodEn = periodFor(examName, monthEn);

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
    const pdf = report ? studentCardPdf(report, { kind: type, period: periodEn, yearName, section: sectionLabel }) : undefined;
    return (
      <div>
        <PageHeader title={t("report.title")} />
        {scopeBar}
        <StaffReportBar type={type} view={view} month={month} examName={examName} exams={exams}
          students={roster.map((s) => ({ id: s.id, name: s.name }))} studentId={studentId} sort="roll" pdf={pdf} />
        {report ? (
          <ReportCard report={report} periodLabel={periodLabel} />
        ) : (
          <EmptyState art={type === "exam" && !exams.length ? "nothing-yet" : "pick-student"} title={type === "exam" && !exams.length ? t("common.noData") : t("x.reportPickStudent")} />
        )}
      </div>
    );
  }

  // ---- Class detail: every pupil in the section ----
  let rows: ClassReportRow[] = [];
  if (type === "exam") { if (examName) rows = await getClassExamReport(section.id, yearId, examName); }
  else rows = await getClassReport(section.id, yearId, range.start, range.end);

  // Order: by roll number (register order) or by average marks, highest first.
  rows = [...rows].sort(byRollOrMarks(sort));

  const headers = ["#", t("common.student"), t("report.avgMarks"), ...(showAtt ? [t("attendance.percent")] : [])];
  const xlsx: XlsxExport = {
    filename: `${sectionLabel} ${periodLabel}`,
    sheetName: sectionLabel,
    headers,
    rows: rows.map((r) => [r.roll ?? "", r.name, r.avg ?? "", ...(showAtt ? [r.attPct ?? ""] : [])] as (string | number | null)[]),
  };
  const pdf = classListPdf(rows, { kind: type, period: periodEn, yearName, section: sectionLabel, showAtt });

  return (
    <div>
      <PageHeader title={t("report.title")} />
      {scopeBar}
      <StaffReportBar type={type} view={view} month={month} examName={examName} exams={exams}
        students={roster.map((s) => ({ id: s.id, name: s.name }))} studentId={studentId} sort={sort} xlsx={xlsx} pdf={pdf} />
      <Card className="print-area">
        <CardHeader eyebrow={`${sectionLabel} · ${periodLabel}`} title={yearName} />
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-[14px]">
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
                    {showAtt && <td className="py-2 text-right tabular text-ink-900"><AttPct v={r.attPct} /></td>}
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

function AttPct({ v }: { v: number | null }) {
  return <>{v != null && v < 75 && <TrendArrow tone="down" size={12} className="mr-1 align-[-1px]" />}{v != null ? `${v}%` : "—"}</>;
}

type T = Awaited<ReturnType<typeof getT>>["t"];
type Locale = Awaited<ReturnType<typeof getT>>["locale"];

// Whole-school list: one card per class, a table per section with its summary line.
function SchoolView({
  sections, t, locale, showAtt, scopeBar, bar, periodLabel, periodEn, kind, yearName, noExam,
}: {
  sections: SchoolReportSection[];
  t: T;
  locale: Locale;
  showAtt: boolean;
  scopeBar: React.ReactNode;
  bar: (xlsx: XlsxExport | undefined, pdf: ReturnType<typeof schoolListPdf> | undefined) => React.ReactNode;
  periodLabel: string;
  periodEn: string;
  kind: ReportType;
  yearName: string;
  noExam: boolean;
}) {
  const classes: { name: string; sections: SchoolReportSection[] }[] = [];
  for (const s of sections) {
    const last = classes[classes.length - 1];
    if (last && last.name === s.className) last.sections.push(s);
    else classes.push({ name: s.className, sections: [s] });
  }
  const students = sections.reduce((n, s) => n + s.rows.length, 0);
  const all = sections.flatMap((s) => s.rows);
  const avgs = all.map((r) => r.avg).filter((v): v is number => v != null);
  const atts = all.map((r) => r.attPct).filter((v): v is number => v != null);
  const mean = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

  const colClass = t("common.class"), colSection = t("common.section"), colStudent = t("common.student");
  const listHeaders = [colClass, colSection, "Roll", colStudent, t("report.avgMarks"), ...(showAtt ? [t("attendance.percent")] : [])];
  const listRow = (s: SchoolReportSection, r: ClassReportRow) =>
    [s.className, s.sectionName, r.roll ?? "", r.name, r.avg ?? "", ...(showAtt ? [r.attPct ?? ""] : [])] as (string | number | null)[];
  const allRows = sections.flatMap((s) => s.rows.map((r) => listRow(s, r)));

  const xlsx: XlsxExport | undefined = sections.length ? {
    filename: `Whole school ${periodLabel}`,
    headers: listHeaders,
    rows: allRows,
    sheets: [
      { name: "All students", headers: listHeaders, rows: allRows },
      {
        name: "Section summary",
        headers: [colClass, colSection, "Students", "Section average %", ...(showAtt ? ["Section attendance %"] : [])],
        rows: sections.map((s) => [s.className, s.sectionName, s.rows.length, s.avg ?? "", ...(showAtt ? [s.attPct ?? ""] : [])]),
      },
      ...classes.map((c) => ({
        name: `Class ${c.name}`,
        headers: listHeaders,
        rows: c.sections.flatMap((s) => s.rows.map((r) => listRow(s, r))),
      })),
    ],
  } : undefined;
  const pdf = sections.length ? schoolListPdf(sections, { kind, period: periodEn, yearName, showAtt }) : undefined;

  return (
    <div>
      <PageHeader title={t("report.title")} />
      {scopeBar}
      {bar(xlsx, pdf)}
      {!sections.length ? (
        <EmptyState art="nothing-yet" title={noExam ? "No exam has marks yet this school year." : t("common.noData")} />
      ) : (
        <div className="print-area space-y-5">
          <Card>
            <CardHeader eyebrow={`Whole school · ${periodLabel}`} title={yearName} />
            <CardBody className="pt-1">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-ink-900">
                <span><span className="text-muted">Students: </span><span className="tabular">{students}</span></span>
                <span><span className="text-muted">Sections: </span><span className="tabular">{sections.length}</span></span>
                <span><span className="text-muted">School average: </span><span className="tabular">{fmtPercent(locale, mean(avgs), 1)}</span></span>
                {showAtt && <span><span className="text-muted">School attendance: </span><span className="tabular">{fmtPercent(locale, mean(atts), 1)}</span></span>}
              </div>
            </CardBody>
          </Card>
          {classes.map((c) => (
            <Card key={c.name}>
              <CardHeader eyebrow={periodLabel} title={`${colClass} ${c.name}`} />
              <CardBody className="space-y-5 pt-2">
                {c.sections.map((s) => (
                  <section key={s.sectionId} aria-label={`${s.className}-${s.sectionName}`}>
                    <p className="mb-2 rounded-sm bg-[#F5F9FE] px-3 py-2 text-[13px] text-ink-900">
                      <span className="font-semibold">{colSection} {s.className}-{s.sectionName}</span>
                      <span className="text-muted"> · </span>{s.rows.length} students
                      <span className="text-muted"> · </span>section average <span className="tabular">{fmtPercent(locale, s.avg, 1)}</span>
                      {showAtt && <><span className="text-muted"> · </span>section attendance <span className="tabular">{fmtPercent(locale, s.attPct, 1)}</span></>}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-[14px]">
                        <thead>
                          <tr className="text-left text-[12px] text-muted">
                            <th className="pb-2 font-semibold">{colClass}</th>
                            <th className="pb-2 font-semibold">{colSection}</th>
                            <th className="pb-2 font-semibold">Roll</th>
                            <th className="pb-2 font-semibold">{colStudent}</th>
                            <th className="pb-2 text-right font-semibold">{t("report.avgMarks")}</th>
                            {showAtt && <th className="pb-2 text-right font-semibold">{t("attendance.percent")}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((r) => (
                            <tr key={r.id} className="border-t border-hair">
                              <td className="py-1.5 text-ink-900">{s.className}</td>
                              <td className="py-1.5 text-ink-900">{s.sectionName}</td>
                              <td className="py-1.5 text-muted tabular">{r.roll ?? "–"}</td>
                              <td className="py-1.5 text-ink-900">{r.name}</td>
                              <td className="py-1.5 text-right tabular text-ink-900">{r.avg != null ? fmtPercent(locale, r.avg, 1) : "—"}</td>
                              {showAtt && <td className="py-1.5 text-right tabular text-ink-900"><AttPct v={r.attPct} /></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
