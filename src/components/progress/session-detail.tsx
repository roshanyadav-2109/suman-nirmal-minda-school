"use client";
import { TrendArrow } from "@/components/ui/status";
import { useState } from "react";
import { useT } from "@/i18n/provider";

type Sessions = Awaited<ReturnType<typeof import("@/lib/data/analytics").getStudentProgress>>["sessions"];

export function SessionDetail({ sessions }: { sessions: Sessions }) {
  const t = useT();
  const [yearId, setYearId] = useState<number>(sessions[0]?.yearId ?? 0);
  const sess = sessions.find((s) => s.yearId === yearId) ?? sessions[0];
  if (!sess) return <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>;

  return (
    <div>
      {/* Session selector */}
      <div className="mb-3 flex flex-wrap gap-2">
        {sessions.map((s) => {
          const active = s.yearId === sess.yearId;
          return (
            <button key={s.yearId} onClick={() => setYearId(s.yearId)}
              className={`rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]"}`}>
              {s.yearName}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-900">
              <th className="pb-2 pr-3 font-semibold">{t("common.subject")}</th>
              {sess.assessments.map((a) => (<th key={a} className="px-1.5 pb-2 text-center font-semibold">{a}</th>))}
            </tr>
          </thead>
          <tbody>
            {sess.subjects.map((sub) => (
              <tr key={sub.code} className="border-t border-hair">
                <td className="py-1.5 pr-3 font-semibold text-ink-900">{sub.name}</td>
                {sess.assessments.map((a) => {
                  const c = sub.cells[a];
                  return (
                    <td key={a} className="px-1 py-1.5 text-center">
                      {c ? (
                        <span className="inline-flex items-center gap-0.5 tabular text-ink-900">{c.percent < 33 && <TrendArrow tone="down" size={11} />}{c.percent}</span>
                      ) : (
                        <span className="text-ink-900">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
