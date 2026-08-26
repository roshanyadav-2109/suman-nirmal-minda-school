"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ReportIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { downloadXlsx } from "@/lib/xlsx";
import type { XlsxExport } from "@/components/report/report-controls";

type ReportType = "monthly" | "yearly" | "exam";
type View = "overview" | "student";
type Row = { id: number; name: string };

// Staff report controls: report type (monthly / yearly / exam), the detail level
// (whole class or one student), the period/exam picker, and the download.
export function StaffReportBar({
  type, view, month, examName, exams, students, studentId, sort, xlsx,
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

  const TypeChip = ({ v, label }: { v: ReportType; label: string }) => (
    <button onClick={() => push({ type: v })} aria-pressed={type === v}
      className={cn("h-10 rounded-sm px-3 text-[13px] font-medium transition-colors",
        type === v ? "bg-black text-white" : "bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}>
      {label}
    </button>
  );
  const ViewChip = ({ v, label }: { v: View; label: string }) => (
    <button onClick={() => push({ view: v }, v === "overview" ? ["student"] : [])} aria-pressed={view === v}
      className={cn("h-10 rounded-sm px-3 text-[13px] font-medium transition-colors",
        view === v ? "bg-black text-white" : "bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}>
      {label}
    </button>
  );
  const SortChip = ({ v, label }: { v: "roll" | "marks"; label: string }) => (
    <button onClick={() => push({ sort: v })} aria-pressed={sort === v}
      className={cn("h-10 rounded-sm px-3 text-[13px] font-medium transition-colors",
        sort === v ? "bg-black text-white" : "bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}>
      {label}
    </button>
  );

  return (
    <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div>
        <label className="t-label mb-1 block">{t("report.type")}</label>
        <div className="flex gap-1.5">
          <TypeChip v="monthly" label={t("report.monthly")} />
          <TypeChip v="yearly" label={t("report.yearly")} />
          <TypeChip v="exam" label={t("report.examwise")} />
        </div>
      </div>

      <div>
        <label className="t-label mb-1 block">{t("report.detail")}</label>
        <div className="flex gap-1.5">
          <ViewChip v="overview" label={t("report.classDetail")} />
          <ViewChip v="student" label={t("report.studentDetail")} />
        </div>
      </div>

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

      {view === "student" && (
        <div className="min-w-[180px]">
          <label className="t-label mb-1 block">{t("report.studentDetail")}</label>
          <Select value={studentId ?? ""} onChange={(e) => push({ student: e.target.value })}>
            <option value="" disabled>{t("x.reportPickStudent")}</option>
            {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </div>
      )}

      {view === "overview" && (
        <div>
          <label className="t-label mb-1 block">{t("report.order")}</label>
          <div className="flex gap-1.5">
            <SortChip v="roll" label={t("report.byRoll")} />
            <SortChip v="marks" label={t("report.byMarks")} />
          </div>
        </div>
      )}

      <Button variant="subtle" className="ml-auto"
        onClick={() => xlsx ? downloadXlsx(xlsx.filename, xlsx.headers, xlsx.rows, xlsx.sheetName) : window.print()}>
        <ReportIcon size={16} /> {xlsx ? t("x.downloadExcel") : t("x.download")}
      </Button>
    </div>
  );
}
