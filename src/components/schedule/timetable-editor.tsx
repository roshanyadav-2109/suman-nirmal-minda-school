"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { DAYS, cellKey, fmtRange, tintFor, toggleCls, type Named, type Period, type SlotRow } from "@/components/schedule/shared";
import { saveTimetable, loadSectionForCopy, type CellInput } from "@/app/(app)/schedule/actions";

type Cell = { subjectId: number | null; staffId: number | null; room: string };
type Cells = Record<string, Cell>;

const EMPTY: Cell = { subjectId: null, staffId: null, room: "" };
const isFilled = (c: Cell | undefined) => !!c && (c.subjectId != null || c.staffId != null);
const same = (a: Cell | undefined, b: Cell | undefined) =>
  (a?.subjectId ?? null) === (b?.subjectId ?? null) &&
  (a?.staffId ?? null) === (b?.staffId ?? null) &&
  (a?.room ?? "").trim() === (b?.room ?? "").trim();

function toCells(slots: SlotRow[]): Cells {
  const out: Cells = {};
  for (const s of slots) out[cellKey(s.day_of_week, s.period_no)] = { subjectId: s.subject_id, staffId: s.staff_id, room: s.room ?? "" };
  return out;
}

// Office: fill in a section's week. Each cell = subject + teacher (+ room).
export function TimetableEditor({ sectionId, sectionLabel, yearId, periods, slots, subjects, bySubject, classTeacher, allStaff, otherSections }: {
  sectionId: number;
  sectionLabel: string;
  yearId: number;
  periods: Period[];
  slots: SlotRow[];
  subjects: Named[];
  bySubject: Record<number, Named[]>;
  classTeacher: Named | null;
  allStaff: Named[];
  otherSections: Named[];
}) {
  const router = useRouter();
  const initial = useMemo(() => toCells(slots), [slots]);
  const [cells, setCells] = useState<Cells>(initial);
  const [day, setDay] = useState<number>(1);
  const [copyFrom, setCopyFrom] = useState<string>("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const teaching = periods.filter((p) => !p.is_break);
  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);

  // Teachers who take this subject in this section (class teacher included).
  const allottedFor = (subjectId: number | null): Named[] => {
    const list = subjectId != null ? [...(bySubject[subjectId] ?? [])] : [];
    if (classTeacher && !list.some((p) => p.id === classTeacher.id)) list.push(classTeacher);
    return list;
  };

  const keys = new Set([...Object.keys(initial), ...Object.keys(cells)]);
  const changed = [...keys].filter((k) => !same(initial[k], cells[k]) && (isFilled(initial[k]) || isFilled(cells[k])));

  function update(k: string, patch: Partial<Cell>) {
    setMsg(null);
    setCells((cur) => ({ ...cur, [k]: { ...(cur[k] ?? EMPTY), ...patch } }));
  }

  function pickSubject(k: string, value: string) {
    if (!value) { update(k, { ...EMPTY }); return; }
    const subjectId = Number(value);
    const allotted = (subjectId != null ? bySubject[subjectId] : undefined) ?? [];
    const current = cells[k]?.staffId ?? null;
    const keep = current != null && allotted.some((p) => p.id === current);
    update(k, { subjectId, staffId: keep ? current : (allotted[0]?.id ?? null) });
  }

  function save() {
    setMsg(null);
    const upserts: CellInput[] = [];
    const deletes: { day: number; period: number }[] = [];
    for (const k of changed) {
      const [d, p] = k.split("-").map(Number);
      const c = cells[k];
      if (isFilled(c)) upserts.push({ day: d, period: p, subjectId: c.subjectId, staffId: c.staffId, room: c.room || null });
      else deletes.push({ day: d, period: p });
    }
    start(async () => {
      const res = await saveTimetable({ sectionId, yearId, upserts, deletes });
      if (res.ok) {
        setMsg({ ok: true, text: "Timetable saved." });
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });
  }

  function copy() {
    const from = Number(copyFrom);
    if (!from) return;
    const name = otherSections.find((s) => s.id === from)?.name ?? "that class";
    if (!window.confirm(`Replace this week with ${name}'s timetable? Nothing is saved until you press "Save timetable".`)) return;
    setMsg(null);
    start(async () => {
      const res = await loadSectionForCopy({ sectionId: from, yearId });
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      const next: Cells = {};
      for (const s of res.slots) {
        // Keep a teacher only if they also teach that subject in this class.
        const ok = s.staff_id != null && allottedFor(s.subject_id).some((p) => p.id === s.staff_id);
        next[cellKey(s.day_of_week, s.period_no)] = { subjectId: s.subject_id, staffId: ok ? s.staff_id : null, room: "" };
      }
      setCells(next);
      setMsg({ ok: true, text: `Copied the subjects from ${name}. Check the teachers, then press "Save timetable".` });
    });
  }

  const renderCell = (d: number, p: Period) => {
    const k = cellKey(d, p.period_no);
    const c = cells[k] ?? EMPTY;
    const allotted = allottedFor(c.subjectId);
    const others = allStaff.filter((s) => !allotted.some((a) => a.id === s.id));
    const dirty = changed.includes(k);
    return (
      <div className={cn("space-y-1 rounded-sm p-1", dirty && "ring-1 ring-[#B4D6FA]")}
        style={c.subjectId != null ? { background: tintFor(c.subjectId) } : undefined}>
        <Select aria-label={`Subject, ${DAYS[d - 1].long}, ${p.label}`} className="h-8 px-2 pr-7 text-[12px]"
          value={c.subjectId ?? ""} onChange={(e) => pickSubject(k, e.target.value)}>
          <option value="">— Free —</option>
          {c.subjectId != null && !subjectName.has(c.subjectId) && <option value={c.subjectId}>Other subject</option>}
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select aria-label={`Teacher, ${DAYS[d - 1].long}, ${p.label}`} className="h-8 px-2 pr-7 text-[12px]"
          value={c.staffId ?? ""} onChange={(e) => update(k, { staffId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— No teacher —</option>
          {allotted.length > 0 && (
            <optgroup label="Teaches this here">
              {allotted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Any teacher">
            {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        </Select>
        <Input aria-label={`Room, ${DAYS[d - 1].long}, ${p.label}`} placeholder="Room" maxLength={40} className="h-8 px-2 text-[12px]"
          value={c.room} onChange={(e) => update(k, { room: e.target.value })} disabled={!isFilled(c)} />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader eyebrow={`Edit timetable — ${sectionLabel}`}
        action={<span className="text-[12px] text-ink-500">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes yet"}</span>} />
      <CardBody className="space-y-4">
        <p className="text-[13px] text-ink-700">
          Pick a subject and a teacher for each period. Teachers who already teach that subject in {sectionLabel} are shown first.
          Choose &quot;— Free —&quot; to clear a period.
        </p>

        {otherSections.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-[13px] text-ink-700">Copy from another class:</span>
            <Select aria-label="Copy from class" className="sm:w-48" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Choose a class</option>
              {otherSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Button size="sm" variant="subtle" disabled={!copyFrom || pending} onClick={copy}>Copy</Button>
          </div>
        )}

        {/* Wide screens: the full week */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[960px] table-fixed text-[13px]">
            <thead>
              <tr>
                <th className="w-[120px] py-2 text-left font-semibold">Period</th>
                {DAYS.map((d) => <th key={d.n} className="py-2 text-left font-semibold">{d.long}</th>)}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => p.is_break ? (
                <tr key={p.period_no} className="bg-[#fafafa]">
                  <td className="py-1.5"><div className="font-medium">{p.label}</div><div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div></td>
                  <td colSpan={DAYS.length} className="py-1.5 text-center text-[12px] text-ink-500">{p.label}</td>
                </tr>
              ) : (
                <tr key={p.period_no}>
                  <td className="py-2 align-top"><div className="font-medium">{p.label}</div><div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div></td>
                  {DAYS.map((d) => <td key={d.n} className="px-1! py-1 align-top">{renderCell(d.n, p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Smaller screens: one day at a time */}
        <div className="lg:hidden">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button key={d.n} type="button" onClick={() => setDay(d.n)} aria-pressed={d.n === day}
                className={cn("h-8 rounded-sm border px-3 text-[13px] font-medium transition-colors", toggleCls(d.n === day))}>
                {d.short}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-hair rounded-md border border-hair">
            {teaching.map((p) => (
              <li key={p.period_no} className="flex flex-col gap-2 px-3 py-2 sm:flex-row">
                <div className="w-[120px] shrink-0">
                  <div className="text-[13px] font-medium text-ink-900">{p.label}</div>
                  <div className="text-[12px] text-ink-500">{fmtRange(p.start_time, p.end_time)}</div>
                </div>
                <div className="flex-1">{renderCell(day, p)}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending || changed.length === 0}>
            <CheckIcon size={16} />
            {pending ? "Saving…" : "Save timetable"}
          </Button>
          {changed.length > 0 && !pending && (
            <Button variant="ghost" onClick={() => { setCells(initial); setMsg(null); }}>Undo changes</Button>
          )}
          {msg && <span className={cn("text-[13px] font-medium", msg.ok ? "text-up" : "text-down")}>{msg.text}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
