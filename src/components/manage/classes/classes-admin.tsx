"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";
import {
  addClass, updateClass, addSection, renameSection, deleteSection, type ActionResult,
} from "@/app/dashboard/manage/classes/actions";

type Stage = Database["public"]["Enums"]["nep_stage"];
export type ClassRow = {
  id: number;
  name: string;
  level: number;
  stage: Stage;
  sections: { id: number; name: string; pupils: number }[];
};

const STAGE_LABEL: Record<Stage, string> = {
  foundational: "Foundational",
  preparatory: "Preparatory",
  middle: "Middle",
  senior: "Senior",
};
// The usual NEP stage for a class level, used to pre-fill the form.
const stageFor = (level: number): Stage =>
  level <= 2 ? "foundational" : level <= 5 ? "preparatory" : level <= 8 ? "middle" : "senior";

type Focus =
  | { kind: "add-class" }
  | { kind: "edit-class"; id: number }
  | { kind: "add-section"; classId: number }
  | { kind: "section"; id: number }
  | null;
type Note = { ok: boolean; text: string } | null;

export function ClassesAdmin({ classes, yearName }: { classes: ClassRow[]; yearName: string | null }) {
  const router = useRouter();
  const [focus, setFocus] = useState<Focus>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      setNote({ ok: true, text: okText });
      setFocus(null);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  function choose(next: Focus) {
    setNote(null);
    setConfirmDelete(null);
    setFocus(next);
  }

  const usedLevels = new Set(classes.map((c) => c.level));
  const freeLevels = Array.from({ length: 12 }, (_, i) => i + 1).filter((l) => !usedLevels.has(l));

  return (
    <Card>
      <CardHeader
        title="Classes and sections"
        action={focus?.kind !== "add-class" && (
          <Button size="sm" onClick={() => choose({ kind: "add-class" })} disabled={!freeLevels.length}>
            <PlusIcon size={16} />Add class
          </Button>
        )}
      />
      <CardBody>
        <p className="mb-3 text-[13px] text-ink-500">
          Click a section to rename or delete it. Student numbers are for {yearName ? `school year ${yearName}` : "this year"}.
        </p>

        {note && (
          <p role="status" className={`mb-3 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</p>
        )}

        {focus?.kind === "add-class" && (
          <div className="mb-4 border-b border-hair pb-4">
            <h3 className="mb-3 text-[14px] font-semibold text-ink-900">Add a class</h3>
            <ClassForm
              freeLevels={freeLevels}
              pending={pending}
              submitLabel="Add class"
              onCancel={() => setFocus(null)}
              onSave={(v) => run(() => addClass(v), `Class ${v.name.trim()} was added. Now add its sections.`)}
            />
          </div>
        )}

        {classes.length === 0 ? (
          <EmptyState art="no-sections" title="No classes yet" hint="Use “Add class” to add the first class." />
        ) : (
          <ul className="divide-y divide-hair">
            {classes.map((c) => {
              const editing = focus?.kind === "edit-class" && focus.id === c.id;
              const addingSection = focus?.kind === "add-section" && focus.classId === c.id;
              const openSection = focus?.kind === "section" ? c.sections.find((s) => s.id === focus.id) ?? null : null;
              return (
                <li key={c.id} className="py-3 first:pt-0">
                  {editing ? (
                    <ClassForm
                      initial={c}
                      pending={pending}
                      submitLabel="Save changes"
                      onCancel={() => setFocus(null)}
                      onSave={(v) => run(() => updateClass(c.id, { name: v.name, stage: v.stage }), "Changes saved.")}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <h3 className="text-[15px] font-semibold text-ink-900">Class {c.name}</h3>
                        <span className="text-[13px] text-ink-500">Level <span className="tabular text-ink-900">{c.level}</span> · {STAGE_LABEL[c.stage]} stage</span>
                      </div>
                      <Button size="sm" variant="subtle" onClick={() => choose({ kind: "edit-class", id: c.id })}>Rename</Button>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[13px] text-ink-700">Sections:</span>
                    {c.sections.length === 0 && <span className="text-[13px] text-ink-500">none yet</span>}
                    {c.sections.map((s) => {
                      const on = openSection?.id === s.id;
                      return (
                        <button key={s.id} type="button"
                          onClick={() => choose(on ? null : { kind: "section", id: s.id })}
                          className={cn("rounded-sm border px-2.5 py-1 text-[13px] transition-colors",
                            on ? "border-[#0F6CBD] bg-[#EBF3FC] font-semibold text-[#0F6CBD]" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA]")}>
                          {s.name} <span className="tabular text-ink-900">· {s.pupils}</span>
                        </button>
                      );
                    })}
                    {!addingSection && (
                      <Button size="sm" variant="ghost" onClick={() => choose({ kind: "add-section", classId: c.id })}>
                        <PlusIcon size={14} />Add section
                      </Button>
                    )}
                  </div>

                  {addingSection && (
                    <NameForm
                      key={`add-${c.id}`}
                      label={`New section for Class ${c.name}`}
                      placeholder="e.g. E or Sci-A"
                      submitLabel="Add section"
                      pending={pending}
                      onCancel={() => setFocus(null)}
                      onSave={(name) => run(() => addSection(c.id, name), `Section ${c.name}-${name.trim()} was added.`)}
                    />
                  )}

                  {openSection && (
                    <div className="mt-3 border-l-2 border-[#0F6CBD] pl-3">
                      <NameForm
                        key={`sec-${openSection.id}`}
                        label={`Rename section ${c.name}-${openSection.name}`}
                        initial={openSection.name}
                        submitLabel="Save changes"
                        pending={pending}
                        onCancel={() => setFocus(null)}
                        onSave={(name) => run(() => renameSection(openSection.id, name), `Section renamed to ${c.name}-${name.trim()}.`)}
                        bare
                      />
                      <div className="mt-3">
                        {openSection.pupils > 0 ? (
                          <p className="text-[13px] text-ink-700">
                            This section cannot be deleted because <span className="tabular text-ink-900">{openSection.pupils}</span>{" "}
                            {openSection.pupils === 1 ? "student is" : "students are"} in it this year. Move them to another section first.
                          </p>
                        ) : confirmDelete === openSection.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] text-ink-900">
                              Delete section {c.name}-{openSection.name}? Its teacher assignments and any empty exams will be removed too.
                            </p>
                            <Button size="sm" variant="danger" disabled={pending}
                              onClick={() => run(() => deleteSection(openSection.id), `Section ${c.name}-${openSection.name} was deleted.`)}>
                              {pending ? "Deleting…" : "Yes, delete"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-down" onClick={() => setConfirmDelete(openSection.id)}>
                            Delete section
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ClassForm({
  initial, freeLevels, pending, submitLabel, onSave, onCancel,
}: {
  initial?: ClassRow;
  freeLevels?: number[];
  pending: boolean;
  submitLabel: string;
  onSave: (v: { name: string; level: number; stage: Stage }) => void;
  onCancel: () => void;
}) {
  const firstLevel = initial?.level ?? freeLevels?.[0] ?? 1;
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState(firstLevel);
  const [stage, setStage] = useState<Stage>(initial?.stage ?? stageFor(firstLevel));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, level, stage }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Class name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VI" maxLength={20} required />
        </Field>
        <Field label="Level" hint={initial ? "The level cannot be changed." : "Used to order classes and to move students up a class."}>
          {initial ? (
            <Input value={String(level)} disabled readOnly />
          ) : (
            <Select value={level} onChange={(e) => { const l = Number(e.target.value); setLevel(l); setStage(stageFor(l)); }}>
              {(freeLevels ?? []).map((l) => (<option key={l} value={l}>{l}</option>))}
            </Select>
          )}
        </Field>
        <Field label="Stage">
          <Select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
            {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => (<option key={s} value={s}>{STAGE_LABEL[s]}</option>))}
          </Select>
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}

function NameForm({
  label, initial, placeholder, submitLabel, pending, onSave, onCancel, bare,
}: {
  label: string;
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  pending: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
  bare?: boolean;
}) {
  const [name, setName] = useState(initial ?? "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(name); }}
      className={cn("flex flex-wrap items-end gap-2", !bare && "mt-3 border-l-2 border-[#0F6CBD] pl-3")}>
      <div className="min-w-[200px]">
        <Field label={label}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={20} required />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>{pending ? "Saving…" : submitLabel}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
    </form>
  );
}
