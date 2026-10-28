/* eslint-disable @next/next/no-img-element -- local preview of a picked file (blob URL) */
"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import type { SectionOpt } from "@/lib/data/scope";
import { createAnnouncement, signAnnouncementUpload } from "@/app/dashboard/announcements/actions";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function AnnouncementForm({ sections, allowSchool }: { sections: SectionOpt[]; allowSchool: boolean }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"school" | "sections">(allowSchool ? "school" : "sections");
  // A teacher with a single section has nothing to choose; start with it ticked.
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(sections.length === 1 ? [sections[0].id] : []));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Sections grouped by class, in class order, for the tick list.
  const classes = useMemo(() => {
    const m = new Map<number, { id: number; name: string; level: number; sections: SectionOpt[] }>();
    for (const s of sections) {
      const c = m.get(s.class_id) ?? { id: s.class_id, name: s.class_name, level: s.class_level, sections: [] };
      c.sections.push(s);
      m.set(s.class_id, c);
    }
    return [...m.values()].sort((a, b) => a.level - b.level);
  }, [sections]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function toggleSection(id: number) {
    setChosen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleClass(ids: number[], on: boolean) {
    setChosen((cur) => { const n = new Set(cur); for (const id of ids) { if (on) n.add(id); else n.delete(id); } return n; });
  }

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr(t("announce.imageWrongType")); return; }
    if (f.size > MAX_IMAGE_BYTES) { setErr(t("announce.imageTooBig")); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function removeFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  // Straight from this browser to Cloudinary with a one-time server signature.
  async function uploadImage(f: File): Promise<string> {
    const ticket = await signAnnouncementUpload();
    if (!ticket.ok) throw new Error(ticket.error);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("api_key", ticket.apiKey);
    fd.append("timestamp", String(ticket.timestamp));
    fd.append("signature", ticket.signature);
    fd.append("folder", ticket.folder);
    fd.append("allowed_formats", ticket.allowedFormats);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.secure_url) throw new Error(t("announce.imageUploadFailed"));
    return json.secure_url as string;
  }

  function submit() {
    setDone(false); setErr(null);
    if (audience === "sections" && chosen.size === 0) { setErr(t("announce.needSection")); return; }
    start(async () => {
      try {
        let imageUrl: string | null = null;
        if (file) { setStage("uploading"); imageUrl = await uploadImage(file); }
        setStage("saving");
        const res = await createAnnouncement({
          title, body, audience,
          sectionIds: audience === "sections" ? [...chosen] : undefined,
          imageUrl,
        });
        if (!res.ok) { setErr(res.error ?? t("common.error")); return; }
        setTitle(""); setBody(""); removeFile();
        if (sections.length !== 1) setChosen(new Set());
        setDone(true); setTimeout(() => setDone(false), 2500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setStage("idle");
      }
    });
  }

  const allIds = sections.map((s) => s.id);
  const busyLabel = stage === "uploading" ? t("announce.uploading") : t("common.saving");

  return (
    <Card>
      <CardHeader eyebrow={t("announce.new")} title="" />
      <CardBody className="space-y-3 pt-3">
        <Field label={t("common.subject")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("x.announceTitle")} />
        </Field>
        <Field label={t("feedback.message")}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        </Field>

        {/* Who it is for */}
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink-900">{t("announce.sendTo")}</legend>
          <div className="space-y-1.5">
            {allowSchool && (
              <label className="flex items-center gap-2 text-[14px] text-ink-900">
                <input type="radio" name="audience" checked={audience === "school"} onChange={() => setAudience("school")} />
                {t("announce.scopeSchool")}
              </label>
            )}
            <label className="flex items-center gap-2 text-[14px] text-ink-900">
              <input type="radio" name="audience" checked={audience === "sections"} onChange={() => setAudience("sections")} />
              {t("announce.chooseSections")}
            </label>
          </div>

          {audience === "sections" && (
            <div className="mt-2 rounded-sm border border-hair">
              <div className="flex items-center justify-between border-b border-hair bg-[#fafafa] px-2.5 py-1.5 text-[12px]">
                <span className="font-semibold text-ink-900">{t("announce.chosenCount", { n: chosen.size })}</span>
                <span className="flex gap-3">
                  <button type="button" className="font-medium text-[#0F6CBD] hover:underline" onClick={() => setChosen(new Set(allIds))}>{t("leave.selectAll")}</button>
                  <button type="button" className="font-medium text-[#0F6CBD] hover:underline" onClick={() => setChosen(new Set())}>{t("announce.clear")}</button>
                </span>
              </div>
              <ul className="max-h-64 divide-y divide-hair overflow-y-auto">
                {classes.map((c) => {
                  const ids = c.sections.map((s) => s.id);
                  const n = ids.filter((id) => chosen.has(id)).length;
                  return (
                    <li key={c.id} className="px-2.5 py-2">
                      <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                        <input type="checkbox" checked={n === ids.length}
                          ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }}
                          onChange={(e) => toggleClass(ids, e.target.checked)} />
                        {t("common.class")} {c.name}
                      </label>
                      {ids.length > 1 && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                          {c.sections.map((s) => (
                            <label key={s.id} className="flex items-center gap-1.5 text-[13px] text-ink-700">
                              <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggleSection(s.id)} />
                              {s.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </fieldset>

        {/* Optional picture */}
        <div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          {preview ? (
            <div className="relative overflow-hidden rounded-sm border border-hair">
              <img src={preview} alt="" className="max-h-48 w-full object-cover" />
              <button type="button" onClick={removeFile}
                className="absolute right-2 top-2 rounded-sm border border-hair bg-white px-2 py-1 text-[12px] font-medium text-ink-900 hover:bg-panel">
                {t("announce.removeImage")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()}
              className="w-full rounded-sm border border-dashed border-hair px-3 py-3 text-[13px] font-medium text-[#0F6CBD] hover:border-[#B4D6FA] hover:bg-[#F5F9FE]">
              + {t("announce.addImage")}
            </button>
          )}
        </div>

        {err && <p className="text-[13px] font-medium text-down">{err}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending || !title || !body}>{pending ? busyLabel : t("announce.new")}</Button>
          {done && <span className={cn("text-[13px] font-medium text-up")}>{t("common.saved")}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
