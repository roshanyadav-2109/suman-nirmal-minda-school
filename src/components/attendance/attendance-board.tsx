"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, type Status } from "@/components/ui/status";
import { CheckIcon } from "@/components/icons";
import { useI18n } from "@/i18n/provider";
import { fmtDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { saveDailyAttendance, type AttStatus } from "@/app/(app)/attendance/actions";

type Row = { id: number; name: string; roll: number | null };
const STATUSES: { key: AttStatus; short: string; cls: string }[] = [
  { key: "present", short: "P", cls: "bg-up text-white" },
  { key: "absent", short: "A", cls: "bg-down text-white" },
];

const statusStyle: Record<AttStatus, Status> = { present: "up", absent: "down", late: "watch", leave: "flat", holiday: "flat" };

export function AttendanceBoard({
  sectionId, yearId, date, roster, initial, summary, readOnly = false,
}: {
  sectionId: number;
  yearId: number;
  date: string;
  roster: Row[];
  initial: Record<number, AttStatus>;
  summary: Record<number, { pct: number; present: number; total: number }>;
  readOnly?: boolean;
}) {
  const { t, locale } = useI18n();
  const [marks, setMarks] = useState<Record<number, AttStatus>>(() => {
    const seed: Record<number, AttStatus> = {};
    for (const r of roster) seed[r.id] = initial[r.id] ?? "present";
    return seed;
  });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  // Whole-day holiday toggle: when on, per-student P/A can't be set and the
  // whole section is saved as "holiday" (excluded from attendance %).
  const [holiday, setHoliday] = useState(() => roster.length > 0 && roster.every((r) => initial[r.id] === "holiday"));

  const setAll = (status: AttStatus) => setMarks(Object.fromEntries(roster.map((r) => [r.id, status])));
  const below = roster
    .map((r) => ({ r, s: summary[r.id] }))
    .filter((x) => x.s && x.s.total > 0 && x.s.pct < 75);

  function save() {
    setSaved(false);
    start(async () => {
      const res = await saveDailyAttendance({
        sectionId, yearId, date,
        entries: roster.map((r) => ({ studentId: r.id, status: holiday ? "holiday" : marks[r.id] })),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader eyebrow={fmtDate(locale, date, { weekday: "long", day: "numeric", month: "long" })} title={readOnly ? t("attendance.title") : t("attendance.markToday")}
          action={readOnly ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="subtle" disabled={holiday} onClick={() => setAll("present")}>{t("attendance.markAllPresent")}</Button>
              <Button size="sm" variant="subtle" disabled={holiday} onClick={() => setAll("absent")}>{t("attendance.markAllAbsent")}</Button>
              <button type="button" onClick={() => setHoliday((v) => !v)} aria-pressed={holiday}
                className={cn("h-8 rounded-sm border px-3 text-[13px] font-medium transition-colors",
                  holiday ? "border-black bg-black text-white" : "border-hair bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}>
                {t("attendance.holiday")}
              </button>
            </div>
          )} />
        <CardBody className="pt-2">
          <ul className="divide-y divide-hair">
            {roster.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-900 tabular">{r.roll ?? "–"}</span>
                <span className="flex-1 truncate text-[14px] text-ink-900">{r.name}</span>
                {readOnly ? (
                  initial[r.id] ? (
                    <StatusPill status={statusStyle[initial[r.id]]}>{t(`attendance.${initial[r.id]}`)}</StatusPill>
                  ) : (
                    <span className="text-[13px] text-ink-900">—</span>
                  )
                ) : (
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button key={s.key} disabled={holiday} onClick={() => setMarks((m) => ({ ...m, [r.id]: s.key }))}
                        aria-pressed={!holiday && marks[r.id] === s.key}
                        className={cn("h-8 w-9 rounded-sm text-[12px] font-bold transition-colors",
                          holiday ? "cursor-not-allowed bg-panel text-ink-900 opacity-40"
                            : marks[r.id] === s.key ? s.cls : "bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}>
                        {s.short}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={save} disabled={pending}>
                <CheckIcon size={16} />
                {pending ? t("common.saving") : t("attendance.saveAttendance")}
              </Button>
              {saved && <span className="text-[13px] font-medium text-up">{t("attendance.savedFor", { date: fmtDate(locale, date) })}</span>}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Below-threshold flags */}
      <Card className={below.length ? "border-down/30" : undefined}>
        <CardHeader eyebrow={t("attendance.percent")} title={t("attendance.belowThreshold")} />
        <CardBody className="pt-2">
          {below.length ? (
            <ul className="space-y-1.5">
              {below.map(({ r, s }) => (
                <li key={r.id} className="flex items-center justify-between rounded-sm bg-down-soft px-2.5 py-1.5">
                  <span className="truncate text-[13px] text-ink-900">{r.name}</span>
                  <span className="text-[13px] font-semibold tabular text-down">{s!.pct}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-[13px] text-ink-900">{t("common.noData")}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
