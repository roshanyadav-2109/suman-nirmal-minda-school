// Turns report data into a `PdfDoc` description (see pdf.ts). Pure functions,
// safe to call on the server; the browser draws the file when "Download PDF" is
// clicked. Labels are plain English on purpose: the built-in PDF fonts cannot
// draw Hindi or Bengali letters.

import type { PdfCell, PdfDoc } from "@/lib/pdf";
import type { ClassReportRow, SchoolReportSection, StudentReport } from "@/lib/data/report";

const LOW_ATTENDANCE = 75;

const pct = (n: number | null | undefined) => (n == null ? "-" : `${n}%`);
const attCell = (n: number | null | undefined): PdfCell => (n == null ? "-" : { text: `${n}%`, low: n < LOW_ATTENDANCE });
const reportName = (kind: "monthly" | "yearly" | "exam") =>
  kind === "monthly" ? "Monthly report" : kind === "yearly" ? "Yearly report" : "Exam report";

type Common = {
  kind: "monthly" | "yearly" | "exam";
  /** "February 2026", "2025-26" or the exam name — in English. */
  period: string;
  yearName: string;
};

// One pupil's report card (staff "one student" view and the parent/student card).
export function studentCardPdf(r: StudentReport, o: Common & { section?: string }): PdfDoc {
  const name = r.student?.full_name ?? "Student";
  const att = r.attendance;
  const facts: [string, string][] = [
    ["Student", name],
    ["Admission no", r.student?.admission_no ?? "-"],
    ...(o.section ? [["Class and section", o.section] as [string, string]] : []),
    [o.kind === "exam" ? "Exam" : "Period", o.period],
    ...(att ? [["Attendance", att.pct != null ? `${att.pct}% (present ${att.present} of ${att.total} days)` : "-"] as [string, string]] : []),
  ];
  return {
    filename: `Report card ${name} ${o.period}`,
    title: `Report card - ${reportName(o.kind)}`,
    meta: [`${o.kind === "exam" ? "Exam" : "Period"}: ${o.period}`, o.section ? `Section: ${o.section}` : "", o.yearName ? `School year: ${o.yearName}` : ""],
    blocks: [
      { kind: "facts", items: facts },
      {
        kind: "table", heading: "Marks",
        headers: ["Subject", "Assessment", "Marks %", "Grade", "Change"],
        rows: r.marks.length
          ? r.marks.map((m) => [m.subject_name, m.assessment_name, m.percent, m.band ?? "-", m.delta == null ? "-" : `${m.delta > 0 ? "+" : ""}${m.delta}`])
          : [["No marks recorded for this period", "", "", "", ""]],
        right: [2, 4],
      },
      ...(r.notices.length
        ? [{ kind: "text" as const, heading: "Notices sent", lines: r.notices.map((n) => `${n.published_at.slice(0, 10)}  ${n.title}`) }]
        : []),
    ],
  };
}

// One section's class list.
export function classListPdf(rows: ClassReportRow[], o: Common & { section: string; showAtt: boolean }): PdfDoc {
  const avgs = rows.map((r) => r.avg).filter((v): v is number => v != null);
  const atts = rows.map((r) => r.attPct).filter((v): v is number => v != null);
  const mean = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  return {
    filename: `${o.section} ${reportName(o.kind)} ${o.period}`,
    title: `Class report - ${reportName(o.kind)}`,
    meta: [`Section: ${o.section}`, `${o.kind === "exam" ? "Exam" : "Period"}: ${o.period}`, o.yearName ? `School year: ${o.yearName}` : ""],
    blocks: [
      {
        kind: "facts",
        items: [
          ["Students", String(rows.length)],
          ["Class average", pct(mean(avgs))],
          ...(o.showAtt ? [["Class attendance", pct(mean(atts))] as [string, string]] : []),
        ],
      },
      {
        kind: "table",
        headers: ["Roll", "Student", "Average marks %", ...(o.showAtt ? ["Attendance %"] : [])],
        rows: rows.map((r) => [r.roll ?? "-", r.name, pct(r.avg), ...(o.showAtt ? [attCell(r.attPct)] : [])]),
        right: o.showAtt ? [2, 3] : [2],
        widths: { 0: 14, 2: 38, 3: 38 }, // col 3 is ignored when there is no attendance
      },
    ],
  };
}

// The whole school, grouped by class then section, with a line per section.
export function schoolListPdf(sections: SchoolReportSection[], o: Common & { showAtt: boolean }): PdfDoc {
  const students = sections.reduce((n, s) => n + s.rows.length, 0);
  return {
    filename: `Whole school ${reportName(o.kind)} ${o.period}`,
    title: `Whole school report - ${reportName(o.kind)}`,
    meta: [`${o.kind === "exam" ? "Exam" : "Period"}: ${o.period}`, "Section: All sections", o.yearName ? `School year: ${o.yearName}` : "", `${students} students in ${sections.length} sections`],
    orientation: "landscape",
    blocks: [{
      kind: "grouped",
      headers: ["Class", "Section", "Roll", "Student", "Average marks %", ...(o.showAtt ? ["Attendance %"] : [])],
      groups: sections.map((s) => ({
        label: sectionSummary(s, o.showAtt),
        rows: s.rows.map((r) => [s.className, s.sectionName, r.roll ?? "-", r.name, pct(r.avg), ...(o.showAtt ? [attCell(r.attPct)] : [])]),
      })),
      right: o.showAtt ? [2, 4, 5] : [2, 4],
      widths: { 0: 18, 1: 18, 2: 14, 4: 38, 5: 38 },
    }],
  };
}

export function sectionSummary(s: SchoolReportSection, showAtt: boolean) {
  return [
    `Class ${s.className} - Section ${s.sectionName}`,
    `${s.rows.length} students`,
    `section average ${pct(s.avg)}`,
    ...(showAtt ? [`section attendance ${pct(s.attPct)}`] : []),
  ].join("   |   ");
}
