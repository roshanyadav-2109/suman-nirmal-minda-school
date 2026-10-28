"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { createExam, updateExam, deleteExam } from "@/app/(app)/manage/exams/actions";

export type ExamGroup = {
  key: string;
  classId: number;
  className: string;
  classLevel: number;
  name: string;
  terms: number[];
  dateFrom: string;
  dateTo: string;
  maxMarks: number[];
  sections: string[];
  sectionTotal: number;
  subjects: string[];
  papers: number;
  marks: number;
  papersWithMarks: number;
};
export type ClassOpt = { id: number; name: string; sectionCount: number; subjects: { id: number; name: string }[] };
type Note = { ok: boolean; text: string } | null;

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => dateFmt.format(new Date(d));
const today = () => new Date().toISOString().slice(0, 10);

export function ExamsAdmin({
  yearName, exams, classes, allSubjects,
}: {
  yearName: string;
  exams: ExamGroup[];
  classes: ClassOpt[];
  allSubjects: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [cls, setCls] = useState<number>(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  function done(text: string) {
    setNote({ ok: true, text });
    setEditing(null);
    setDeleting(null);
    router.refresh();
  }

  const shown = cls ? exams.filter((e) => e.classId === cls) : exams;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Create an exam"
          action={!creating && (
            <Button size="sm" onClick={() => { setCreating(true); setNote(null); }}>
              <PlusIcon size={16} />Create exam
            </Button>
          )}
        />
        <CardBody>
          {creating ? (
            <CreateForm
              classes={classes}
              allSubjects={allSubjects}
              initialClass={cls || classes[0]?.id || 0}
              onCancel={() => setCreating(false)}
              onCreated={(text, classId) => { setCreating(false); setCls(classId); done(text); }}
            />
          ) : (
            <p className="text-[13px] text-ink-500">
              An exam is made for a whole class at once: every section of the class gets it, for each subject you tick.
              Teachers then enter marks in Marks.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exams this year" action={<span className="text-[13px] text-ink-500">School year {yearName}</span>} />
        <CardBody>
          <div className="mb-4 max-w-xs">
            <label className="t-label mb-1 block" htmlFor="ex-class">Class</label>
            <Select id="ex-class" value={cls || ""} onChange={(e) => { setCls(Number(e.target.value) || 0); setEditing(null); setDeleting(null); }}>
              <option value="">All classes</option>
              {classes.map((c) => (<option key={c.id} value={c.id}>Class {c.name}</option>))}
            </Select>
          </div>

          {note && (
            <p role="status" className={`mb-3 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</p>
          )}

          {shown.length === 0 ? (
            <EmptyState art="no-marks" title={exams.length ? "No exams for this class yet" : "No exams this year yet"}
              hint="Use “Create exam” above to make one." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th className="py-2 font-semibold">Exam</th>
                    <th className="py-2 font-semibold">Term</th>
                    <th className="py-2 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Max marks</th>
                    <th className="py-2 font-semibold">Sections</th>
                    <th className="py-2 font-semibold">Subjects</th>
                    <th className="py-2 font-semibold">Marks entered</th>
                    <th className="py-2 font-semibold"><span className="sr-only">Change</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => {
                    if (editing === e.key) {
                      return (
                        <tr key={e.key}>
                          <td colSpan={8} className="bg-panel py-3">
                            <EditForm
                              exam={e}
                              pending={pending}
                              onCancel={() => setEditing(null)}
                              onSave={(v) => {
                                setNote(null);
                                start(async () => {
                                  const res = await updateExam({ classId: e.classId, oldName: e.name, ...v });
                                  if (!res.ok) setNote({ ok: false, text: res.error });
                                  else done(`${v.name.trim()} for Class ${e.className} was updated in all its sections.`);
                                });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    }
                    const subjectsText = e.subjects.length > 4
                      ? `${e.subjects.slice(0, 3).join(", ")} and ${e.subjects.length - 3} more`
                      : e.subjects.join(", ");
                    return (
                      <tr key={e.key} className="align-top">
                        <td className="py-2">
                          <div className="font-medium text-ink-900">{e.name}</div>
                          <div className="text-[12px] text-ink-500">Class {e.className}</div>
                        </td>
                        <td className="py-2 tabular text-ink-900">{e.terms.length ? e.terms.join(", ") : "—"}</td>
                        <td className="whitespace-nowrap py-2 tabular text-ink-900">
                          {e.dateFrom === e.dateTo ? fmt(e.dateFrom) : `${fmt(e.dateFrom)} – ${fmt(e.dateTo)}`}
                        </td>
                        <td className="py-2 tabular text-ink-900">{e.maxMarks.join(" / ")}</td>
                        <td className="py-2 text-ink-900">
                          {e.sections.join(", ")}
                          {e.sections.length < e.sectionTotal && (
                            <div className="text-[12px] text-ink-500">{e.sections.length} of {e.sectionTotal} sections</div>
                          )}
                        </td>
                        <td className="py-2 text-ink-900" title={e.subjects.join(", ")}>{subjectsText}</td>
                        <td className="py-2">
                          <div className="tabular text-ink-900">{e.marks}</div>
                          <div className="text-[12px] text-ink-500">in {e.papersWithMarks} of {e.papers} papers</div>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button size="sm" variant="subtle" onClick={() => { setEditing(e.key); setDeleting(null); setNote(null); }}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setDeleting(deleting === e.key ? null : e.key); setEditing(null); setNote(null); }}>Delete</Button>
                          </div>
                          {deleting === e.key && (
                            <div className="mt-2 min-w-[220px] text-[13px]">
                              {e.marks > 0 ? (
                                <p className="text-ink-700">
                                  This exam cannot be deleted because marks have already been entered for it. You can still rename it or change its date.
                                </p>
                              ) : (
                                <>
                                  <p className="text-ink-900">
                                    Delete {e.name} for Class {e.className}? It will be removed from all {e.sections.length} sections and {e.subjects.length} subjects.
                                  </p>
                                  <div className="mt-2 flex gap-1.5">
                                    <Button size="sm" variant="danger" disabled={pending}
                                      onClick={() => {
                                        setNote(null);
                                        start(async () => {
                                          const res = await deleteExam({ classId: e.classId, name: e.name });
                                          if (!res.ok) setNote({ ok: false, text: res.error });
                                          else done(`${e.name} for Class ${e.className} was deleted.`);
                                        });
                                      }}>
                                      {pending ? "Deleting…" : "Yes, delete"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CreateForm({
  classes, allSubjects, initialClass, onCancel, onCreated,
}: {
  classes: ClassOpt[];
  allSubjects: { id: number; name: string }[];
  initialClass: number;
  onCancel: () => void;
  onCreated: (text: string, classId: number) => void;
}) {
  const [classId, setClassId] = useState(initialClass);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("1");
  const [max, setMax] = useState("20");
  const [date, setDate] = useState(today);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cls = classes.find((c) => c.id === classId) ?? null;
  const usingAll = !!cls && cls.subjects.length === 0;
  const subjects = cls ? (usingAll ? allSubjects : cls.subjects) : [];

  function chooseClass(id: number) {
    setClassId(id);
    setPicked(new Set()); // subjects differ from class to class
    setErr(null);
  }

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    setErr(null);
    if (!cls) { setErr("Please choose a class."); return; }
    if (!name.trim()) { setErr("Please type the exam name."); return; }
    if (!picked.size) { setErr("Please tick at least one subject."); return; }
    start(async () => {
      const res = await createExam({ classId: cls.id, name: name.trim(), term: Number(term), max: Number(max), date, subjectIds: [...picked] });
      if (!res.ok) { setErr(res.error); return; }
      if (res.created === 0) { setErr(`Class ${cls.name} already has “${name.trim()}” for the subjects you ticked.`); return; }
      const extra = res.skipped ? ` ${res.skipped} ${res.skipped === 1 ? "subject was" : "subjects were"} skipped because they already had it.` : "";
      onCreated(`${name.trim()} was created for Class ${cls.name}: ${res.created} ${res.created === 1 ? "paper" : "papers"} across its sections.${extra}`, cls.id);
    });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Class">
          <Select value={classId || ""} onChange={(e) => chooseClass(Number(e.target.value) || 0)}>
            <option value="">Choose a class</option>
            {classes.map((c) => (<option key={c.id} value={c.id}>Class {c.name}</option>))}
          </Select>
        </Field>
        <div className="lg:col-span-2">
          <Field label="Exam name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Periodic Test 1" maxLength={60} />
          </Field>
        </div>
        <Field label="Term">
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
          </Select>
        </Field>
        <Field label="Max marks">
          <Input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {cls && (
        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-3">
            <span className="t-label">Subjects</span>
            <button type="button" className="text-[13px] font-medium text-[#0F6CBD] hover:underline"
              onClick={() => setPicked(new Set(subjects.map((s) => s.id)))}>Tick all</button>
            <button type="button" className="text-[13px] font-medium text-[#0F6CBD] hover:underline"
              onClick={() => setPicked(new Set())}>Clear</button>
          </div>
          {usingAll && (
            <p className="mb-2 text-[12px] text-ink-500">
              No subjects are ticked for Class {cls.name} in “Classes &amp; Subjects”, so all subjects are shown.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => {
              const on = picked.has(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)}
                  className={cn("rounded-sm border px-3 py-1.5 text-[13px] transition-colors",
                    on ? "border-[#0F6CBD] bg-[#EBF3FC] font-semibold text-[#0F6CBD]" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA]")}>
                  {s.name}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-ink-700">
            {cls.sectionCount === 0
              ? `Class ${cls.name} has no sections yet. Add a section in “Classes & Subjects” first.`
              : `This exam will be made for all ${cls.sectionCount} ${cls.sectionCount === 1 ? "section" : "sections"} of Class ${cls.name}.`}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !cls || cls.sectionCount === 0}>{pending ? "Creating…" : "Create exam"}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
        {err && <span className="text-[13px] font-medium text-down">{err}</span>}
      </div>
    </div>
  );
}

function EditForm({
  exam, pending, onSave, onCancel,
}: {
  exam: ExamGroup;
  pending: boolean;
  onSave: (v: { name: string; date: string | null; max: number | null }) => void;
  onCancel: () => void;
}) {
  const oneDate = exam.dateFrom === exam.dateTo;
  const oneMax = exam.maxMarks.length === 1;
  const [name, setName] = useState(exam.name);
  const [date, setDate] = useState(oneDate ? exam.dateFrom : "");
  const [max, setMax] = useState(oneMax ? String(exam.maxMarks[0]) : "");

  function save() {
    // A blank date / max means "keep what each paper has now".
    onSave({ name, date: date || null, max: max ? Number(max) : null });
  }

  return (
    <div>
      <p className="mb-3 text-[13px] text-ink-700">
        Changes apply to {exam.name} in every section and subject of Class {exam.className}.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Exam name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Date" hint={oneDate ? undefined : "Subjects have different dates. Leave empty to keep them."}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Max marks" hint={oneMax ? undefined : "Subjects have different maximums. Leave empty to keep them."}>
          <Input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
