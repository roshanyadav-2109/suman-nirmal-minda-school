"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/field";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Dialog, StudentForm, type FormStudent } from "@/components/students/student-form";
import { BulkUpload } from "@/components/manage/students/bulk-upload";
import { saveStudent, setStudentLeft } from "@/app/dashboard/manage/students/actions";
import type { SectionRef } from "@/app/dashboard/manage/students/rules";
import { useNavigate } from "@/components/nav-progress";

export type AdminRow = FormStudent & { left: boolean };

type Open = { kind: "add" } | { kind: "edit"; student: AdminRow } | { kind: "left"; student: AdminRow } | null;

const toggleOn = "border-[#0F6CBD] bg-[#EBF3FC] font-semibold text-[#0F6CBD]";
const toggleOff = "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA]";

// The office's list of students: find, add, edit, mark as left, bulk upload.
export function StudentAdmin({
  rows, total, page, pageSize, sections, yearName,
}: {
  rows: AdminRow[];
  total: number;
  page: number;
  pageSize: number;
  sections: SectionRef[];
  yearName: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<Open>(null);
  const [bulk, setBulk] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  const sectionId = Number(params.get("section")) || 0;
  const showLeft = params.get("show") === "left";
  const filtered = Boolean(params.get("q")) || sectionId > 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function push(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, val] of Object.entries(patch)) { if (val) next.set(k, val); else next.delete(k); }
    if (!("page" in patch)) next.delete("page");
    navigate(`${pathname}?${next.toString()}`);
  }

  function done(text: string) {
    setOpen(null);
    setNote({ text, ok: true });
    router.refresh();
  }

  function markLeft(s: AdminRow, left: boolean) {
    setNote(null);
    start(async () => {
      const res = await setStudentLeft(s.id, left);
      if (!res.ok) { setOpen(null); setNote({ text: res.error, ok: false }); return; }
      done(left ? `${s.fullName} is marked as left the school.` : `${s.fullName} is back on the list of current students.`);
    });
  }

  return (
    <div className="space-y-5">
      {note && (
        <div role="status" className={cn("rounded-md border border-hair px-4 py-2.5 text-[13px] font-medium",
          note.ok ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
          {note.text}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <form className="min-w-[240px] flex-1" onSubmit={(e) => { e.preventDefault(); push({ q: q.trim() }); }}>
          <label className="t-label mb-1 block" htmlFor="stu-q">Search</label>
          <div className="flex gap-2">
            <Input id="stu-q" value={q} placeholder="Name or admission no" onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="subtle" aria-label="Search"><SearchIcon size={16} /></Button>
          </div>
        </form>
        <div className="min-w-[160px]">
          <label className="t-label mb-1 block" htmlFor="stu-sec">Class</label>
          <Select id="stu-sec" value={sectionId || ""} onChange={(e) => push({ section: e.target.value, q: q.trim() })}>
            <option value="">All classes</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
        <div className="seg flex gap-1.5" role="group" aria-label="Which students">
          <button type="button" onClick={() => push({ show: "" })}
            className={cn("h-10 rounded-sm border px-3.5 text-[14px] transition-colors", !showLeft ? toggleOn : toggleOff)}>
            Current students
          </button>
          <button type="button" onClick={() => push({ show: "left" })}
            className={cn("h-10 rounded-sm border px-3.5 text-[14px] transition-colors", showLeft ? toggleOn : toggleOff)}>
            Left the school
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="subtle" onClick={() => setBulk((b) => !b)}>{bulk ? "Close upload" : "Upload a list"}</Button>
          <Button onClick={() => { setNote(null); setOpen({ kind: "add" }); }}><PlusIcon size={16} />Add student</Button>
        </div>
      </div>

      {bulk && (
        <BulkUpload
          sections={sections}
          onImported={(text) => { setBulk(false); setNote({ text, ok: true }); router.refresh(); }}
        />
      )}

      <Card>
        <CardHeader
          title={showLeft ? `Students who left · ${yearName}` : `Students · ${yearName}`}
          action={<span className="text-[13px] text-ink-900 tabular">{total} {total === 1 ? "student" : "students"}</span>}
        />
        <CardBody className="overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState
              art={filtered ? "no-results" : "nothing-yet"}
              title={filtered ? "No students match" : showLeft ? "No one has left this year" : "No students yet"}
              hint={filtered ? "Try a different name, or choose All classes." : showLeft ? undefined : "Use Add student, or upload a list from Excel."}
            />
          ) : (
            <table className="w-full min-w-[820px] text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-ink-700">
                  <th className="py-2 font-semibold">Student</th>
                  <th className="py-2 font-semibold">Admission no</th>
                  <th className="py-2 font-semibold">Class</th>
                  <th className="py-2 font-semibold">Roll no</th>
                  <th className="py-2 font-semibold">Parent</th>
                  <th className="py-2 font-semibold">Phone</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-panel">
                    <td className="py-2 font-medium text-ink-900">{s.fullName}</td>
                    <td className="py-2 tabular text-ink-900">{s.admissionNo}</td>
                    <td className="py-2 text-ink-900">{s.classSection ?? "—"}</td>
                    <td className="py-2 tabular text-ink-900">{s.rollNo ?? "—"}</td>
                    <td className="py-2 text-ink-900">
                      {s.guardian ? <>{s.guardian.fullName}{s.guardian.relation && !s.guardian.fullName.toLowerCase().includes(s.guardian.relation.toLowerCase()) && <span className="text-ink-500"> ({s.guardian.relation})</span>}</> : "—"}
                    </td>
                    <td className="py-2 tabular text-ink-900">{s.guardian?.phone ?? "—"}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="subtle" onClick={() => { setNote(null); setOpen({ kind: "edit", student: s }); }}>Edit</Button>
                        {s.left ? (
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => markLeft(s, false)}>Bring back</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setNote(null); setOpen({ kind: "left", student: s }); }}>Left the school</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" variant="subtle" disabled={page === 0} onClick={() => push({ page: String(page - 1) })}>Previous</Button>
              <span className="text-[13px] text-ink-900 tabular">Page {page + 1} of {pages}</span>
              <Button size="sm" variant="subtle" disabled={page + 1 >= pages} onClick={() => push({ page: String(page + 1) })}>Next</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {(open?.kind === "add" || open?.kind === "edit") && (
        <Dialog title={open.kind === "add" ? "Add student" : `Edit ${open.student.fullName}`} onClose={() => setOpen(null)}>
          <StudentForm
            student={open.kind === "edit" ? open.student : null}
            sections={sections}
            defaultSectionId={sectionId || null}
            onSave={saveStudent}
            onCancel={() => setOpen(null)}
            onDone={() => done(open.kind === "add" ? "Student added." : "Changes saved.")}
          />
        </Dialog>
      )}

      {open?.kind === "left" && (
        <Dialog title="Student left the school" onClose={() => setOpen(null)}>
          <p className="text-[14px] text-ink-900">
            Mark <span className="font-semibold">{open.student.fullName}</span> ({open.student.classSection ?? "no class"}) as left the school?
          </p>
          <p className="mt-1 text-[13px] text-ink-500">
            They will no longer be listed as a current student. Their marks and attendance are kept, and you can bring them back later.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="danger" disabled={pending} onClick={() => markLeft(open.student, true)}>
              {pending ? "Saving…" : "Yes, student left the school"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={pending}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
