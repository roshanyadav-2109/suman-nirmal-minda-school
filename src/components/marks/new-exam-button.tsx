"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/field";
import { PlusIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { createClassExam } from "@/app/(app)/marks/actions";

// Teacher/office creates a new exam column for the class+subject. It fans out to
// every section of the class (create_class_exam), so it appears in all sections.
export function NewExamButton({ classId, subjectId, yearId, className }: {
  classId: number; subjectId: number; yearId: number; className: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("1");
  const [max, setMax] = useState("20");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function submit() {
    setErr(null); setMsg(null);
    if (!name.trim()) { setErr(t("x.examNameRequired")); return; }
    start(async () => {
      const res = await createClassExam({ classId, subjectId, name: name.trim(), term: Number(term), max: Number(max), date, yearId });
      if (res.ok) { setMsg(t("x.examCreated", { n: res.created, cls: className })); setName(""); router.refresh(); setTimeout(() => setOpen(false), 1400); }
      else setErr(res.error);
    });
  }

  if (!open) {
    return (
      <div className="mb-5 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon size={16} />{t("x.newExam")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-md border border-hair bg-surface p-4">
      <h3 className="t-h3 mb-3 text-ink-900">{t("x.newExamFor", { cls: className })}</h3>
      <p className="mb-3 text-[12px] text-muted">{t("x.newExamHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Field label={t("x.examName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("x.examNamePh")} maxLength={60} />
          </Field>
        </div>
        <Field label={t("common.term")}>
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="1">{t("x.term1")}</option>
            <option value="2">{t("x.term2")}</option>
          </Select>
        </Field>
        <Field label={t("x.maxMarks")}>
          <Input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
        <Field label={t("attendance.date")}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>{pending ? t("common.saving") : t("x.createExam")}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t("common.cancel")}</Button>
        {msg && <span className="text-[13px] font-medium text-up">{msg}</span>}
        {err && <span className="text-[13px] font-medium text-down">{err}</span>}
      </div>
    </div>
  );
}
