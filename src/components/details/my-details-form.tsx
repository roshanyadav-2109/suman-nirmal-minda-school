"use client";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { saveMyDetails, type MyDetails } from "@/app/dashboard/details/actions";

const LOCKED = "Only the school office can change this.";

function fmtDob(iso: string | null) {
  if (!iso) return "Not given";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const genderLabel = (g: string | null) => (g === "male" ? "Male" : g === "female" ? "Female" : g === "other" ? "Other" : "Not given");

// One read-only line: label, value, and a quiet note that the office changes it.
function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-label mb-1.5">{label}</div>
      <div className="flex h-10 items-center rounded-sm border border-hair bg-panel px-3 text-[14px] text-ink-900" title={LOCKED}>
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export function MyDetailsForm({ details }: { details: MyDetails }) {
  const [phone, setPhone] = useState(details.phone ?? "");
  const [parents, setParents] = useState(details.parents.map((p) => ({ id: p.id, phone: p.phone ?? "", email: p.email ?? "" })));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setParent = (id: number, key: "phone" | "email", value: string) =>
    setParents((list) => list.map((p) => (p.id === id ? { ...p, [key]: value } : p)));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    start(async () => {
      const res = await saveMyDetails({ phone, parents });
      setNote(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Card>
        <CardHeader title="About me" />
        <CardBody>
          <p className="mb-4 text-[13px] text-ink-700">Grey boxes can only be changed by the school office. You can change your phone number and your parents&apos; phone and email.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Locked label="Name" value={details.name} />
            <Locked label="Admission no" value={details.admissionNo} />
            <Locked label="Date of birth" value={fmtDob(details.dob)} />
            <Locked label="Gender" value={genderLabel(details.gender)} />
            <Locked label="Class and section" value={details.classSection ?? "—"} />
            <Locked label="Roll no" value={details.rollNo != null ? String(details.rollNo) : "—"} />
            <Locked label="Class teacher" value={details.classTeacher ?? "—"} />
            <Locked label="School year" value={details.schoolYear ?? "—"} />
            <Locked label="My email (I sign in with this)" value={details.email ?? "Not given"} />
            <Field label="My phone number" htmlFor="me-phone">
              <Input id="me-phone" type="tel" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="My parents" />
        <CardBody>
          {details.parents.length === 0 ? (
            <p className="text-[13px] text-ink-700">No parent is on record yet. Please ask the school office to add one.</p>
          ) : (
            <div className="space-y-5">
              {details.parents.map((p) => {
                const v = parents.find((x) => x.id === p.id)!;
                return (
                  <div key={p.id} className={cn("grid gap-4 sm:grid-cols-2", details.parents.length > 1 && "border-t border-hair pt-4 first:border-t-0 first:pt-0")}>
                    <Locked label="Name" value={p.name} />
                    <Locked label="Relation" value={p.relation ?? "—"} />
                    <Field label="Phone number" htmlFor={`p-phone-${p.id}`}>
                      <Input id={`p-phone-${p.id}`} type="tel" inputMode="tel" value={v.phone} maxLength={20} onChange={(e) => setParent(p.id, "phone", e.target.value)} />
                    </Field>
                    <Field label="Email" htmlFor={`p-email-${p.id}`} hint="Your parent signs in with Google using this email.">
                      <Input id={`p-email-${p.id}`} type="email" value={v.email} maxLength={120} onChange={(e) => setParent(p.id, "email", e.target.value)} />
                    </Field>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        {note && <p className={cn("text-[13px]", note.ok ? "text-up" : "text-down")}>{note.text}</p>}
      </div>
    </form>
  );
}
