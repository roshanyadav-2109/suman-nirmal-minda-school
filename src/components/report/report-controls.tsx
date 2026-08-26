"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ReportIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { downloadXlsx } from "@/lib/xlsx";

// When `xlsx` is supplied (multi-student class report) the download button
// exports an Excel workbook; otherwise it prints the single report to PDF.
export type XlsxExport = { filename: string; sheetName?: string; headers: string[]; rows: (string | number | null)[][] };

export function ReportControls({ month, extra, xlsx }: { month: string; extra?: React.ReactNode; xlsx?: XlsxExport }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setMonth(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("month", v);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div className="min-w-[160px]">
        <label className="t-label mb-1 block">{t("report.month")}</label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {extra}
      <Button variant="subtle" className="ml-auto"
        onClick={() => xlsx ? downloadXlsx(xlsx.filename, xlsx.headers, xlsx.rows, xlsx.sheetName) : window.print()}>
        <ReportIcon size={16} /> {xlsx ? t("x.downloadExcel") : t("x.download")}
      </Button>
    </div>
  );
}
