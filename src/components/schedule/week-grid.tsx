"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DAYS, cellKey, fmtRange, tintFor, toggleCls, type GridCell, type GridCells, type Period } from "@/components/schedule/shared";

// Read-only week view. Wide screens: days across, periods down. Phones: one day
// at a time, picked with the day buttons.
export function WeekGrid({ periods, cells, today, note }: {
  periods: Period[];
  cells: GridCells;
  today: number; // 1 = Mon .. 7 = Sun
  note?: string;
}) {
  const [day, setDay] = useState<number>(today >= 1 && today <= 6 ? today : 1);

  return (
    <div>
      {note && (
        <p className="mb-3 rounded-sm border border-hair bg-[#fafafa] px-3 py-2 text-[13px] text-ink-700">{note}</p>
      )}

      {/* Wide screens */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr>
              <th className="w-[150px] py-2 text-left font-semibold text-ink-900">Period</th>
              {DAYS.map((d) => (
                <th key={d.n} className={cn("py-2 text-left font-semibold text-ink-900", d.n === today && "bg-[#EBF3FC]! text-[#0F6CBD]")}>
                  {d.long}
                  {d.n === today && <span className="ml-1.5 text-[11px] font-medium">(today)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) =>
              p.is_break ? (
                <tr key={p.period_no} className="bg-[#fafafa]">
                  <td className="py-1.5">
                    <div className="font-medium text-ink-900">{p.label}</div>
                    <div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div>
                  </td>
                  <td colSpan={DAYS.length} className="py-1.5 text-center text-[12px] text-ink-500">{p.label}</td>
                </tr>
              ) : (
                <tr key={p.period_no}>
                  <td className="py-2 align-top">
                    <div className="font-medium text-ink-900">{p.label}</div>
                    <div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div>
                  </td>
                  {DAYS.map((d) => {
                    const c = cells[cellKey(d.n, p.period_no)];
                    return (
                      <td key={d.n} className={cn("py-2 align-top", d.n === today && !c && "bg-[#F8FBFE]")}
                        style={c ? { background: tintFor(c.tint) } : undefined}>
                        <CellText cell={c} />
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <div className="md:hidden">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button key={d.n} type="button" onClick={() => setDay(d.n)} aria-pressed={d.n === day}
              className={cn("h-8 rounded-sm border px-3 text-[13px] font-medium transition-colors", toggleCls(d.n === day))}>
              {d.short}{d.n === today ? " •" : ""}
            </button>
          ))}
        </div>
        <div className="mb-2 text-[13px] font-semibold text-ink-900">
          {DAYS.find((d) => d.n === day)?.long}{day === today ? " (today)" : ""}
        </div>
        <ul className="divide-y divide-hair rounded-md border border-hair bg-surface">
          {periods.map((p) => {
            const c = p.is_break ? undefined : cells[cellKey(day, p.period_no)];
            return (
              <li key={p.period_no} className={cn("flex gap-3 px-3 py-2", p.is_break && "bg-[#fafafa]")}
                style={c ? { background: tintFor(c.tint) } : undefined}>
                <div className="w-[104px] shrink-0">
                  <div className="text-[13px] font-medium text-ink-900">{p.label}</div>
                  <div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {p.is_break ? <span className="text-[13px] text-ink-500">{p.label}</span> : <CellText cell={c} />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function CellText({ cell }: { cell: GridCell | undefined }) {
  if (!cell) return <span className="text-ink-500">—</span>;
  return (
    <div className="min-w-0">
      <div className="truncate text-[13px] font-medium text-ink-900" title={cell.title}>{cell.title}</div>
      {cell.sub && <div className="truncate text-[12px] text-ink-700" title={cell.sub}>{cell.sub}</div>}
      {cell.room && <div className="truncate text-[12px] text-ink-500">Room {cell.room}</div>}
    </div>
  );
}
