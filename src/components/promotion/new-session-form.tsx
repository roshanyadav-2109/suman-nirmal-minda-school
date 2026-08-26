"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { createAcademicYear } from "@/app/(app)/promotion/actions";

// Office: create the next academic session, then promote pupils into it.
export function NewSessionForm({ name, start, end }: { name: string; start: string; end: string }) {
  const t = useT();
  const router = useRouter();
  const [n, setN] = useState(name);
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [pending, startT] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    startT(async () => {
      const res = await createAcademicYear({ name: n.trim(), startDate: s, endDate: e });
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <div className="text-[15px] font-semibold text-ink-900">{t("x.newSession")}</div>
          <p className="mt-1 text-[13px] text-ink-500">{t("x.newSessionHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("x.sessionName")}><Input value={n} onChange={(ev) => setN(ev.target.value)} placeholder="2026-27" /></Field>
          <Field label={t("leave.from")}><Input type="date" value={s} onChange={(ev) => setS(ev.target.value)} /></Field>
          <Field label={t("leave.to")}><Input type="date" value={e} onChange={(ev) => setE(ev.target.value)} /></Field>
        </div>
        {err && <p className="text-[13px] text-down">{err}</p>}
        <Button onClick={submit} disabled={pending || !n.trim() || !s || !e}>
          {pending ? t("common.saving") : t("x.createSession")}
        </Button>
      </CardBody>
    </Card>
  );
}
