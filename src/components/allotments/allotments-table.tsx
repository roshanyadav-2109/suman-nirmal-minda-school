"use client";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { StatusPill } from "@/components/ui/status";
import { AllotmentIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";

export type AllotRow = {
  id: number;
  staffName: string;
  className: string;
  classLevel: number;
  sectionLabel: string;
  subject: string | null;
  isCt: boolean;
};

export function AllotmentsTable({ rows }: { rows: AllotRow[] }) {
  const t = useT();
  const [cls, setCls] = useState("");
  const [section, setSection] = useState("");
  const [teacher, setTeacher] = useState("");

  const classes = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.className, r.classLevel));
    return [...m.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [rows]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    rows.filter((r) => !cls || r.className === cls).forEach((r) => s.add(r.sectionLabel));
    return [...s].sort();
  }, [rows, cls]);

  const teachers = useMemo(() => [...new Set(rows.map((r) => r.staffName))].sort(), [rows]);

  const filtered = rows.filter((r) =>
    (!cls || r.className === cls) &&
    (!section || r.sectionLabel === section) &&
    (!teacher || r.staffName === teacher),
  );

  return (
    <div>
      <div className="mb-5 grid gap-3 rounded-md border border-hair bg-surface p-3 shadow-[var(--shadow-card)] sm:grid-cols-3">
        <div>
          <label className="t-label mb-1 block">{t("common.class")}</label>
          <Select value={cls} onChange={(e) => { setCls(e.target.value); setSection(""); }}>
            <option value="">{t("common.all")}</option>
            {classes.map((c) => (<option key={c} value={c}>{c}</option>))}
          </Select>
        </div>
        <div>
          <label className="t-label mb-1 block">{t("common.section")}</label>
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {sections.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
        </div>
        <div>
          <label className="t-label mb-1 block">{t("roles.teacher")}</label>
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {teachers.map((tt) => (<option key={tt} value={tt}>{tt}</option>))}
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-hair bg-surface p-4 shadow-[var(--shadow-card)]">
        {filtered.length ? (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="pb-2 font-semibold">{t("roles.staff")}</th>
                <th className="pb-2 font-semibold">{t("common.section")}</th>
                <th className="pb-2 font-semibold">{t("common.subject")}</th>
                <th className="pb-2 font-semibold">{t("roles.class_teacher")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-hair">
                  <td className="py-2 text-ink-900">{r.staffName}</td>
                  <td className="py-2 tabular text-ink-700">{r.sectionLabel}</td>
                  <td className="py-2 text-ink-700">{r.subject ?? "—"}</td>
                  <td className="py-2">{r.isCt && <StatusPill status="up">✓</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={AllotmentIcon} title={t("common.noData")} />
        )}
      </div>
    </div>
  );
}
