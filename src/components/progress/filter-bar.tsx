"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import type { YearOpt, SectionMeta, ClassOpt, SubjectOpt } from "@/lib/data/scope";

export function FilterBar({
  years, classes, sectionMeta, subjects, subjectsByClass, exams, examName, students, studentId, yearId, level, scopeId, subjectId,
}: {
  years: YearOpt[];
  classes: ClassOpt[];
  sectionMeta: SectionMeta[];
  subjects: SubjectOpt[];
  subjectsByClass: Record<number, SubjectOpt[]>;
  exams: string[];
  examName: string | null;
  students: { id: number; name: string }[];
  studentId: number | null;
  yearId: number;
  level: "class" | "section";
  scopeId: number;
  subjectId: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Currently chosen class — the class itself when viewing a whole class, or the
  // parent class of the chosen section.
  const currentClassId = level === "class" ? scopeId : (sectionMeta.find((s) => s.id === scopeId)?.classId ?? classes[0]?.id ?? null);
  const classSections = sectionMeta.filter((s) => s.classId === currentClassId);

  // Subjects cascade off the chosen scope: a class shows that class's subjects;
  // a section shows the subjects taught in it.
  const subjectOptions =
    level === "class"
      ? (subjectsByClass[scopeId] ?? subjects)
      : (sectionMeta.find((s) => s.id === scopeId)?.subjects ?? []);

  function push(next: URLSearchParams) {
    next.delete("studentId");
    router.push(`${pathname}?${next.toString()}`);
  }
  function setYear(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set("year", v);
    push(next);
  }
  // Downstream selections (subject/exam) are carried over on every change; the
  // server keeps them if still valid in the new scope, else falls back to "All".
  // Pick a class → whole-class view (all sections).
  function setClass(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("class", id);
    next.delete("section");
    push(next);
  }
  // "" → whole class; otherwise a specific section.
  function setSection(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) { next.set("section", value); next.delete("class"); }
    else { if (currentClassId != null) next.set("class", String(currentClassId)); next.delete("section"); }
    push(next);
  }
  function setSubject(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("subject", v); else next.delete("subject");
    push(next);
  }
  function setExam(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("exam", v); else next.delete("exam");
    push(next);
  }
  // Student picker opens one pupil's record — keep it out of push() (which clears it).
  function setStudent(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("studentId", v); else next.delete("studentId");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div className="min-w-[130px] flex-1">
        <label className="t-label mb-1 block">{t("common.year")}</label>
        <Select value={yearId} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => (<option key={y.id} value={y.id}>{y.name}{y.is_current ? " ★" : ""}</option>))}
        </Select>
      </div>
      <div className="min-w-[130px] flex-1">
        <label className="t-label mb-1 block">{t("common.class")}</label>
        <Select value={currentClassId ?? ""} onChange={(e) => setClass(e.target.value)}>
          {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </Select>
      </div>
      <div className="min-w-[130px] flex-1">
        <label className="t-label mb-1 block">{t("common.section")}</label>
        <Select value={level === "section" ? scopeId : ""} onChange={(e) => setSection(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {classSections.map((s) => (<option key={s.id} value={s.id}>{s.sectionName}{s.isClassTeacher ? " ★" : ""}</option>))}
        </Select>
      </div>
      <div className="min-w-[150px] flex-1">
        <label className="t-label mb-1 block">{t("common.subject")}</label>
        <Select value={subjectId ?? ""} onChange={(e) => setSubject(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {subjectOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </div>
      <div className="min-w-[150px] flex-1">
        <label className="t-label mb-1 block">{t("marks.assessment")}</label>
        <Select value={examName ?? ""} onChange={(e) => setExam(e.target.value)} disabled={!exams.length}>
          <option value="">{t("common.all")}</option>
          {exams.map((name) => (<option key={name} value={name}>{name}</option>))}
        </Select>
      </div>
      <div className="min-w-[150px] flex-1">
        <label className="t-label mb-1 block">{t("common.student")}</label>
        <Select value={studentId ?? ""} onChange={(e) => setStudent(e.target.value)} disabled={!students.length}>
          <option value="">{t("common.all")}</option>
          {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </div>
    </div>
  );
}
