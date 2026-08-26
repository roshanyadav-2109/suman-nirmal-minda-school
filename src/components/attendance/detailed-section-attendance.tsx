import Link from "next/link";
import { getT } from "@/i18n/server";
import { Card, CardBody } from "@/components/ui/card";
import { ArrowRightIcon } from "@/components/icons";

type Detail = Awaited<ReturnType<typeof import("@/lib/data/attendance").getSectionAttendanceRange>>;

// Principal drill-down: per-student attendance for a section, as a plain table.
// Day mode shows present/absent; month mode shows the attendance % over the range.
export async function DetailedSectionAttendance({ students, period, sectionLabel, dateLabel, backHref }: {
  students: Detail;
  period: "day" | "month";
  sectionLabel: string;
  dateLabel: string;
  backHref: string;
}) {
  const { t } = await getT();
  return (
    <Card>
      <CardBody>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-[22px] font-semibold leading-tight text-[rgb(37,99,235)] hover:underline">
          <ArrowRightIcon size={20} className="rotate-180" />
          {t("x.attendanceOverview")}
        </Link>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] font-normal text-ink-900">
          <span>{t("common.class")} - {sectionLabel}</span>
          <span>{t("attendance.date")} - {dateLabel}</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-900">
                <th className="pb-2 pr-3 font-semibold">#</th>
                <th className="pb-2 font-semibold">{t("common.student")}</th>
                <th className="pb-2 pl-3 text-right font-semibold">{period === "month" ? t("attendance.percent") : t("attendance.title")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.id} className="border-t border-hair">
                  <td className="py-2 pr-3 tabular text-ink-900">{st.roll ?? "–"}</td>
                  <td className="py-2 text-ink-900">{st.name}</td>
                  <td className="py-2 pl-3 text-right">
                    {period === "day" ? (
                      st.total > 0 ? (
                        <span className={st.present > 0 ? "text-up" : "text-down"}>{st.present > 0 ? t("attendance.present") : t("attendance.absent")}</span>
                      ) : (
                        <span className="text-ink-900">—</span>
                      )
                    ) : (
                      <span className={`tabular ${st.pct != null && st.pct < 75 ? "text-down" : "text-ink-900"}`}>
                        {st.present}/{st.total}{st.pct != null ? ` · ${st.pct}%` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
