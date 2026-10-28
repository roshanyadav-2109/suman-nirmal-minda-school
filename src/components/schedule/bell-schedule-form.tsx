"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CheckIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Period } from "@/components/schedule/shared";
import { saveBellSchedule, type PeriodInput } from "@/app/dashboard/schedule/actions";

// Office: the school's bell times (names and start/end of each period).
export function BellScheduleForm({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PeriodInput[]>(() =>
    periods.map((p) => ({ periodNo: p.period_no, label: p.label, start: p.start_time, end: p.end_time, isBreak: p.is_break })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<PeriodInput>) => {
    setMsg(null);
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  function add() {
    setMsg(null);
    setRows((r) => {
      const next = Math.max(0, ...r.map((x) => x.periodNo)) + 1;
      const last = r[r.length - 1];
      return [...r, { periodNo: next, label: `Period ${r.filter((x) => !x.isBreak).length + 1}`, start: last?.end ?? "08:00", end: "", isBreak: false }];
    });
  }

  function remove(i: number) {
    setMsg(null);
    setRows((r) => r.filter((_, j) => j !== i));
  }

  function save() {
    const removed = periods.filter((p) => !rows.some((r) => r.periodNo === p.period_no));
    if (removed.length && !window.confirm(`Removing ${removed.map((p) => p.label).join(", ")} also clears it from every class's timetable. Continue?`)) return;
    setMsg(null);
    start(async () => {
      const res = await saveBellSchedule(rows);
      if (res.ok) { setMsg({ ok: true, text: "Bell times saved." }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <Card>
      <CardHeader eyebrow="Bell times" title="The same for every class" />
      <CardBody className="space-y-3">
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.periodNo} className={cn("grid grid-cols-2 gap-2 rounded-sm border border-hair p-2 sm:grid-cols-[1fr_120px_120px_auto_auto] sm:items-center", r.isBreak && "bg-[#fafafa]")}>
              <Input aria-label="Name" className="col-span-2 sm:col-span-1" value={r.label} maxLength={40}
                placeholder="Period 1 or Lunch" onChange={(e) => set(i, { label: e.target.value })} />
              <Input aria-label="Starts at" type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} />
              <Input aria-label="Ends at" type="time" value={r.end} onChange={(e) => set(i, { end: e.target.value })} />
              <label className="flex items-center gap-2 text-[13px] text-ink-700">
                <input type="checkbox" checked={r.isBreak} onChange={(e) => set(i, { isBreak: e.target.checked })} />
                Break
              </label>
              <Button size="sm" variant="ghost" onClick={() => remove(i)} disabled={rows.length <= 1}>Remove</Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="subtle" size="sm" onClick={add} disabled={rows.length >= 20}><PlusIcon size={14} />Add a period</Button>
          <Button size="sm" onClick={save} disabled={pending}><CheckIcon size={14} />{pending ? "Saving…" : "Save bell times"}</Button>
          {msg && <span className={cn("text-[13px] font-medium", msg.ok ? "text-up" : "text-down")}>{msg.text}</span>}
        </div>
        <p className="text-[12px] text-ink-500">Tick &quot;Break&quot; for short breaks and lunch. No lessons are put in a break.</p>
      </CardBody>
    </Card>
  );
}
