import { TrendArrow } from "@/components/ui/status";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Overview = Awaited<ReturnType<typeof import("@/lib/data/attendance").getAttendanceOverview>>;

// School-wide + class-wise attendance. When `hrefForSection` is provided
// (principal), section pills become links to the per-student detail.
export async function AttendanceOverview({ overview, label, hrefForSection, selectedSection }: {
  overview: Overview;
  label: string;
  hrefForSection?: (id: number) => string;
  selectedSection?: number | null;
}) {
  const { t } = await getT();
  const s = overview.school;

  // One summary box, then one panel with a plain row per class — no boxes
  // inside boxes. Sections are simple links within their class's row.
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-x-10 gap-y-3 rounded-md border border-hair bg-surface p-4">
        <div>
          <div className="t-label">{t("x.schoolWide")} · {t("x.attended")}</div>
          <div className="mt-1 text-[32px] font-bold leading-none tabular text-ink-900">
            {s.present}<span className="text-[18px] text-ink-700"> / {s.total}</span>
          </div>
        </div>
        <div>
          <div className="t-label">{t("attendance.percent")}</div>
          <div className="mt-1 flex items-center gap-2 text-[32px] font-bold leading-none tabular text-ink-900">
            {s.pct != null ? `${s.pct}%` : "—"}
            {s.pct != null && <TrendArrow tone={s.pct < 75 ? "down" : "up"} size={20} />}
          </div>
        </div>
        <div className="pb-1 text-[13px] text-ink-500">{label}</div>
      </div>

      <Card>
        <CardHeader title={t("x.attendanceOverview")}
          action={hrefForSection ? <span className="text-[12px] text-ink-500">{t("x.tapClassForDetail")}</span> : undefined} />
        <CardBody className="pt-1">
          {overview.classes.length ? (
            <ul className="divide-y divide-hair">
              {overview.classes.map((c) => (
                <li key={c.id} className="grid grid-cols-1 gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                  <span className="text-[15px] font-semibold text-ink-900">{t("common.class")} {c.name}</span>
                  <span className="flex flex-wrap gap-x-5 gap-y-1">
                    {c.sections.map((sec) => {
                      const content = (
                        <>
                          <span className="font-semibold">{c.name}-{sec.name}</span>{" "}
                          <span className="tabular">{sec.present}/{sec.total}</span>{" "}
                          <span className="tabular text-ink-500">({sec.pct != null ? `${sec.pct}%` : "—"})</span>
                        </>
                      );
                      if (hrefForSection) {
                        const active = selectedSection === sec.id;
                        return (
                          <Link prefetch={false} key={sec.id} href={hrefForSection(sec.id)}
                            className={cn("text-[13px] underline-offset-4 transition-colors hover:text-[#0F6CBD] hover:underline",
                              active ? "text-[#0F6CBD] underline" : "text-ink-900")}>
                            {content}
                          </Link>
                        );
                      }
                      return <span key={sec.id} className="text-[13px] text-ink-900">{content}</span>;
                    })}
                  </span>
                  <span className="flex items-center gap-2 text-[14px] font-semibold tabular text-ink-900 sm:justify-end">
                    {c.present} / {c.total}
                    <span className="inline-flex w-[4.5rem] items-center justify-end gap-1">
                      {c.pct != null && <TrendArrow tone={c.pct < 75 ? "down" : "up"} size={11} />}
                      {c.pct != null ? `${c.pct}%` : "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
