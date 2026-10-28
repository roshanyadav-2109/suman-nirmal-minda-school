"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExcelIcon, PrintIcon, ReportIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { downloadWorkbook, downloadXlsx, type XlsxSheet } from "@/lib/xlsx";
import { downloadPdf, type PdfDoc } from "@/lib/pdf";
import { cn } from "@/lib/utils";

// Excel export: a single sheet (class list) or, with `sheets`, a workbook.
export type XlsxExport = {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null)[][];
  sheets?: XlsxSheet[];
};

// The report's download buttons: Excel (lists only), PDF (every report) and Print.
export function ReportDownloads({ xlsx, pdf, className }: { xlsx?: XlsxExport; pdf?: PdfDoc; className?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function savePdf() {
    if (!pdf || busy) return;
    setBusy(true); setFailed(false);
    try { await downloadPdf(pdf); }
    catch (e) { console.error(e); setFailed(true); }
    finally { setBusy(false); }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {xlsx && (
        <Button variant="subtle"
          onClick={() => xlsx.sheets?.length ? downloadWorkbook(xlsx.filename, xlsx.sheets) : downloadXlsx(xlsx.filename, xlsx.headers, xlsx.rows, xlsx.sheetName)}>
          <ExcelIcon size={18} /> {t("x.downloadExcel")}
        </Button>
      )}
      {pdf && (
        <Button variant="subtle" onClick={savePdf} disabled={busy} aria-busy={busy}>
          <ReportIcon size={18} /> {busy ? "Making PDF…" : "Download PDF"}
        </Button>
      )}
      <Button variant="ghost" onClick={() => window.print()}>
        <PrintIcon size={18} /> Print
      </Button>
      {failed && <span role="alert" className="w-full text-right text-[12px] text-down">The PDF could not be made. Please try again, or use Print.</span>}
    </div>
  );
}
