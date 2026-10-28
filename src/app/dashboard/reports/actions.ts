"use server";
import { getSession } from "@/lib/session";
import { roleCanOpen } from "@/lib/access";
import { getClassReportCards, getYearBounds, monthBounds, type ClassCard } from "@/lib/data/report";

export type CardsRequest = {
  sectionId: number;
  yearId: number;
  type: "monthly" | "yearly" | "exam";
  month: string;            // "YYYY-MM", for monthly
  examName: string | null;  // for exam
};

// Every pupil's report card for one section, fetched only when someone clicks
// "All report cards". Staff who can open Reports only; row security limits a
// teacher to the sections they may see.
export async function classReportCards(req: CardsRequest): Promise<{ ok: true; cards: ClassCard[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.staffId || !roleCanOpen(session.navRole, "/dashboard/reports")) {
    return { ok: false, error: "You can't make report cards for this class." };
  }
  if (req.type === "exam" && !req.examName) return { ok: false, error: "Please choose an exam first." };
  const range = req.type === "yearly" ? await getYearBounds(req.yearId) : req.type === "monthly" ? monthBounds(req.month) : null;
  const cards = await getClassReportCards(
    req.sectionId, req.yearId,
    range ? { kind: "range", start: range.start, end: range.end } : { kind: "exam", examName: req.examName! },
  );
  return { ok: true, cards };
}
