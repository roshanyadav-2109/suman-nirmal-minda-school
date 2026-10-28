"use client";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { CloseIcon } from "@/components/icons";
import { checkStudentInput, type Gender, type SectionRef, type StudentInput } from "@/app/dashboard/manage/students/rules";
import type { Result } from "@/app/dashboard/manage/students/actions";

// The student's details as the form needs them (from StudentRecord).
export type FormStudent = {
  id: number;
  fullName: string;
  admissionNo: string;
  dob: string | null;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  sectionId: number | null;
  classSection: string | null;
  rollNo: number | null;
  guardian: { id: number; fullName: string; relation: string | null; phone: string | null; email: string | null } | null;
};

const RELATIONS = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Brother", "Sister"];

function blank(sectionId: number | null): StudentInput {
  return {
    id: null, fullName: "", admissionNo: "", dob: "", gender: "", sectionId, rollNo: "", studentEmail: "", studentPhone: "",
    guardian: { id: null, fullName: "", relation: "", phone: "", email: "" },
  };
}

function fromStudent(s: FormStudent): StudentInput {
  return {
    id: s.id,
    fullName: s.fullName,
    admissionNo: s.admissionNo,
    dob: s.dob ?? "",
    gender: s.gender ?? "",
    sectionId: s.sectionId,
    rollNo: s.rollNo == null ? "" : String(s.rollNo),
    studentEmail: s.email ?? "",
    studentPhone: s.phone ?? "",
    guardian: {
      id: s.guardian?.id ?? null,
      fullName: s.guardian?.fullName ?? "",
      relation: s.guardian?.relation ?? "",
      phone: s.guardian?.phone ?? "",
      email: s.guardian?.email ?? "",
    },
  };
}

// Add or edit one student. `limited` is the class teacher's version: the
// admission no and class are shown but cannot be changed.
export function StudentForm({
  student, sections, defaultSectionId = null, limited = false, onSave, onDone, onCancel,
}: {
  student: FormStudent | null;
  sections: SectionRef[];
  defaultSectionId?: number | null;
  limited?: boolean;
  onSave: (input: StudentInput) => Promise<Result>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [v, setV] = useState<StudentInput>(() => (student ? fromStudent(student) : blank(defaultSectionId)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof StudentInput>(k: K, val: StudentInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const setG = (k: keyof StudentInput["guardian"], val: string) => setV((p) => ({ ...p, guardian: { ...p.guardian, [k]: val } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkStudentInput(v, limited);
    if (problem) { setError(problem); return; }
    setError(null);
    start(async () => {
      const res = await onSave(v);
      if (!res.ok) { setError(res.error); return; }
      onDone();
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  // A class teacher can't add a parent record, only correct the one on file.
  const parentLocked = limited && !v.guardian.id;

  return (
    <form onSubmit={submit} noValidate>
      <h3 className="t-h3 text-ink-900">Student</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name" htmlFor={`${id}-name`}>
            <Input id={`${id}-name`} value={v.fullName} autoFocus maxLength={120}
              onChange={(e) => set("fullName", e.target.value)} />
          </Field>
        </div>
        <Field label="Admission no" htmlFor={`${id}-adm`} hint={limited ? "Only the office can change this." : undefined}>
          <Input id={`${id}-adm`} value={v.admissionNo} disabled={limited} maxLength={40}
            onChange={(e) => set("admissionNo", e.target.value)} />
        </Field>
        <Field label="Class and section" htmlFor={`${id}-sec`} hint={limited ? "Only the office can change this." : undefined}>
          {limited ? (
            <Input id={`${id}-sec`} value={student?.classSection ?? "—"} disabled />
          ) : (
            <Select id={`${id}-sec`} value={v.sectionId ?? ""} onChange={(e) => set("sectionId", Number(e.target.value) || null)}>
              <option value="">Choose…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date of birth" htmlFor={`${id}-dob`}>
          <Input id={`${id}-dob`} type="date" value={v.dob} max={today} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Gender" htmlFor={`${id}-gender`}>
          <Select id={`${id}-gender`} value={v.gender} onChange={(e) => set("gender", e.target.value as Gender | "")}>
            <option value="">Not given</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Roll no" htmlFor={`${id}-roll`}>
          <Input id={`${id}-roll`} inputMode="numeric" value={v.rollNo} maxLength={4}
            onChange={(e) => set("rollNo", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Student's email" htmlFor={`${id}-semail`} hint="The student signs in with Google using this email.">
          <Input id={`${id}-semail`} type="email" value={v.studentEmail} maxLength={120}
            onChange={(e) => set("studentEmail", e.target.value)} />
        </Field>
        <Field label="Student's phone" htmlFor={`${id}-sphone`}>
          <Input id={`${id}-sphone`} type="tel" inputMode="tel" value={v.studentPhone} maxLength={20}
            onChange={(e) => set("studentPhone", e.target.value)} />
        </Field>
      </div>

      <h3 className="t-h3 mt-6 text-ink-900">Parent or guardian</h3>
      {parentLocked && (
        <p className="mt-1 text-[13px] text-ink-500">No parent is on record for this student yet. Please ask the school office to add one.</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-pname`}>
          <Input id={`${id}-pname`} value={v.guardian.fullName} disabled={parentLocked} maxLength={120}
            onChange={(e) => setG("fullName", e.target.value)} />
        </Field>
        <Field label="Relation" htmlFor={`${id}-rel`}>
          <Input id={`${id}-rel`} list={`${id}-rel-list`} value={v.guardian.relation} disabled={parentLocked} maxLength={40}
            placeholder="Father, Mother…" onChange={(e) => setG("relation", e.target.value)} />
          <datalist id={`${id}-rel-list`}>
            {RELATIONS.map((r) => <option key={r} value={r} />)}
          </datalist>
        </Field>
        <Field label="Phone" htmlFor={`${id}-phone`}>
          <Input id={`${id}-phone`} type="tel" inputMode="tel" value={v.guardian.phone} disabled={parentLocked} maxLength={20}
            onChange={(e) => setG("phone", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`} hint="The parent signs in with Google using this email.">
          <Input id={`${id}-email`} type="email" value={v.guardian.email} disabled={parentLocked} maxLength={120}
            onChange={(e) => setG("email", e.target.value)} />
        </Field>
      </div>

      {error && <p role="alert" className="mt-4 text-[13px] font-medium text-down">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : student ? "Save changes" : "Add student"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}

// A simple pop-up panel over the page. Closes on Escape or the close button.
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(32,32,32,0.28)] p-4 sm:p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="w-full max-w-2xl rounded-md border border-hair bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-hair px-5 py-3">
          <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-sm p-1 text-ink-500 hover:bg-panel hover:text-ink-900">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
