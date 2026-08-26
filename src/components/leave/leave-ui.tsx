"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { applyLeave, decideLeave } from "@/app/(app)/leave/actions";

export function LeaveForm({ students }: { students: { id: number; full_name: string }[] }) {
  const t = useT();
  const [studentId, setStudentId] = useState<number | "">(students[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    setDone(false);
    start(async () => {
      const res = await applyLeave({ studentId: Number(studentId), fromDate: from, toDate: to, reason });
      if (res.ok) { setFrom(""); setTo(""); setReason(""); setDone(true); setTimeout(() => setDone(false), 2500); }
    });
  }

  return (
    <Card>
      <CardHeader title={t("leave.apply")} />
      <CardBody className="space-y-3 pt-1">
        {students.length > 1 && (
          <Field label={t("common.student")}>
            <Select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))}>
              {students.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("leave.from")}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t("leave.to")}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Field label={t("leave.reason")}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending || !from || !to || !reason}>{pending ? t("common.saving") : t("leave.apply")}</Button>
          {done && <span className="text-[13px] font-medium text-up">{t("common.saved")}</span>}
        </div>
      </CardBody>
    </Card>
  );
}

export function LeaveDecision({ id }: { id: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="subtle" disabled={pending} onClick={() => start(async () => { await decideLeave(id, "approved"); })}>{t("leave.approve")}</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await decideLeave(id, "rejected"); })}>{t("leave.reject")}</Button>
    </div>
  );
}
