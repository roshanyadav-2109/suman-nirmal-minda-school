"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { sendFeedback, respondFeedback } from "@/app/(app)/feedback/actions";

export function FeedbackForm({ children }: { children: { id: number; full_name: string }[] }) {
  const t = useT();
  const [studentId, setStudentId] = useState<number | "">(children[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    setDone(false);
    start(async () => {
      const res = await sendFeedback({ studentId: Number(studentId), subject, body });
      if (res.ok) { setSubject(""); setBody(""); setDone(true); setTimeout(() => setDone(false), 2500); }
    });
  }

  return (
    <Card>
      <CardHeader eyebrow={t("feedback.send")} title="" />
      <CardBody className="space-y-3 pt-1">
        {children.length > 1 && (
          <Field label={t("common.student")}>
            <Select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))}>
              {children.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}
            </Select>
          </Field>
        )}
        <Field label={t("feedback.subject")}><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={t("feedback.message")}><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} /></Field>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending || !subject || !body}>{pending ? t("common.saving") : t("feedback.send")}</Button>
          {done && <span className="text-[13px] font-medium text-up">{t("feedback.sent")}</span>}
        </div>
      </CardBody>
    </Card>
  );
}

export function RespondForm({ id }: { id: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="subtle" onClick={() => setOpen(true)}>{t("feedback.respond")}</Button>;
  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t("feedback.respond")} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !text} onClick={() => start(async () => { await respondFeedback(id, text); setOpen(false); })}>{t("common.submit")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
