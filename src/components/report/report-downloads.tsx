"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExcelIcon, PrintIcon, ReportIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { downloadWorkbook, downloadXlsx, type XlsxSheet } from "@/lib/xlsx";
import { downloadPdf, downloadPdfBook, type PdfDoc } from "@/lib/pdf";
import { studentCardPdf } from "@/lib/pdf-report";
import { classReportCards, type CardsRequest } from "@/app/dashboard/reports/actions";
import { cn } from "@/lib/utils";

// Excel export: a single sheet (class list) or, with `sheets`, a workbook.
export type XlsxExport = {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null)[][];
  sheets?: XlsxSheet[];
};

// Everything needed to make every pupil's report card for the class on view.
export type ClassCardsExport = CardsRequest & { section: string; period: string; yearName: string };

// The report's download buttons: Excel (lists only), PDF (every report), the
// whole class's report cards in one PDF (class view), and Print.
export function ReportDownloads({ xlsx, pdf, cards, className }: { xlsx?: XlsxExport; pdf?: PdfDoc; cards?: ClassCardsExport; className?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cardsBusy, setCardsBusy] = useState(false);
  const [cardsNote, setCardsNote] = useState<string | null>(null);

  async function saveCards() {
    if (!cards || cardsBusy) return;
    setCardsBusy(true); setCardsNote(null);
    try {
      const res = await classReportCards(cards);
      if (!res.ok) { setCardsNote(res.error); return; }
      if (!res.cards.length) { setCardsNote("There are no students in this class."); return; }
      const kind = cards.type;
      const specs = res.cards.map((c) => studentCardPdf(c, { kind, period: cards.period, yearName: cards.yearName, section: cards.section }));
      await downloadPdfBook(specs, `Report cards ${cards.section} ${cards.period}`);
    } catch (e) {
      console.error(e);
      setCardsNote("The report cards could not be made. Please try again.");
    } finally { setCardsBusy(false); }
  }

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
      {cards && (
        <Button variant="subtle" onClick={saveCards} disabled={cardsBusy} aria-busy={cardsBusy}
          title="One PDF with every student's report card, one per page">
          <ReportIcon size={18} /> {cardsBusy ? "Making report cards…" : "All report cards"}
        </Button>
      )}
      <Button variant="ghost" onClick={() => window.print()}>
        <PrintIcon size={18} /> Print
      </Button>
      {cardsNote && <span role="alert" className="w-full text-right text-[12px] text-down">{cardsNote}</span>}
      {failed && <span role="alert" className="w-full text-right text-[12px] text-down">The PDF could not be made. Please try again, or use Print.</span>}
    </div>
  );
}
