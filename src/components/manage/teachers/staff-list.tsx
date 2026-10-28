"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons";
import type { StaffRole } from "@/lib/session";
import { addStaff, updateStaff, type ActionResult, type StaffInput } from "@/app/dashboard/manage/teachers/actions";

export type StaffRow = {
  id: number;
  fullName: string;
  role: StaffRole;
  employeeCode: string;
  email: string;
  phone: string;
  hasLogin: boolean;
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  subject_teacher: "Subject teacher",
  class_teacher: "Class teacher",
  principal: "Principal",
  office: "Office",
  transport: "Transport staff",
};

type Note = { ok: boolean; text: string } | null;

// The school's staff list. Office adds people and corrects their details here;
// a login account is a separate step.
export function StaffList({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      setNote({ ok: true, text: okText });
      setAdding(false);
      setEditing(null);
      router.refresh();
    });
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? staff.filter((s) => `${s.fullName} ${s.employeeCode} ${s.email} ${s.phone}`.toLowerCase().includes(needle))
    : staff;

  return (
    <Card>
      <CardHeader
        title="Staff"
        action={
          !adding && (
            <Button size="sm" onClick={() => { setAdding(true); setEditing(null); setNote(null); }}>
              <PlusIcon size={16} />Add teacher
            </Button>
          )
        }
      />
      <CardBody>
        <p className="mb-3 text-[13px] text-ink-500">
          Adding someone here does not give them a login. Login accounts are made separately.
        </p>

        {note && (
          <p role="status" className={`mb-3 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{note.text}</p>
        )}

        {adding && (
          <div className="mb-4 border-b border-hair pb-4">
            <h3 className="mb-3 text-[14px] font-semibold text-ink-900">Add a staff member</h3>
            <StaffForm
              pending={pending}
              submitLabel="Add teacher"
              onCancel={() => setAdding(false)}
              onSave={(input) => run(() => addStaff(input), `${input.fullName.trim()} was added.`)}
            />
          </div>
        )}

        <div className="mb-3 max-w-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by name, code, email or phone" aria-label="Find staff" />
        </div>

        {shown.length === 0 ? (
          <EmptyState art={staff.length ? "no-results" : "nothing-yet"}
            title={staff.length ? "No one matches" : "No staff added yet"}
            hint={staff.length ? "Try a different name." : "Use “Add teacher” to add the first person."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="py-2 font-semibold">Name</th>
                  <th className="py-2 font-semibold">Role</th>
                  <th className="py-2 font-semibold">Employee code</th>
                  <th className="py-2 font-semibold">Email</th>
                  <th className="py-2 font-semibold">Phone</th>
                  <th className="py-2 font-semibold">Login</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Change</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) =>
                  editing === s.id ? (
                    <tr key={s.id}>
                      <td colSpan={7} className="bg-panel py-3">
                        <StaffForm
                          initial={s}
                          pending={pending}
                          submitLabel="Save changes"
                          onCancel={() => setEditing(null)}
                          onSave={(input) => run(() => updateStaff(s.id, input), "Changes saved.")}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td className="py-2 font-medium text-ink-900">{s.fullName}</td>
                      <td className="py-2 text-ink-700">{ROLE_LABEL[s.role]}</td>
                      <td className="py-2 tabular text-ink-900">{s.employeeCode || "—"}</td>
                      <td className="py-2 text-ink-700">{s.email || "—"}</td>
                      <td className="py-2 tabular text-ink-900">{s.phone || "—"}</td>
                      <td className="py-2 text-ink-700">{s.hasLogin ? "Yes" : "Not yet"}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="subtle" onClick={() => { setEditing(s.id); setAdding(false); setNote(null); }}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function StaffForm({
  initial, pending, submitLabel, onSave, onCancel,
}: {
  initial?: StaffRow;
  pending: boolean;
  submitLabel: string;
  onSave: (input: StaffInput) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [role, setRole] = useState<StaffRole>(initial?.role ?? "subject_teacher");
  const [employeeCode, setEmployeeCode] = useState(initial?.employeeCode ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ fullName, role, employeeCode, email, phone }); }}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employee code">
          <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
