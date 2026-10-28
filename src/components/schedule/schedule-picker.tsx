"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { toggleCls, type Named } from "@/components/schedule/shared";

// Principal / office: look at a class-section's week or a teacher's week.
export function SchedulePicker({ mode, sections, teachers, sectionId, teacherId }: {
  mode: "section" | "teacher";
  sections: Named[];
  teachers: Named[];
  sectionId: number | null;
  teacherId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => start(() => router.push(href));

  return (
    <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-center", pending && "opacity-70")}>
      <div className="seg flex gap-1.5">
        <button type="button" aria-pressed={mode === "section"} onClick={() => go(`/schedule?section=${sectionId ?? sections[0]?.id ?? ""}`)}
          className={cn("h-10 rounded-sm border px-3 text-[13px] font-medium transition-colors", toggleCls(mode === "section"))}>
          By class
        </button>
        <button type="button" aria-pressed={mode === "teacher"} onClick={() => go(`/schedule?teacher=${teacherId ?? teachers[0]?.id ?? ""}`)}
          className={cn("h-10 rounded-sm border px-3 text-[13px] font-medium transition-colors", toggleCls(mode === "teacher"))}>
          By teacher
        </button>
      </div>
      {mode === "section" ? (
        <Select aria-label="Class" className="sm:w-56" value={sectionId ?? ""} onChange={(e) => go(`/schedule?section=${e.target.value}`)}>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      ) : (
        <Select aria-label="Teacher" className="sm:w-72" value={teacherId ?? ""} onChange={(e) => go(`/schedule?teacher=${e.target.value}`)}>
          {teachers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
    </div>
  );
}
