"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ReportDownloads, type XlsxExport } from "@/components/report/report-downloads";
import type { PdfDoc } from "@/lib/pdf";

type ReportType = "monthly" | "yearly" | "exam";
type View = "overview" | "student";
type Row = { id: number; name: string };

const chipClass = (on: boolean) => cn("h-10 rounded-sm border px-3.5 text-[13px] font-medium transition-colors",
  on ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]");

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={chipClass(on)}>{label}</button>;
}

// Staff report controls: report type (monthly / yearly / exam), the detail level
// (whole class or one student), the period/exam picker, and the downloads.
// For the whole-school list there is no "one student" option (pick a section first).
export function StaffReportBar({
  type, view, month, examName, exams, students, studentId, sort, xlsx, pdf, wholeSchool = false,
}: {
  type: ReportType;
  view: View;
  month: string;
  examName: string | null;
  exams: string[];
  students: Row[];
  studentId: number | null;
  sort: "roll" | "marks";
  xlsx?: XlsxExport;
  pdf?: PdfDoc;
  wholeSchool?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(patch: Record<string, string>, clear: string[] = []) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    for (const k of clear) next.delete(k);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div>
        <label className="t-label mb-1 block">{t("report.type")}</label>
        <div className="flex gap-1.5">
          <Chip on={type === "monthly"} label={t("report.monthly")} onClick={() => push({ type: "monthly" })} />
          <Chip on={type === "yearly"} label={t("report.yearly")} onClick={() => push({ type: "yearly" })} />
          <Chip on={type === "exam"} label={t("report.examwise")} onClick={() => push({ type: "exam" })} />
        </div>
      </div>

      {!wholeSchool && (
        <div>
          <label className="t-label mb-1 block">{t("report.detail")}</label>
          <div className="flex gap-1.5">
            <Chip on={view === "overview"} label={t("report.classDetail")} onClick={() => push({ view: "overview" }, ["student"])} />
            <Chip on={view === "student"} label={t("report.studentDetail")} onClick={() => push({ view: "student" })} />
          </div>
        </div>
      )}

      {type === "monthly" && (
        <div className="min-w-[150px]">
          <label className="t-label mb-1 block">{t("report.month")}</label>
          <Input type="month" value={month} onChange={(e) => push({ month: e.target.value })} />
        </div>
      )}
      {type === "exam" && (
        <div className="min-w-[180px]">
          <label className="t-label mb-1 block">{t("report.exam")}</label>
          <Select value={examName ?? ""} onChange={(e) => push({ exam: e.target.value })} disabled={!exams.length}>
            <option value="" disabled>{t("report.pickExam")}</option>
            {exams.map((name) => (<option key={name} value={name}>{name}</option>))}
          </Select>
        </div>
      )}

      {view === "student" && !wholeSchool && (
        <div className="min-w-[180px]">
          <label className="t-label mb-1 block">{t("report.studentDetail")}</label>
          <Select value={studentId ?? ""} onChange={(e) => push({ student: e.target.value })}>
            <option value="" disabled>{t("x.reportPickStudent")}</option>
            {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </div>
      )}

      {(view === "overview" || wholeSchool) && (
        <div>
          <label className="t-label mb-1 block">{t("report.order")}</label>
          <div className="flex gap-1.5">
            <Chip on={sort === "roll"} label={t("report.byRoll")} onClick={() => push({ sort: "roll" })} />
            <Chip on={sort === "marks"} label={t("report.byMarks")} onClick={() => push({ sort: "marks" })} />
          </div>
        </div>
      )}

      <ReportDownloads className="ml-auto" xlsx={xlsx} pdf={pdf} />
    </div>
  );
}
