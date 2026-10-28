"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import type { StaffRole } from "@/lib/session";
import {
  addAssignment, removeAssignment, setClassTeacher, removeClassTeacher, type ActionResult,
} from "@/app/(app)/manage/teachers/actions";

export type AssignRow = { id: number; staffId: number; sectionId: number; subjectId: number | null; isClassTeacher: boolean };
export type SectionOpt = { id: number; name: string; classId: number; className: string; classLevel: number };
export type SubjectOpt = { id: number; name: string; code: string };
type StaffOpt = { id: number; fullName: string; role: StaffRole };

type Focus = { kind: "add" | "ct"; sectionId: number } | null;
type Confirm = { kind: "remove"; id: number } | { kind: "ct-remove"; sectionId: number } | null;
type Note = { ok: boolean; text: string } | null;

const label = (s: SectionOpt) => `${s.className}-${s.name}`;

// Who teaches what, section by section, for the current year. Each section also
// has at most one class teacher; choosing a new one replaces the old one.
export function Assignments({
  yearName, staff, sections, subjects, classSubjects, rows,
}: {
  yearName: string;
  staff: StaffOpt[];
  sections: SectionOpt[];
  subjects: SubjectOpt[];
  classSubjects: [number, number][];
  rows: AssignRow[];
}) {
  const router = useRouter();
  const classes = useMemo(() => {
    const m = new Map<number, { id: number; name: string; level: number }>();
    sections.forEach((s) => m.set(s.classId, { id: s.classId, name: s.className, level: s.classLevel }));
    return [...m.values()].sort((a, b) => a.level - b.level);
  }, [sections]);

  const [cls, setCls] = useState<number>(classes[0]?.id ?? 0);
  const [sec, setSec] = useState<number>(0);
  const [teacher, setTeacher] = useState<number>(0);
  const [focus, setFocus] = useState<Focus>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  // Teachers to choose from: everyone except office and transport staff.
  const teachers = useMemo(() => staff.filter((s) => s.role !== "office" && s.role !== "transport"), [staff]);

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      setNote({ ok: true, text: okText });
      setFocus(null);
      setConfirm(null);
      router.refresh();
    });
  }

  const sectionChoices = sections.filter((s) => !cls || s.classId === cls);
  const shown = sectionChoices.filter((s) => {
    if (sec && s.id !== sec) return false;
    if (teacher) return rows.some((r) => r.sectionId === s.id && r.staffId === teacher);
    return true;
  });

  function subjectsFor(classId: number) {
    const ids = new Set(classSubjects.filter(([c]) => c === classId).map(([, s]) => s));
    return ids.size ? subjects.filter((s) => ids.has(s.id)) : subjects;
  }

  return (
    <Card>
      <CardHeader title="Who teaches what" action={<span className="text-[13px] text-ink-500">School year {yearName}</span>} />
      <CardBody>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="t-label mb-1 block" htmlFor="as-class">Class</label>
            <Select id="as-class" value={cls || ""} onChange={(e) => { setCls(Number(e.target.value) || 0); setSec(0); setFocus(null); }}>
              <option value="">All classes</option>
              {classes.map((c) => (<option key={c.id} value={c.id}>Class {c.name}</option>))}
            </Select>
          </div>
          <div>
            <label className="t-label mb-1 block" htmlFor="as-section">Section</label>
            <Select id="as-section" value={sec || ""} onChange={(e) => { setSec(Number(e.target.value) || 0); setFocus(null); }}>
              <option value="">All sections</option>
              {sectionChoices.map((s) => (<option key={s.id} value={s.id}>{label(s)}</option>))}
            </Select>
          </div>
          <div>
            <label className="t-label mb-1 block" htmlFor="as-teacher">Teacher</label>
            <Select id="as-teacher" value={teacher || ""} onChange={(e) => { setTeacher(Number(e.target.value) || 0); setFocus(null); }}>
              <option value="">All teachers</option>
              {teachers.map((s) => (<option key={s.id} value={s.id}>{s.fullName}</option>))}
            </Select>
          </div>
        </div>

        {note && (
          <p role="status" className={`mb-3 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</p>
        )}

        {shown.length === 0 ? (
          <EmptyState art={sections.length ? "no-results" : "no-sections"}
            title={sections.length ? "Nothing to show" : "No sections yet"}
            hint={sections.length
              ? (teacher ? "This teacher has no classes in what you picked." : "Try a different class or section.")
              : "Add classes and sections in “Classes & Subjects” first."} />
        ) : (
          <ul className="divide-y divide-hair">
            {shown.map((s) => {
              const sectionRows = rows.filter((r) => r.sectionId === s.id);
              const ct = sectionRows.find((r) => r.isClassTeacher) ?? null;
              const ctName = ct ? staffById.get(ct.staffId)?.fullName ?? "—" : null;
              const subjectRows = sectionRows
                .filter((r) => r.subjectId !== null && (!teacher || r.staffId === teacher))
                .sort((a, b) => (subjectById.get(a.subjectId!)?.name ?? "").localeCompare(subjectById.get(b.subjectId!)?.name ?? ""));
              const open = focus?.sectionId === s.id ? focus.kind : null;
              return (
                <li key={s.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-ink-900">{label(s)}</h3>
                      <p className="text-[13px] text-ink-700">
                        Class teacher: {ctName ? <span className="font-semibold text-ink-900">{ctName}</span> : <span className="text-ink-500">not chosen yet</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="subtle" onClick={() => { setConfirm(null); setFocus(open === "ct" ? null : { kind: "ct", sectionId: s.id }); }}>
                        {ct ? "Change class teacher" : "Make class teacher"}
                      </Button>
                      {ct && (
                        <Button size="sm" variant="ghost" onClick={() => { setFocus(null); setConfirm({ kind: "ct-remove", sectionId: s.id }); }}>
                          Remove class teacher
                        </Button>
                      )}
                      <Button size="sm" variant="subtle" onClick={() => { setConfirm(null); setFocus(open === "add" ? null : { kind: "add", sectionId: s.id }); }}>
                        <PlusIcon size={14} />Add teacher
                      </Button>
                    </div>
                  </div>

                  {confirm?.kind === "ct-remove" && confirm.sectionId === s.id && (
                    <ConfirmLine
                      text={`Remove ${ctName} as class teacher of ${label(s)}? Their subject classes stay as they are.`}
                      pending={pending}
                      onYes={() => run(() => removeClassTeacher(s.id), `${label(s)} has no class teacher now.`)}
                      onNo={() => setConfirm(null)}
                    />
                  )}

                  {open === "ct" && (
                    <ClassTeacherForm
                      key={`ct-${s.id}`}
                      teachers={teachers}
                      currentId={ct?.staffId ?? null}
                      currentName={ctName}
                      sectionLabel={label(s)}
                      pending={pending}
                      onCancel={() => setFocus(null)}
                      onSave={(staffId) => run(() => setClassTeacher({ sectionId: s.id, staffId }),
                        `${staffById.get(staffId)?.fullName ?? "The teacher"} is now class teacher of ${label(s)}.`)}
                    />
                  )}

                  {open === "add" && (
                    <AddForm
                      key={`add-${s.id}`}
                      teachers={teachers}
                      subjects={subjectsFor(s.classId)}
                      initialTeacher={teacher}
                      pending={pending}
                      onCancel={() => setFocus(null)}
                      onSave={(staffId, subjectId) => run(() => addAssignment({ staffId, sectionId: s.id, subjectId }),
                        `${staffById.get(staffId)?.fullName ?? "Teacher"} will teach ${subjectById.get(subjectId)?.name ?? "the subject"} in ${label(s)}.`)}
                    />
                  )}

                  {subjectRows.length === 0 ? (
                    <p className="mt-2 text-[13px] text-ink-500">No subject teachers added yet.</p>
                  ) : (
                    <table className="mt-3 w-full text-[14px]">
                      <thead>
                        <tr className="text-left text-[12px] text-muted">
                          <th className="py-1.5 font-semibold">Subject</th>
                          <th className="py-1.5 font-semibold">Teacher</th>
                          <th className="w-28 py-1.5 font-semibold"><span className="sr-only">Remove</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectRows.map((r) => {
                          const subj = subjectById.get(r.subjectId!)?.name ?? "—";
                          const who = staffById.get(r.staffId)?.fullName ?? "—";
                          const asking = confirm?.kind === "remove" && confirm.id === r.id;
                          return (
                            <tr key={r.id}>
                              <td className="py-1.5 text-ink-900">{subj}</td>
                              <td className="py-1.5 text-ink-900">{who}</td>
                              <td className="py-1.5 text-right">
                                {asking ? (
                                  <span className="inline-flex gap-1">
                                    <Button size="sm" variant="danger" disabled={pending}
                                      onClick={() => run(() => removeAssignment(r.id), `${who} no longer teaches ${subj} in ${label(s)}.`)}>
                                      {pending ? "Removing…" : "Yes, remove"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>No</Button>
                                  </span>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => { setFocus(null); setConfirm({ kind: "remove", id: r.id }); }}>
                                    Remove
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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

function ConfirmLine({ text, pending, onYes, onNo }: { text: string; pending: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-l-2 border-down pl-3">
      <p className="text-[13px] text-ink-900">{text}</p>
      <Button size="sm" variant="danger" disabled={pending} onClick={onYes}>{pending ? "Removing…" : "Yes, remove"}</Button>
      <Button size="sm" variant="ghost" onClick={onNo}>Cancel</Button>
    </div>
  );
}

function ClassTeacherForm({
  teachers, currentId, currentName, sectionLabel, pending, onSave, onCancel,
}: {
  teachers: StaffOpt[];
  currentId: number | null;
  currentName: string | null;
  sectionLabel: string;
  pending: boolean;
  onSave: (staffId: number) => void;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<number>(0);
  const replacing = currentId !== null && pick !== 0 && pick !== currentId;
  return (
    <div className="mt-3 border-l-2 border-[#0F6CBD] pl-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px]">
          <label className="t-label mb-1 block" htmlFor={`ct-pick-${sectionLabel}`}>New class teacher</label>
          <Select id={`ct-pick-${sectionLabel}`} value={pick || ""} onChange={(e) => setPick(Number(e.target.value) || 0)}>
            <option value="">Choose a teacher</option>
            {teachers.filter((t) => t.id !== currentId).map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
          </Select>
        </div>
        <Button size="sm" disabled={!pick || pending} onClick={() => onSave(pick)}>
          {pending ? "Saving…" : "Make class teacher"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
      {replacing && (
        <p className="mt-2 text-[13px] text-ink-700">
          {currentName} will no longer be class teacher of {sectionLabel}. A section has only one class teacher.
        </p>
      )}
    </div>
  );
}

function AddForm({
  teachers, subjects, initialTeacher, pending, onSave, onCancel,
}: {
  teachers: StaffOpt[];
  subjects: SubjectOpt[];
  initialTeacher: number;
  pending: boolean;
  onSave: (staffId: number, subjectId: number) => void;
  onCancel: () => void;
}) {
  const [staffId, setStaffId] = useState<number>(initialTeacher);
  const [subjectId, setSubjectId] = useState<number>(0);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-l-2 border-[#0F6CBD] pl-3">
      <div className="min-w-[220px]">
        <label className="t-label mb-1 block">Teacher</label>
        <Select value={staffId || ""} onChange={(e) => setStaffId(Number(e.target.value) || 0)} aria-label="Teacher">
          <option value="">Choose a teacher</option>
          {teachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
        </Select>
      </div>
      <div className="min-w-[200px]">
        <label className="t-label mb-1 block">Subject</label>
        <Select value={subjectId || ""} onChange={(e) => setSubjectId(Number(e.target.value) || 0)} aria-label="Subject">
          <option value="">Choose a subject</option>
          {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </div>
      <Button size="sm" disabled={!staffId || !subjectId || pending} onClick={() => onSave(staffId, subjectId)}>
        {pending ? "Saving…" : "Add teacher"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
    </div>
  );
}
