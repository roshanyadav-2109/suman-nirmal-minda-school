"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { Dialog, StudentForm, type FormStudent } from "@/components/students/student-form";
import { saveStudent, updateStudentDetails } from "@/app/(app)/manage/students/actions";
import type { SectionRef } from "@/app/(app)/manage/students/rules";

type RosterItem = { id: number; name: string; admissionNo: string; roll: number | null };

// A section's students as cards. When the viewer may edit (the class teacher
// of this section, or the office) each card gets an Edit button.
export function RosterGrid({
  roster, records, sectionId, yearId, mode, sections,
}: {
  roster: RosterItem[];
  records: FormStudent[];
  sectionId: number;
  yearId: number;
  mode: "none" | "teacher" | "office";
  sections: SectionRef[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FormStudent | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const byId = new Map(records.map((r) => [r.id, r]));

  return (
    <div>
      {note && <p role="status" className="mb-3 text-[13px] font-medium text-up">{note}</p>}
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s) => {
          const rec = byId.get(s.id);
          return (
            <div key={s.id} className="flex items-center gap-1 rounded-sm border border-hair bg-surface pr-1.5 transition-colors hover:border-[#0F6CBD]">
              <Link prefetch={false} href={`/progress?studentId=${s.id}&section=${sectionId}&year=${yearId}`}
                className="group flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-700 tabular">{s.roll ?? "–"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{s.name}</span>
                  <span className="block truncate text-[11px] text-muted tabular">{s.admissionNo}</span>
                </span>
                <ArrowRightIcon size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900" />
              </Link>
              {mode !== "none" && rec && (
                <button type="button" onClick={() => { setNote(null); setEditing(rec); }}
                  className="shrink-0 rounded-sm px-2 py-1 text-[12px] font-medium text-[#0F6CBD] hover:bg-[#EBF3FC]"
                  aria-label={`Edit ${s.name}`}>
                  Edit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <Dialog title={`Edit ${editing.fullName}`} onClose={() => setEditing(null)}>
          <StudentForm
            student={editing}
            sections={sections}
            limited={mode === "teacher"}
            onSave={mode === "office" ? saveStudent : updateStudentDetails}
            onCancel={() => setEditing(null)}
            onDone={() => { setEditing(null); setNote("Changes saved."); router.refresh(); }}
          />
        </Dialog>
      )}
    </div>
  );
}
