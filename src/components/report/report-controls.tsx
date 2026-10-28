"use client";
import { useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { ReportDownloads, type XlsxExport } from "@/components/report/report-downloads";
import type { PdfDoc } from "@/lib/pdf";
import { useNavigate } from "@/components/nav-progress";

export type { XlsxExport };

// Month picker for the parent / student report card, with the downloads:
// "Download PDF" saves the report card as a file, "Print" opens the print dialog
// (and Excel appears only when a multi-student `xlsx` list is supplied).
export function ReportControls({ month, extra, xlsx, pdf }: { month: string; extra?: React.ReactNode; xlsx?: XlsxExport; pdf?: PdfDoc }) {
  const t = useT();
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();

  function setMonth(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("month", v);
    navigate(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div className="min-w-[160px]">
        <label className="t-label mb-1 block">{t("report.month")}</label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {extra}
      <ReportDownloads className="ml-auto" xlsx={xlsx} pdf={pdf} />
    </div>
  );
}
