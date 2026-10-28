"use client";
import { useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import type { YearOpt, SectionOpt } from "@/lib/data/scope";
import { useNavigate } from "@/components/nav-progress";

// Year + section picker for the office and principal on the Reports page. Same
// as the shared ScopeBar, plus a "Whole school" choice (section=all) that lists
// every class and section at once.
export function ReportScopeBar({
  years, sections, yearId, sectionId,
}: {
  years: YearOpt[];
  sections: SectionOpt[];
  yearId: number;
  sectionId: number | "all";
}) {
  const t = useT();
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if ("section" in patch) {
      next.delete("student");
      // The whole-school list has no single-student view.
      if (patch.section === "all") next.delete("view");
    }
    navigate(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="min-w-[130px] flex-1">
        <label className="t-label mb-1 block">{t("common.year")}</label>
        <Select value={yearId} onChange={(e) => update({ year: e.target.value })}>
          {years.map((y) => (<option key={y.id} value={y.id}>{y.name}{y.is_current ? " ★" : ""}</option>))}
        </Select>
      </div>
      <div className="min-w-[150px] flex-1">
        <label className="t-label mb-1 block">{t("common.section")}</label>
        <Select value={sectionId} onChange={(e) => update({ section: e.target.value })}>
          <option value="all">Whole school (all sections)</option>
          {sections.map((s) => (<option key={s.id} value={s.id}>{s.class_name}-{s.name}</option>))}
        </Select>
      </div>
    </div>
  );
}
