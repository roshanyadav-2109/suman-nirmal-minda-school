"use client";
import { useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/icons";
import { useI18n } from "@/i18n/provider";
import { intlTag } from "@/i18n/index";
import { cn } from "@/lib/utils";

export type CalItem = { date: string; kind: string; label: string };

const kindStyle: Record<string, string> = {
  holiday: "bg-up-soft text-up",
  exam: "bg-down-soft text-down",
  ptm: "bg-gold-100 text-gold-700",
  activity: "bg-watch-soft text-watch",
  other: "bg-panel text-ink-500",
  mark: "bg-gold-500 text-ink-900",
  assessment: "bg-ink-900 text-gold-100",
};

export function MonthCalendar({ items, defaultMonth }: { items: CalItem[]; defaultMonth: string }) {
  const { t, locale } = useI18n();
  const [dy, dm] = defaultMonth.split("-").map(Number);
  const [cursor, setCursor] = useState({ y: dy, m: dm - 1 }); // m: 0-based

  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) { const a = map.get(it.date) ?? []; a.push(it); map.set(it.date, a); }
    return map;
  }, [items]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlTag[locale], { weekday: "short" });
    // Monday-first
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 2024-01-01 is Monday
  }, [locale]);

  const monthLabel = new Intl.DateTimeFormat(intlTag[locale], { month: "long", year: "numeric" }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));
  const firstDow = (new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => setCursor((c) => {
    const d = new Date(Date.UTC(c.y, c.m + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-hair px-4 py-3">
        <h2 className="t-h3 text-ink-900">{monthLabel}</h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="subtle" onClick={() => move(-1)} aria-label={t("x.prevMonth")}><ArrowRightIcon size={15} className="rotate-180" /></Button>
          <Button size="sm" variant="subtle" onClick={() => move(1)} aria-label={t("x.nextMonth")}><ArrowRightIcon size={15} /></Button>
        </div>
      </div>
      <CardBody className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((w, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{w}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[76px] rounded-sm bg-panel/20" />;
            const key = `${cursor.y}-${pad(cursor.m + 1)}-${pad(day)}`;
            const dayItems = byDate.get(key) ?? [];
            return (
              <div key={i} className="min-h-[76px] rounded-sm border border-hair bg-surface p-1">
                <div className="mb-1 px-0.5 text-[12px] font-semibold tabular text-ink-700">{day}</div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map((it, j) => (
                    <div key={j} title={it.label} className={cn("truncate rounded-[4px] px-1 py-0.5 text-[10px] font-semibold leading-tight", kindStyle[it.kind] ?? kindStyle.other)}>
                      {it.label}
                    </div>
                  ))}
                  {dayItems.length > 3 && <div className="px-1 text-[10px] text-muted">+{dayItems.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-hair pt-3 text-[11px]">
          {[["exam", t("marks.assessment")], ["holiday", t("attendance.holiday")], ["ptm", t("x.ptm")], ["activity", t("announce.events")]].map(([k, lbl]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={cn("h-2.5 w-2.5 rounded-[3px]", kindStyle[k].split(" ")[0])} />
              <span className="text-ink-500">{lbl}</span>
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
