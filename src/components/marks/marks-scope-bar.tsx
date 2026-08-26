"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/provider";
import { fmtDate } from "@/i18n/format";
import type { YearOpt, SectionMeta } from "@/lib/data/scope";
import type { AssessmentOpt } from "@/lib/data/marks";

export function MarksScopeBar({
  years, sectionMeta, assessments, yearId, sectionId, subjectId, assessmentId,
}: {
  years: YearOpt[];
  sectionMeta: SectionMeta[];
  assessments: AssessmentOpt[];
  yearId: number;
  sectionId: number;
  subjectId: number | null;
  assessmentId: number | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current = sectionMeta.find((s) => s.id === sectionId) ?? sectionMeta[0];
  const subjectOptions = current?.subjects ?? [];

  function update(patch: Record<string, string>, resetAssessment = false, resetSubject = false) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (resetSubject) next.delete("subject");
    if (resetAssessment) next.delete("assessment");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-5 grid gap-3 rounded-md border border-hair bg-surface p-3 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="t-label mb-1 block">{t("common.year")}</label>
        <Select value={yearId} onChange={(e) => update({ year: e.target.value }, true, true)}>
          {years.map((y) => (<option key={y.id} value={y.id}>{y.name}{y.is_current ? " ★" : ""}</option>))}
        </Select>
      </div>
      <div>
        <label className="t-label mb-1 block">{t("common.section")}</label>
        <Select value={sectionId} onChange={(e) => update({ section: e.target.value }, true, true)}>
          {sectionMeta.map((s) => (<option key={s.id} value={s.id}>{s.label}{s.isClassTeacher ? " · " + t("dashboard.myClass") : ""}</option>))}
        </Select>
      </div>
      <div>
        <label className="t-label mb-1 block">{t("common.subject")}</label>
        <Select value={subjectId ?? ""} onChange={(e) => update({ subject: e.target.value }, true)}>
          <option value="" disabled>—</option>
          {subjectOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </div>
      <div>
        <label className="t-label mb-1 block">{t("marks.assessment")}</label>
        <Select value={assessmentId ?? ""} onChange={(e) => update({ assessment: e.target.value })} disabled={!assessments.length}>
          <option value="" disabled>—</option>
          {assessments.map((a) => (<option key={a.id} value={a.id}>{a.name} · {fmtDate(locale, a.assessed_on, { day: "numeric", month: "short" })}</option>))}
        </Select>
      </div>
    </div>
  );
}
