"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { saveClassSubjects } from "@/app/dashboard/manage/classes/actions";

type Note = { ok: boolean; text: string } | null;
const keyOf = (classId: number, subjectId: number) => `${classId}:${subjectId}`;

// A tick grid: which subjects each class studies. Nothing is saved until
// "Save changes" is pressed.
export function ClassSubjectGrid({
  classes, subjects, pairs,
}: {
  classes: { id: number; name: string }[];
  subjects: { id: number; name: string }[];
  pairs: string[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => new Set(pairs));
  const [ticks, setTicks] = useState(() => new Set(pairs));
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  const add = [...ticks].filter((k) => !saved.has(k));
  const remove = [...saved].filter((k) => !ticks.has(k));
  const changes = add.length + remove.length;

  function toggle(k: string) {
    setNote(null);
    setTicks((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function toggleColumn(classId: number) {
    setNote(null);
    const keys = subjects.map((s) => keyOf(classId, s.id));
    const allOn = keys.every((k) => ticks.has(k));
    setTicks((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function save() {
    const split = (k: string) => { const [c, s] = k.split(":").map(Number); return { classId: c, subjectId: s }; };
    setNote(null);
    start(async () => {
      const res = await saveClassSubjects({ add: add.map(split), remove: remove.map(split) });
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      setSaved(new Set(ticks));
      setNote({ ok: true, text: "Changes saved." });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Subjects each class studies" />
      <CardBody>
        <p className="mb-3 text-[13px] text-ink-500">
          Tick the subjects each class studies. These are the subjects offered when marks are entered and exams are made.
          Click a class name to tick or clear its whole column.
        </p>
        {classes.length === 0 || subjects.length === 0 ? (
          <EmptyState title="Add classes and subjects first" hint="The grid appears once there is at least one class and one subject." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <th className="py-2 text-left text-[12px] font-semibold text-muted">Subject</th>
                    {classes.map((c) => (
                      <th key={c.id} className="px-1 py-1 text-center text-[12px] font-semibold">
                        <button type="button" onClick={() => toggleColumn(c.id)}
                          className="rounded-sm px-1.5 py-1 text-ink-900 hover:bg-[#EBF3FC] hover:text-[#0F6CBD]"
                          title={`Tick or clear all subjects for Class ${c.name}`}>
                          {c.name}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap py-1.5 text-ink-900">{s.name}</td>
                      {classes.map((c) => {
                        const k = keyOf(c.id, s.id);
                        const changed = ticks.has(k) !== saved.has(k);
                        return (
                          <td key={c.id} className={`py-1.5 text-center ${changed ? "bg-[#EBF3FC]" : ""}`}>
                            <input type="checkbox" checked={ticks.has(k)} onChange={() => toggle(k)}
                              aria-label={`Class ${c.name} studies ${s.name}`}
                              className="h-4 w-4 cursor-pointer accent-[#0F6CBD]" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={!changes || pending}>{pending ? "Saving…" : "Save changes"}</Button>
              <Button variant="ghost" disabled={!changes || pending} onClick={() => { setTicks(new Set(saved)); setNote(null); }}>
                Undo changes
              </Button>
              {changes > 0 && !note && (
                <span className="text-[13px] text-ink-700"><span className="tabular text-ink-900">{changes}</span> unsaved {changes === 1 ? "change" : "changes"}</span>
              )}
              {note && <span role="status" className={`text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</span>}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
