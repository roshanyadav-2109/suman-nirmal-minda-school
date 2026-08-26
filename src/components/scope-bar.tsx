"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Input } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import type { YearOpt, SectionOpt } from "@/lib/data/scope";

// Compact filter bar for attendance/marks: year + section (+ optional date/extra).
export function ScopeBar({
  years, sections, yearId, sectionId, date, extra,
}: {
  years: YearOpt[];
  sections: SectionOpt[];
  yearId: number;
  sectionId: number;
  date?: string;
  extra?: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // A new section has its own roster/history — drop section-specific params.
    if ("section" in patch) { next.delete("date"); next.delete("student"); }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="min-w-[130px] flex-1">
        <label className="t-label mb-1 block">{t("common.year")}</label>
        <Select value={yearId} onChange={(e) => update({ year: e.target.value })}>
          {years.map((y) => (<option key={y.id} value={y.id}>{y.name}{y.is_current ? " ★" : ""}</option>))}
        </Select>
      </div>
      <div className="min-w-[150px] flex-1">
        <label className="t-label mb-1 block">{t("common.section")}</label>
        <Select value={sectionId} onChange={(e) => update({ section: e.target.value })}>
          {sections.map((s) => (<option key={s.id} value={s.id}>{s.class_name}-{s.name}</option>))}
        </Select>
      </div>
      {date !== undefined && (
        <div className="min-w-[150px] flex-1">
          <label className="t-label mb-1 block">{t("attendance.date")}</label>
          <Input type="date" value={date} onChange={(e) => update({ date: e.target.value })} />
        </div>
      )}
      {extra}
    </div>
  );
}
