"use client";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DeltaBadge, BandChip } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/empty";
import { KVLineChart, KVBarChart, KVGroupedBarChart, SERIES } from "@/components/charts";
import { ProgressIcon, NotebookIcon, ViewsIcon } from "@/components/icons";
import { SessionDetail } from "@/components/progress/session-detail";
import { useI18n } from "@/i18n/provider";
import { fmtDate, fmtPercent } from "@/i18n/format";
import { cn } from "@/lib/utils";

type Progress = Awaited<ReturnType<typeof import("@/lib/data/analytics").getStudentProgress>>;
type Standing = Awaited<ReturnType<typeof import("@/lib/data/analytics").getStudentStanding>>;

export function StudentProgressView({ data, standing }: { data: Progress; standing?: Standing }) {
  const { t, locale } = useI18n();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  if (!data.hasData || !data.student) {
    return <EmptyState icon={ProgressIcon} title={t("progress.noMarks")} hint={t("progress.pickStudent")} />;
  }

  const lines = data.seriesSubjects.map((s, i) => ({ key: s.code, name: s.name, color: SERIES[i % SERIES.length] }));

  function deltaText(delta: number | null, prev: number | null) {
    if (delta === null || prev === null) return t("progress.overall");
    if (delta >= 1) return t("progress.upFrom", { prev });
    if (delta <= -1) return t("progress.downFrom", { prev });
    return t("progress.steady");
  }

  return (
    <div className="space-y-5">
      {/* Overall + standing */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-[12px] font-normal text-ink-900">{t("progress.overall")} · {t("progress.average")}</div>
            <div className="mt-1 text-[34px] font-normal leading-none tabular text-ink-900">{fmtPercent(locale, data.currentAvg, 1)}</div>
            <div className="mt-3 space-y-1">
              {data.yearOnYear.map((y) => (
                <div key={y.year} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-900">{y.year}</span>
                  <span className="font-normal tabular text-ink-900">{fmtPercent(locale, y.avg, 1)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <StandingCard label={t("progress.sectionStanding")} rank={standing?.sectionRank} size={standing?.sectionSize}
          groupAvg={standing?.sectionAvg} groupLabel={t("progress.sectionAvg")} locale={locale} t={t} />
        <StandingCard label={t("progress.classStanding")} rank={standing?.classRank} size={standing?.classSize}
          groupAvg={standing?.classAvg} groupLabel={t("progress.classAvg")} locale={locale} t={t} />
      </div>

      {/* Subject trends — line or grouped bar */}
      <Card>
        <CardBody>
          <div className="mb-3 flex justify-end gap-1.5">
            {(["line", "bar"] as const).map((k) => (
              <button
                key={k}
                aria-label={k === "line" ? "Line chart" : "Bar chart"}
                aria-pressed={chartType === k}
                onClick={() => setChartType(k)}
                className={cn("flex h-7 w-8 items-center justify-center rounded-sm border transition-colors",
                  chartType === k ? "border-black bg-black text-white" : "border-hair text-ink-900 hover:bg-panel")}
              >
                {k === "line" ? <ProgressIcon size={15} /> : <ViewsIcon size={15} />}
              </button>
            ))}
          </div>
          {chartType === "line"
            ? <KVLineChart data={data.chartData} xKey="label" lines={lines} height={240} />
            : <KVGroupedBarChart data={data.chartData} xKey="label" bars={lines} height={240} />}
        </CardBody>
      </Card>

      {/* Per-subject latest with delta */}
      <Card>
        <CardHeader title={t("common.subject")} />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map((s) => (
            <div key={s.code} className="rounded-md border border-hair bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink-900">{s.name}</span>
                <BandChip band={s.band} />
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[26px] font-normal leading-none tabular text-ink-900">{s.latest}</span>
                <span className="pb-0.5 text-[13px] text-ink-900">%</span>
                <DeltaBadge value={s.delta} className="mb-0.5 ml-auto" />
              </div>
              <div className="mt-1 text-[12px] text-ink-900">{deltaText(s.delta, s.prev)}</div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Every session in detail — filter by session */}
      <Card>
        <CardBody>
          <SessionDetail key={data.student?.id ?? 0} sessions={data.sessions} />
        </CardBody>
      </Card>

      {/* Year-on-year overall */}
      {data.yearOnYear.length > 1 && (
        <Card>
          <CardHeader title={t("progress.yearOnYear")} />
          <CardBody className="pt-2"><KVBarChart data={data.yearOnYear} xKey="year" valueKey="avg" height={200} /></CardBody>
        </Card>
      )}

      {/* Observations */}
      <Card>
        <CardHeader title={t("x.progObservations")} />
        <CardBody className="pt-2">
          {data.observations.length ? (
            <ul className="space-y-3">
              {data.observations.map((o) => (
                <li key={o.id} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-ink-900"><NotebookIcon size={15} /></span>
                  <div className="min-w-0">
                    <div className="text-[14px] text-ink-900">{o.body}</div>
                    <div className="mt-0.5 text-[12px] text-ink-900"><span className="capitalize">{o.category}</span>{o.subject ? ` · ${o.subject}` : ""} · {o.staff} · {fmtDate(locale, o.date)}</div>
                  </div>
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

function StandingCard({ label, rank, size, groupAvg, groupLabel, locale, t }: {
  label: string; rank?: number; size?: number; groupAvg?: number | null; groupLabel: string;
  locale: "en" | "hi" | "bn"; t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[12px] font-normal text-ink-900">{label}</div>
        {rank && size ? (
          <>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[34px] font-normal leading-none tabular text-ink-900">{rank}</span>
              <span className="text-[15px] tabular text-ink-900">/ {size}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <span className="text-ink-900">{groupLabel}</span>
              <span className="tabular text-ink-900">{fmtPercent(locale, groupAvg, 1)}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ink-900">{t("common.noData")}</p>
        )}
      </CardBody>
    </Card>
  );
}
