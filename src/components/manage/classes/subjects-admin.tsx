"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import { addSubject, updateSubject, type ActionResult } from "@/app/dashboard/manage/classes/actions";

export type SubjectRow = { id: number; name: string; code: string };
type Note = { ok: boolean; text: string } | null;

// The list of subjects taught in the school. Each has a short unique code.
export function SubjectsAdmin({ subjects }: { subjects: SubjectRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      setNote({ ok: true, text: okText });
      setAdding(false);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Subjects"
        action={!adding && (
          <Button size="sm" onClick={() => { setAdding(true); setEditing(null); setNote(null); }}>
            <PlusIcon size={16} />Add subject
          </Button>
        )}
      />
      <CardBody>
        {note && (
          <p role="status" className={`mb-3 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</p>
        )}

        {adding && (
          <div className="mb-4 border-b border-hair pb-4">
            <h3 className="mb-3 text-[14px] font-semibold text-ink-900">Add a subject</h3>
            <SubjectForm
              pending={pending}
              submitLabel="Add subject"
              onCancel={() => setAdding(false)}
              onSave={(v) => run(() => addSubject(v), `${v.name.trim()} was added. Tick the classes that study it below.`)}
            />
          </div>
        )}

        {subjects.length === 0 ? (
          <EmptyState title="No subjects yet" hint="Use “Add subject” to add the first one." />
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-2 font-semibold">Subject</th>
                <th className="py-2 font-semibold">Code</th>
                <th className="w-28 py-2 font-semibold"><span className="sr-only">Change</span></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) =>
                editing === s.id ? (
                  <tr key={s.id}>
                    <td colSpan={3} className="bg-panel py-3">
                      <SubjectForm
                        initial={s}
                        pending={pending}
                        submitLabel="Save changes"
                        onCancel={() => setEditing(null)}
                        onSave={(v) => run(() => updateSubject(s.id, v), "Changes saved.")}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td className="py-2 text-ink-900">{s.name}</td>
                    <td className="py-2 tabular text-ink-900">{s.code}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="subtle" onClick={() => { setEditing(s.id); setAdding(false); setNote(null); }}>Rename</Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

function SubjectForm({
  initial, pending, submitLabel, onSave, onCancel,
}: {
  initial?: SubjectRow;
  pending: boolean;
  submitLabel: string;
  onSave: (v: { name: string; code: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, code }); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" maxLength={60} required />
        </Field>
        <Field label="Short code" hint="Must be different for every subject.">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. MATH" maxLength={20} required />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
