"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BandChip } from "@/components/ui/status";
import { CheckIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { saveMarks, releaseAssessment } from "@/app/(app)/marks/actions";

type Row = { id: number; name: string; roll: number | null };
type Entry = { marks: number | null; absent: boolean };

function band(pct: number | null) {
  if (pct == null) return null;
  if (pct >= 91) return "A1"; if (pct >= 81) return "A2"; if (pct >= 71) return "B1"; if (pct >= 61) return "B2";
  if (pct >= 51) return "C1"; if (pct >= 41) return "C2"; if (pct >= 33) return "D"; return "E";
}

export function MarksEntry({
  assessmentId, assessmentName, maxMarks, roster, initial, published,
}: {
  assessmentId: number;
  assessmentName: string;
  maxMarks: number;
  roster: Row[];
  initial: Record<number, Entry>;
  published: boolean;
}) {
  const t = useT();
  const [releasing, startRelease] = useTransition();
  function toggleRelease() {
    startRelease(async () => { await releaseAssessment(assessmentId, !published); });
  }
  const [entries, setEntries] = useState<Record<number, Entry>>(() => {
    const seed: Record<number, Entry> = {};
    for (const r of roster) seed[r.id] = initial[r.id] ?? { marks: null, absent: false };
    return seed;
  });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setMark(id: number, raw: string) {
    const v = raw === "" ? null : Math.max(0, Math.min(maxMarks, Number(raw)));
    setEntries((e) => ({ ...e, [id]: { marks: v, absent: false } }));
  }
  function toggleAbsent(id: number) {
    setEntries((e) => ({ ...e, [id]: { marks: null, absent: !e[id].absent } }));
  }

  function save() {
    setSaved(false); setErr(null);
    start(async () => {
      const res = await saveMarks({ assessmentId, entries: roster.map((r) => ({ studentId: r.id, ...entries[r.id] })) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      else setErr(res.error ?? t("common.error"));
    });
  }

  return (
    <Card>
      <CardHeader eyebrow={t("marks.enter")} title={`${assessmentName} · ${t("marks.maxMarks", { max: maxMarks })}`}
        action={
          <div className="flex items-center gap-3">
            <span className={cn("text-[13px]", published ? "text-up" : "text-down")}>{published ? t("marks.released") : t("marks.draft")}</span>
            <Button size="sm" variant={published ? "ghost" : "primary"} disabled={releasing} onClick={toggleRelease}>
              {releasing ? t("common.saving") : published ? t("marks.unpublish") : t("marks.release")}
            </Button>
          </div>
        } />
      <CardBody className="pt-2">
        <ul className="divide-y divide-hair">
          {roster.map((r) => {
            const e = entries[r.id];
            const pct = e.marks == null ? null : Math.round((e.marks / maxMarks) * 100);
            return (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-700 tabular">{r.roll ?? "–"}</span>
                <span className="flex-1 truncate text-[14px] text-ink-900">{r.name}</span>
                <BandChip band={band(pct)} />
                <input
                  type="number" inputMode="numeric" min={0} max={maxMarks}
                  value={e.absent ? "" : e.marks ?? ""}
                  disabled={e.absent}
                  onChange={(ev) => setMark(r.id, ev.target.value)}
                  className="h-9 w-20 rounded-sm border border-hair bg-surface px-2 text-right text-[14px] tabular focus-visible:border-[rgb(37,99,235)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(37,99,235)]/30 disabled:bg-panel"
                  placeholder={String(maxMarks)}
                />
                <button onClick={() => toggleAbsent(r.id)} aria-pressed={e.absent}
                  className={cn("h-8 rounded-sm px-2 text-[12px] font-semibold", e.absent ? "bg-down text-white" : "bg-panel text-ink-500 hover:bg-[rgb(37,99,235)]/[0.05]")}>
                  {t("marks.absent")}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={pending}><CheckIcon size={16} />{pending ? t("common.saving") : t("marks.saveMarks")}</Button>
          {saved && <span className="text-[13px] font-medium text-up">{t("common.saved")}</span>}
          {err && <span className="text-[13px] font-medium text-down">{err}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
