"use client";
import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { fmtDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { explainAbsences } from "@/app/(app)/leave/actions";
import type { AbsenceNotice } from "@/lib/data/absence";

export function AbsenceList({ notices, canExplain }: { notices: AbsenceNotice[]; canExplain: boolean }) {
  if (canExplain) return <OwnerAbsence notices={notices} />;
  return <StaffAbsence notices={notices} />;
}

// Owner: pick one or many absent days, give one shared reason.
function OwnerAbsence({ notices }: { notices: AbsenceNotice[] }) {
  const { t, locale } = useI18n();
  const pending = notices.filter((n) => n.status === "pending");
  const explained = notices.filter((n) => n.status !== "pending");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();

  if (!notices.length) return <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>;

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = pending.length > 0 && selected.size === pending.length;
  const selectAll = () => setSelected(allSelected ? new Set() : new Set(pending.map((n) => n.id)));

  function apply() {
    start(async () => {
      await explainAbsences([...selected], reason);
      setSelected(new Set());
      setReason("");
    });
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-ink-900">{t("leave.selectDays")}</h3>
            <button onClick={selectAll} className="text-[13px] text-ink-900 underline-offset-2 hover:text-ink-900 hover:underline">{t("leave.selectAll")}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((n) => {
              const on = selected.has(n.id);
              return (
                <label
                  key={n.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-[13px] transition-colors",
                    on ? "border-ink-900 bg-panel" : "border-hair hover:bg-panel",
                  )}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(n.id)} className="h-4 w-4 accent-[var(--color-ink-900)]" />
                  <span className={cn("tabular", on ? "font-semibold text-ink-900" : "text-ink-900")}>{fmtDate(locale, n.on_date, { day: "numeric", month: "short" })}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("leave.absenceReason")} />
          </div>
          <div className="mt-3">
            <Button size="sm" disabled={busy || !reason || selected.size === 0} onClick={apply}>
              {busy ? t("common.saving") : t("leave.applyToSelected", { n: selected.size })}
            </Button>
          </div>
        </section>
      )}

      {explained.length > 0 && (
        <ul className="divide-y divide-hair border-y border-hair">
          {explained.map((n) => (
            <li key={n.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-ink-900 tabular">{fmtDate(locale, n.on_date)}</span>
                <span className="text-[12px] text-ink-900">{t("leave.explained")}</span>
              </div>
              {n.reason && <p className="mt-1 text-[13px] leading-relaxed text-ink-900">{n.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Staff: read-only list of section absences and their reasons.
function StaffAbsence({ notices }: { notices: AbsenceNotice[] }) {
  const { t, locale } = useI18n();
  if (!notices.length) return <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>;
  return (
    <ul className="space-y-2.5">
      {notices.map((n) => {
        const pending = n.status === "pending";
        return (
          <li key={n.id} className="rounded-md border border-hair bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink-900">{n.studentName}</div>
                <div className="text-[12px] text-ink-900 tabular">{t("leave.absentOn", { date: fmtDate(locale, n.on_date) })}</div>
              </div>
              <span className={`shrink-0 text-[13px] ${pending ? "text-down" : "text-up"}`}>{pending ? t("leave.awaitingReason") : t("leave.explained")}</span>
            </div>
            {n.reason && <p className="mt-2 rounded-sm bg-surface px-2.5 py-1.5 text-[13px] text-ink-900">{n.reason}</p>}
          </li>
        );
      })}
    </ul>
  );
}
