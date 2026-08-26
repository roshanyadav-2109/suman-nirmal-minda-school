"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { DeltaBadge } from "@/components/ui/status";
import { KVBarChart, KVLineChart } from "@/components/charts";
import { ProgressIcon } from "@/components/icons";
import { useI18n } from "@/i18n/provider";
import { fmtPercent } from "@/i18n/format";
import { supportReason } from "@/components/progress/insight";

type Analytics = Awaited<ReturnType<typeof import("@/lib/data/analytics").getSectionAnalytics>>;
type Roster = { id: number; name: string; admissionNo: string; roll: number | null }[];

export function SectionAnalyticsView({
  data, roster, subjectName,
}: {
  data: Analytics;
  roster: Roster;
  subjectName: string | null;
}) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();

  const drillHref = (studentId: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("studentId", String(studentId));
    return `${pathname}?${next.toString()}`;
  };

  if (!data.subjectAverages.length) {
    return <EmptyState icon={ProgressIcon} title={t("progress.noMarks")} hint={t("progress.pickStudent")} />;
  }

  const subjBars = data.subjectAverages.map((s) => ({ subject: s.subject, avg: s.avg }));
  const compBars = data.sectionComparison.map((s) => ({ name: s.section_name, avg: Math.round(Number(s.avg_percent) * 10) / 10 }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Subject vs subject */}
        <Card>
          <CardHeader title={t("progress.subjectCompare")} />
          <CardBody className="pt-2">
            <KVBarChart data={subjBars} xKey="subject" valueKey="avg" horizontal height={280} />
          </CardBody>
        </Card>

        {/* Subject-wise ranking — only meaningful across all subjects */}
        {!subjectName && (
        <Card>
          <CardHeader title={t("progress.subjectRanking")} />
          <CardBody className="pt-1">
            <ol className="space-y-1.5">
              {[...data.subjectAverages].sort((a, b) => b.avg - a.avg).map((s, i) => (
                <li key={s.subject} className="flex items-center gap-3 rounded-sm px-2 py-1.5 odd:bg-panel/50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(37,99,235)]/[0.1] text-[12px] font-bold text-[rgb(37,99,235)] tabular">{i + 1}</span>
                  <span className="flex-1 truncate text-[14px] text-ink-900">{s.subject}</span>
                  <span className="text-[14px] font-semibold tabular text-ink-900">{fmtPercent(locale, s.avg, 1)}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        )}

        {/* Term trend */}
        <Card>
          <CardHeader title={t("progress.timeline")} />
          <CardBody className="pt-2">
            {data.termTrend.length > 1 ? (
              <KVLineChart data={data.termTrend} xKey="term" lines={[{ key: "avg", name: t("progress.average"), color: "#E09E3E" }]} height={280} area />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-[14px] text-ink-900">{t("common.noData")}</div>
            )}
          </CardBody>
        </Card>

        {/* Distribution */}
        <Card>
          <CardHeader title={subjectName ? `${t("progress.distribution")} · ${subjectName}` : t("progress.distribution")} />
          <CardBody className="pt-2">
            <KVBarChart data={data.distribution} xKey="band" valueKey="n" colorByBand showValues
              maxDomain={Math.max(5, ...data.distribution.map((d) => d.n)) + 2} height={280} />
          </CardBody>
        </Card>

        {/* Section comparison (only when a subject is chosen) */}
        <Card>
          <CardHeader title={subjectName ? `${t("progress.sectionCompare")} · ${subjectName}` : t("progress.sectionCompare")} />
          <CardBody className="pt-2">
            {compBars.length ? (
              <KVBarChart data={compBars} xKey="name" valueKey="avg" horizontal height={280} />
            ) : (
              <div className="flex h-[280px] items-center justify-center px-6 text-center text-[14px] text-ink-900">
                {t("progress.subjectCompare")} — {t("common.filter").toLowerCase()} {t("common.subject").toLowerCase()}.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Top performers & needs support */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("progress.topPerformers")} />
          <CardBody className="pt-1">
            <ol className="space-y-1.5">
              {data.topPerformers.map((s, i) => (
                <li key={i} className="odd:bg-panel/50">
                  <Link href={drillHref(s.student_id)} className="flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-[rgb(37,99,235)]/[0.06]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(37,99,235)]/[0.1] text-[12px] font-bold text-[rgb(37,99,235)] tabular">{i + 1}</span>
                    <span className="flex-1 truncate text-[14px] text-ink-900">{s.student_name}</span>
                    <span className="text-[14px] font-semibold tabular text-ink-900">{fmtPercent(locale, Number(s.avg_percent), 1)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card className="border-watch/30">
          <CardHeader title={t("progress.needsSupport")} />
          <CardBody className="pt-1">
            <p className="mb-2 text-[12px] text-ink-900">{t("progress.needsSupportNote")}</p>
            {data.needsSupport.length ? (
              <ul className="space-y-2">
                {data.needsSupport.slice(0, 6).map((s, i) => (
                  <li key={i}>
                    <Link href={drillHref(s.student_id)} className="block rounded-sm border border-hair bg-surface p-2.5 transition-colors hover:border-black">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-ink-900">{s.student_name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] tabular text-ink-900">{fmtPercent(locale, Number(s.avg_percent), 0)}</span>
                          <DeltaBadge value={Math.round(Number(s.recent_trend))} />
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-900">{supportReason(t, s)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14px] text-ink-900">{t("common.noData")}</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Roster with drill-down to each student's record */}
      <Card>
        <CardHeader title={`${t("common.students")} (${roster.length})`} />
        <CardBody className="pt-2">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((s) => (
              <Link key={s.id} href={drillHref(s.id)} className="group flex items-center gap-2.5 rounded-sm border border-hair bg-surface px-3 py-2 transition-colors hover:border-[rgb(37,99,235)]/40 hover:bg-[rgb(37,99,235)]/[0.05]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-900 tabular">{s.roll ?? "–"}</span>
                <span className="flex-1 truncate text-[13px] font-medium text-ink-900">{s.name}</span>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
