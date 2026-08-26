"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import type { SectionOpt } from "@/lib/data/scope";
import { createAnnouncement } from "@/app/(app)/announcements/actions";

export function AnnouncementForm({ sections, allowSchool }: { sections: SectionOpt[]; allowSchool: boolean }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"school" | "section">(allowSchool ? "school" : "section");
  const [sectionId, setSectionId] = useState<number | "">(sections[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    setDone(false);
    start(async () => {
      const res = await createAnnouncement({ title, body, scope, sectionId: scope === "section" ? Number(sectionId) : null });
      if (res.ok) { setTitle(""); setBody(""); setDone(true); setTimeout(() => setDone(false), 2500); }
    });
  }

  return (
    <Card>
      <CardHeader eyebrow={t("announce.new")} title="" />
      <CardBody className="space-y-3 pt-1">
        <Field label={t("common.subject")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("x.announceTitle")} />
        </Field>
        <Field label={t("feedback.message")}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.filter")}>
            <Select value={scope} onChange={(e) => setScope(e.target.value as "school" | "section")}>
              {allowSchool && <option value="school">{t("announce.scopeSchool")}</option>}
              <option value="section">{t("announce.scopeSection")}</option>
            </Select>
          </Field>
          {scope === "section" && (
            <Field label={t("common.section")}>
              <Select value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
                {sections.map((s) => (<option key={s.id} value={s.id}>{s.class_name}-{s.name}</option>))}
              </Select>
            </Field>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending || !title || !body}>{pending ? t("common.saving") : t("announce.new")}</Button>
          {done && <span className="text-[13px] font-medium text-up">{t("common.saved")}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
