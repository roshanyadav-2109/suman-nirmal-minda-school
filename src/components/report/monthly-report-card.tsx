import { getT } from "@/i18n/server";
import { fmtDate } from "@/i18n/format";
import { Card, CardBody } from "@/components/ui/card";
import { BandChip, DeltaBadge, TrendArrow } from "@/components/ui/status";
import { SchoolEmblem } from "@/components/brand";
import { SCHOOL } from "@/lib/school";
import type { StudentReport } from "@/lib/data/report";

// The printable per-student report card. Shared by the owner view and the staff
// "student detail" report — monthly, yearly, or a single exam (periodLabel says
// which). Attendance is shown only when the report carries it (not for exams).
export async function ReportCard({ report, periodLabel }: { report: StudentReport; periodLabel: string }) {
  const { t, locale } = await getT();
  const r = report;
  const att = r.attendance;
  return (
    <Card className="print-area">
      <CardBody>
        <div className="mb-4 flex items-center gap-3 border-b border-hair pb-4">
          <SchoolEmblem size={44} />
          <div className="flex-1">
            <div className="t-h3 text-ink-900">{SCHOOL.fullName}</div>
            <div className="text-[13px] text-ink-900">{t("report.title")} · {periodLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-semibold text-ink-900">{r.student?.full_name}</div>
            <div className="text-[12px] text-ink-900 tabular">{r.student?.admission_no}</div>
          </div>
        </div>

        <div className={att ? "grid gap-5 sm:grid-cols-[200px_1fr]" : ""}>
          {att && (
            <div className="rounded-md bg-panel/50 p-4">
              <div className="t-label">{t("report.attendance")}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[30px] font-normal tabular text-ink-900">
                {att.pct != null ? `${att.pct}%` : "—"}
                {att.pct != null && <TrendArrow tone={att.pct < 75 ? "down" : "up"} size={18} />}
              </div>
              <div className="text-[12px] text-ink-900">{att.present}/{att.total} {t("attendance.present").toLowerCase()}</div>
            </div>
          )}

          <div>
            <div className="t-label mb-2">{t("report.marks")}</div>
            {r.marks.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-900">
                    <th className="pb-1 font-semibold">{t("common.subject")}</th>
                    <th className="pb-1 font-semibold">{t("marks.assessment")}</th>
                    <th className="pb-1 text-right font-semibold">%</th>
                    <th className="pb-1 text-center font-semibold">{t("progress.band")}</th>
                    <th className="pb-1 text-right font-semibold">{t("progress.delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.marks.map((m, i) => (
                    <tr key={i} className="border-t border-hair">
                      <td className="py-1.5 text-ink-900">{m.subject_name}</td>
                      <td className="py-1.5 text-ink-900">{m.assessment_name}</td>
                      <td className="py-1.5 text-right font-semibold tabular text-ink-900">{m.percent}</td>
                      <td className="py-1.5 text-center"><BandChip band={m.band} /></td>
                      <td className="py-1.5 text-right"><DeltaBadge value={m.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : (
              <p className="text-[14px] text-ink-900">{t("common.noData")}</p>
            )}
          </div>
        </div>

        {r.notices.length > 0 && (
          <div className="mt-5 border-t border-hair pt-4">
            <div className="t-label mb-2">{t("report.noticesSent")}</div>
            <ul className="space-y-1 text-[13px] text-ink-900">
              {r.notices.map((n, i) => (
                <li key={i} className="flex gap-2"><span className="text-ink-900 tabular">{fmtDate(locale, n.published_at, { day: "numeric", month: "short" })}</span>{n.title}</li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
