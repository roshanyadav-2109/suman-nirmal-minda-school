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

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border border-hair bg-surface p-4">
          <div className="t-label">{t("x.schoolWide")} · {t("x.attended")}</div>
          <div className="mt-1 text-[34px] font-bold leading-none tabular text-ink-900">
            {s.present}<span className="text-[18px] text-ink-900"> / {s.total}</span>
          </div>
          <div className="mt-1.5 text-[12px] text-ink-900">{label}</div>
        </div>
        <div className="rounded-md border border-hair bg-surface p-4">
          <div className="t-label">{t("attendance.percent")}</div>
          <div className={cn("mt-1 text-[34px] font-bold leading-none tabular", s.pct != null && s.pct < 75 ? "text-down" : "text-up")}>
            {s.pct != null ? `${s.pct}%` : "—"}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader eyebrow={t("x.classWise")} title={t("x.attendanceOverview")}
          action={hrefForSection ? <span className="text-[12px] text-ink-900">{t("x.tapClassForDetail")}</span> : undefined} />
        <CardBody className="space-y-3 pt-2">
          {overview.classes.length ? (
            overview.classes.map((c) => (
              <div key={c.id} className="rounded-md border border-hair p-3">
                <div className="flex items-center justify-between">
                  <span className="t-h3 text-ink-900">{t("common.class")} {c.name}</span>
                  <span className="flex items-center gap-2 text-[14px] font-semibold tabular text-ink-900">
                    {c.present} / {c.total}
                    <span className={cn("rounded-xs px-1.5 py-0.5 text-[12px]", c.pct != null && c.pct < 75 ? "bg-down-soft text-down" : "bg-up-soft text-up")}>
                      {c.pct != null ? `${c.pct}%` : "—"}
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.sections.map((sec) => {
                    const content = `${c.name}-${sec.name}: ${sec.present}/${sec.total} (${sec.pct != null ? `${sec.pct}%` : "—"})`;
                    const active = selectedSection === sec.id;
                    if (hrefForSection) {
                      return (
                        <Link key={sec.id} href={hrefForSection(sec.id)}
                          className={cn("rounded-sm border px-2 py-1 text-[12px] tabular transition-colors",
                            active ? "border-[rgb(37,99,235)]/40 bg-[rgb(37,99,235)]/[0.1] text-ink-900" : "border-hair bg-surface text-ink-900 hover:border-[rgb(37,99,235)]/40 hover:bg-[rgb(37,99,235)]/[0.05]")}>
                          {content}
                        </Link>
                      );
                    }
                    return <span key={sec.id} className="rounded-sm border border-hair bg-surface px-2 py-1 text-[12px] tabular text-ink-900">{content}</span>;
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
