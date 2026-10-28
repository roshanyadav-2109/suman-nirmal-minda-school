"use client";
import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  giveAccess, removeAccess, findStudents, parentsOf,
  type Dashboard, type StudentHit, type ParentOption,
} from "@/app/dashboard/manage/access/actions";

export type AccessRow = { kind: "staff" | "guardian" | "student"; id: number; name: string; email: string; phone: string | null; dashboard: string; signedIn: boolean };
export type StaffOption = { id: number; name: string; role: string };
export type SectionOption = { id: number; label: string };

const DASHBOARDS: { value: Dashboard; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "office", label: "Office" },
  { value: "class_teacher", label: "Class teacher" },
  { value: "subject_teacher", label: "Teacher" },
  { value: "transport", label: "Transport staff" },
  { value: "guardian", label: "Parent" },
  { value: "student", label: "Student" },
];
const STAFF: Dashboard[] = ["principal", "office", "class_teacher", "subject_teacher", "transport"];
const RELATIONS = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Brother", "Sister"];

const toggleOn = "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold";
const toggleOff = "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]";

// Manage School → Give access: a name, an email and a dashboard. The person
// then signs in with Google using that email and lands on that dashboard.
export function AccessAdmin({ rows, staff, sections }: { rows: AccessRow[]; staff: StaffOption[]; sections: SectionOption[] }) {
  const [dashboard, setDashboard] = useState<Dashboard>("subject_teacher");
  const [who, setWho] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffId, setStaffId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  const [relation, setRelation] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isStaff = STAFF.includes(dashboard);

  function pickDashboard(d: Dashboard) {
    setDashboard(d); setWho("new"); setStaffId(null); setGuardianId(null); setStudents([]); setNote(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    start(async () => {
      const res = await giveAccess({
        dashboard, email, phone, fullName,
        staffId: isStaff && who === "existing" ? staffId : null,
        sectionId: dashboard === "class_teacher" ? sectionId : null,
        studentIds: students.map((s) => s.id),
        guardianId: dashboard === "guardian" && who === "existing" ? guardianId : null,
        relation,
      });
      if (res.ok) {
        setNote({ ok: true, text: `Done. ${email.trim()} can now sign in with Google and will see the ${DASHBOARDS.find((d) => d.value === dashboard)?.label} dashboard.` });
        setFullName(""); setEmail(""); setPhone(""); setStaffId(null); setSectionId(null); setStudents([]); setGuardianId(null); setRelation(""); setWho("new");
      } else setNote({ ok: false, text: res.error });
    });
  }

  function remove(r: AccessRow) {
    start(async () => {
      const res = await removeAccess(r.kind, r.id);
      setConfirmKey(null);
      setNote(res.ok ? { ok: true, text: `${r.name} no longer has access.` } : { ok: false, text: res.error });
    });
  }

  const shown = rows.filter((r) => {
    const f = filter.trim().toLowerCase();
    return !f || r.name.toLowerCase().includes(f) || r.email.toLowerCase().includes(f) || (r.phone ?? "").includes(f) || r.dashboard.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Give someone access" />
        <CardBody>
          <p className="mb-4 text-[13px] text-ink-700">
            Type their name and email and choose their dashboard. They then sign in with <b>Continue with Google</b> using that email.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <span className="t-label mb-1.5 block">Dashboard</span>
              <div className="flex flex-wrap gap-1.5">
                {DASHBOARDS.map((d) => (
                  <button key={d.value} type="button" onClick={() => pickDashboard(d.value)} aria-pressed={dashboard === d.value}
                    className={cn("h-9 rounded-sm border px-3 text-[13px] font-medium transition-colors", dashboard === d.value ? toggleOn : toggleOff)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {(isStaff || dashboard === "guardian") && (
              <div className="seg flex gap-1.5">
                <button type="button" onClick={() => setWho("new")} aria-pressed={who === "new"}
                  className={cn("h-9 rounded-sm border px-3 text-[13px] font-medium", who === "new" ? toggleOn : toggleOff)}>
                  {isStaff ? "New person" : "New parent"}
                </button>
                <button type="button" onClick={() => setWho("existing")} aria-pressed={who === "existing"}
                  className={cn("h-9 rounded-sm border px-3 text-[13px] font-medium", who === "existing" ? toggleOn : toggleOff)}>
                  {isStaff ? "Someone already on the staff list" : "A parent already on record"}
                </button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {(dashboard === "guardian" || dashboard === "student") && (
                <div className="sm:col-span-2">
                  <StudentPicker multiple={dashboard === "guardian"} chosen={students} onChange={(s) => { setStudents(s); setGuardianId(null); }}
                    label={dashboard === "guardian" ? "Their child (add each child)" : "Which student"} />
                </div>
              )}

              {isStaff && who === "existing" ? (
                <Field label="Staff member" htmlFor="acc-staff" hint="Only staff without an email are listed.">
                  <Select id="acc-staff" value={staffId ?? ""} onChange={(e) => setStaffId(Number(e.target.value) || null)}>
                    <option value="">Choose…</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
                  </Select>
                </Field>
              ) : dashboard === "guardian" && who === "existing" ? (
                <ParentPicker studentIds={students.map((s) => s.id)} value={guardianId} onChange={setGuardianId} />
              ) : dashboard !== "student" ? (
                <Field label="Full name" htmlFor="acc-name">
                  <Input id="acc-name" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} />
                </Field>
              ) : null}

              <Field label="Email (their Google account)" htmlFor="acc-email">
                <Input id="acc-email" type="email" value={email} maxLength={120} placeholder="name@gmail.com" onChange={(e) => setEmail(e.target.value)} />
              </Field>

              <Field label="Phone number (optional)" htmlFor="acc-phone">
                <Input id="acc-phone" type="tel" inputMode="tel" value={phone} maxLength={20} placeholder="98765 43210" onChange={(e) => setPhone(e.target.value)} />
              </Field>

              {dashboard === "class_teacher" && (
                <Field label="Class teacher of" htmlFor="acc-sec">
                  <Select id="acc-sec" value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value) || null)}>
                    <option value="">Choose…</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </Field>
              )}
              {dashboard === "guardian" && who === "new" && (
                <Field label="Relation" htmlFor="acc-rel">
                  <Select id="acc-rel" value={relation} onChange={(e) => setRelation(e.target.value)}>
                    <option value="">Choose…</option>
                    {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}><PlusIcon size={16} />{pending ? "Saving…" : "Give access"}</Button>
              {note && <p className={cn("text-[13px]", note.ok ? "text-up" : "text-down")}>{note.text}</p>}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`People with access (${rows.length})`} />
        <CardBody>
          <div className="mb-3 max-w-sm">
            <Input aria-label="Find a person" placeholder="Find by name, email, phone or dashboard" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {shown.length === 0 ? (
            <EmptyState art="nothing-yet" title={rows.length ? "Nobody matches" : "Nobody has been given access yet"} hint={rows.length ? undefined : "Use the form above to give someone a dashboard."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-700">
                    <th className="py-2 font-semibold">Name</th>
                    <th className="py-2 font-semibold">Email</th>
                    <th className="py-2 font-semibold">Phone</th>
                    <th className="py-2 font-semibold">Dashboard</th>
                    <th className="py-2 font-semibold">Signed in yet</th>
                    <th className="py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const key = `${r.kind}-${r.id}`;
                    return (
                      <tr key={key}>
                        <td className="py-2 font-medium text-ink-900">{r.name}</td>
                        <td className="py-2 text-ink-900">{r.email}</td>
                        <td className="py-2 tabular text-ink-900">{r.phone || "—"}</td>
                        <td className="py-2 text-ink-900">{r.dashboard}</td>
                        <td className="py-2 text-ink-900">{r.signedIn ? "Yes" : "Not yet"}</td>
                        <td className="py-2 text-right">
                          {confirmKey === key ? (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <span className="text-[13px] text-ink-700">Remove access?</span>
                              <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(r)}>Yes, remove</Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmKey(null)}>No</Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="subtle" onClick={() => setConfirmKey(key)}>Remove access</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// Type a name or admission no, pick from the matches.
function StudentPicker({ multiple, chosen, onChange, label }: {
  multiple: boolean; chosen: StudentHit[]; onChange: (s: StudentHit[]) => void; label: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const id = setTimeout(() => { findStudents(term).then((r) => { if (live) setHits(r); }); }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [term]);

  const shown = term.length >= 2 ? hits.filter((h) => !chosen.some((c) => c.id === h.id)) : [];
  const add = (h: StudentHit) => { onChange(multiple ? [...chosen, h] : [h]); setQ(""); };

  return (
    <Field label={label} htmlFor="acc-student">
      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-sm border border-[#0F6CBD] bg-[#EBF3FC] px-2.5 py-1 text-[13px] text-[#0F6CBD]">
              {c.name}{c.classSection ? ` · ${c.classSection}` : ""}
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => onChange(chosen.filter((x) => x.id !== c.id))} className="font-semibold">×</button>
            </span>
          ))}
        </div>
      )}
      {(multiple || chosen.length === 0) && (
        <div className="relative">
          <Input id="acc-student" value={q} placeholder="Type a name or admission no" onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {shown.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-hair bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
              {shown.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => add(h)} className="block w-full px-3 py-2 text-left hover:bg-[#F5F9FE]">
                    <span className="block text-[14px] font-medium text-ink-900">{h.name}</span>
                    <span className="block text-[12px] text-ink-500">{h.admissionNo}{h.classSection ? ` · ${h.classSection}` : ""}{h.email ? ` · has access (${h.email})` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}

// The parent records already linked to the chosen children.
function ParentPicker({ studentIds, value, onChange }: { studentIds: number[]; value: number | null; onChange: (id: number | null) => void }) {
  const [options, setOptions] = useState<ParentOption[]>([]);
  const key = studentIds.join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    parentsOf(key.split(",").map(Number)).then((r) => { if (live) setOptions(r); });
    return () => { live = false; };
  }, [key]);

  const list = key ? options : [];
  return (
    <Field label="Parent on record" htmlFor="acc-parent" hint={key ? (list.length ? undefined : "No parent is on record for these children. Choose “New parent”.") : "Choose the child first."}>
      <Select id="acc-parent" value={value ?? ""} disabled={!list.length} onChange={(e) => onChange(Number(e.target.value) || null)}>
        <option value="">Choose…</option>
        {list.map((p) => (
          <option key={p.id} value={p.id} disabled={!!p.email}>
            {p.name}{p.relation ? ` (${p.relation})` : ""} · {p.children.join(", ")}{p.email ? " · already has access" : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}
