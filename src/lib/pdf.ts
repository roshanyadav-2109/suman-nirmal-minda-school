// Client-side PDF writer for the Reports screen (jsPDF + jspdf-autotable).
// The page (server) describes the document as plain data — a `PdfDoc` — and a
// button in the browser turns it into a real .pdf download. jsPDF is loaded
// only when someone clicks, so it never weighs down the page itself.

import { SCHOOL } from "@/lib/school";

/** A table cell. `low: true` draws the small red triangle used for low attendance. */
export type PdfCell = string | number | null | undefined | { text: string; low?: boolean };

export type PdfBlock =
  /** Label / value pairs shown as two columns (student details, totals). */
  | { kind: "facts"; heading?: string; items: [string, string][] }
  /** A plain table. `right` lists the column indexes to right-align (numbers). */
  | { kind: "table"; heading?: string; headers: string[]; rows: PdfCell[][]; right?: number[]; widths?: Record<number, number> }
  /** One table split into groups, each with a shaded heading row (class / section). */
  | { kind: "grouped"; heading?: string; headers: string[]; groups: { label: string; rows: PdfCell[][] }[]; right?: number[]; widths?: Record<number, number> }
  /** Short lines of text (e.g. notices sent). */
  | { kind: "text"; heading?: string; lines: string[] };

export type PdfDoc = {
  filename: string;
  title: string;
  /** Lines under the title: period, section, year… */
  meta: string[];
  orientation?: "portrait" | "landscape";
  blocks: PdfBlock[];
};

const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [75, 85, 99];
const LINE: [number, number, number] = [209, 213, 219];
const HEAD_FILL: [number, number, number] = [235, 243, 252];
const HEAD_TEXT: [number, number, number] = [15, 108, 189];
const GROUP_FILL: [number, number, number] = [245, 249, 254];
const RED: [number, number, number] = [196, 49, 75];

// The built-in PDF fonts cover Western characters only; swap the few
// typographic ones we use and drop anything else so nothing prints as junk.
const clean = (s: string) =>
  s.replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, "...").replace(/[★☆]/g, "").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

const cellText = (c: PdfCell): string =>
  c == null || c === "" ? "-" : typeof c === "object" ? clean(c.text) : clean(String(c));

const safeFile = (s: string) => clean(s).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "report";

export async function downloadPdf(spec: PdfDoc) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: spec.orientation ?? "portrait", unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const title = clean(spec.title);

  // ---- First-page letterhead ----
  let y = M + 2;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(clean(SCHOOL.fullName), M, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(title, M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  for (const line of spec.meta.filter(Boolean)) { doc.text(clean(line), M, y); y += 4.5; }
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
  doc.line(M, y, pageW - M, y);
  y += 5;

  // Room for the running header on pages 2+ and the footer on every page.
  const margin = { top: M + 8, bottom: M + 4, left: M, right: M };
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const heading = (text: string | undefined) => {
    if (!text) return;
    if (y > pageH - margin.bottom - 20) { doc.addPage(); y = margin.top; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(clean(text), M, y);
    y += 3;
  };

  const baseTable = {
    margin,
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 9, textColor: INK, lineColor: LINE, lineWidth: 0.2, cellPadding: 1.8 },
    headStyles: { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontStyle: "bold" as const },
  };

  for (const b of spec.blocks) {
    heading(b.heading);
    if (b.kind === "facts") {
      autoTable(doc, {
        ...baseTable, startY: y, theme: "plain",
        body: b.items.map(([k, v]) => [clean(k), clean(v || "-")]),
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45, textColor: MUTED } },
      });
    } else if (b.kind === "text") {
      autoTable(doc, { ...baseTable, startY: y, theme: "plain", body: (b.lines.length ? b.lines : ["-"]).map((l) => [clean(l)]) });
    } else {
      const right = new Set(b.right ?? []);
      const columnStyles: Record<number, { halign?: "right"; cellWidth?: number }> = {};
      for (const i of right) columnStyles[i] = { halign: "right" };
      for (const [i, w] of Object.entries(b.widths ?? {})) columnStyles[Number(i)] = { ...columnStyles[Number(i)], cellWidth: w };
      // Long lists (whole school) use a tighter row so more pupils fit on a page.
      const compact = b.kind === "grouped";
      // Remember which body cells get the low-attendance triangle.
      const low = new Set<string>();
      type BodyRow = (string | { content: string; colSpan: number; styles: Record<string, unknown> })[];
      const body: BodyRow[] = [];
      const pushRows = (rows: PdfCell[][]) => {
        for (const r of rows) {
          r.forEach((c, ci) => { if (c && typeof c === "object" && c.low) low.add(`${body.length}:${ci}`); });
          body.push(r.map(cellText));
        }
      };
      if (b.kind === "table") pushRows(b.rows);
      else for (const g of b.groups) {
        body.push([{ content: clean(g.label), colSpan: b.headers.length, styles: { fillColor: GROUP_FILL, fontStyle: "bold", textColor: INK } }]);
        pushRows(g.rows);
      }
      autoTable(doc, {
        ...baseTable, startY: y,
        styles: compact ? { ...baseTable.styles, fontSize: 8.5, cellPadding: 1.1 } : baseTable.styles,
        head: [b.headers.map(clean)],
        body,
        columnStyles,
        showHead: "everyPage",
        didParseCell: (d) => { if (d.section === "head" && right.has(d.column.index)) d.cell.styles.halign = "right"; },
        didDrawCell: (d) => {
          if (d.section !== "body" || !low.has(`${d.row.index}:${d.column.index}`)) return;
          // Small red "down" triangle at the left of the cell, like on screen.
          const s = 2.2, cx = d.cell.x + 2.6, cy = d.cell.y + d.cell.height / 2;
          doc.setFillColor(...RED);
          doc.triangle(cx - s / 2, cy - s / 2.4, cx + s / 2, cy - s / 2.4, cx, cy + s / 2, "F");
        },
      });
    }
    y = lastY() + 7;
  }

  // ---- Running header (pages 2+) and footer with page numbers (all pages) ----
  const pages = doc.getNumberOfPages();
  const printed = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    if (i > 1) {
      doc.text(clean(`${SCHOOL.fullName} - ${title}`), M, M);
      doc.setDrawColor(...LINE); doc.line(M, M + 2, pageW - M, M + 2);
    }
    doc.setDrawColor(...LINE); doc.line(M, pageH - M + 1, pageW - M, pageH - M + 1);
    doc.text(clean(`${SCHOOL.fullName} - printed ${printed}`), M, pageH - M + 5);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - M + 5, { align: "right" });
  }

  const name = safeFile(spec.filename);
  doc.save(name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`);
}
