"use client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { KVBarChart } from "@/components/charts";
import { ProgressIcon } from "@/components/icons";
import { useI18n } from "@/i18n/provider";
import { fmtPercent } from "@/i18n/format";

type Data = Awaited<ReturnType<typeof import("@/lib/data/analytics").getExamAnalytics>>;

export function ExamAnalyticsView({ data, examName, subjectName }: { data: Data; examName: string; subjectName: string | null }) {
  const { t, locale } = useI18n();
  if (!data.count) {
    return <EmptyState icon={ProgressIcon} title={t("progress.noMarks")} hint={examName} />;
  }
  const title = subjectName ? `${examName} · ${subjectName}` : examName;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Card><CardBody>
          <div className="text-[12px] font-normal text-ink-900">{examName}</div>
          <div className="mt-1 text-[30px] font-normal leading-none tabular text-ink-900">{fmtPercent(locale, data.average, 1)}</div>
          <div className="mt-1.5 text-[12px] text-ink-900">{t("progress.average")}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-[12px] font-normal text-ink-900">{t("common.students")}</div>
          <div className="mt-1 text-[30px] font-normal leading-none tabular text-ink-900">{data.count}</div>
          <div className="mt-1.5 text-[12px] text-ink-900">{subjectName ?? t("common.subject")}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-[12px] font-normal text-ink-900">{t("progress.topPerformers")}</div>
          <div className="mt-1 truncate text-[20px] font-normal leading-tight text-ink-900">{data.topPerformers[0]?.student_name ?? "—"}</div>
          <div className="mt-1.5 text-[12px] tabular text-ink-900">{data.topPerformers[0] ? fmtPercent(locale, Number(data.topPerformers[0].avg_percent), 1) : ""}</div>
        </CardBody></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={subjectName ? `${t("progress.distribution")} · ${subjectName}` : t("progress.distribution")} />
          <CardBody className="pt-2">
            <KVBarChart data={data.distribution} xKey="band" valueKey="n" colorByBand showValues
              maxDomain={Math.max(5, ...data.distribution.map((d) => d.n)) + 2} height={280} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={title} />
          <CardBody className="pt-1">
            <ol className="space-y-1.5">
              {data.topPerformers.map((s, i) => (
                <li key={i} className="flex items-center gap-3 rounded-sm px-2 py-1.5 odd:bg-panel/50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(37,99,235)]/[0.1] text-[12px] font-bold text-[rgb(37,99,235)] tabular">{i + 1}</span>
                  <span className="flex-1 truncate text-[14px] text-ink-900">{s.student_name}</span>
                  {data.sectionComparison.length > 1 && <span className="rounded-xs bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-ink-900 tabular">{s.section_name}</span>}
                  <span className="text-[14px] font-semibold tabular text-ink-900">{fmtPercent(locale, Number(s.avg_percent), 1)}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      {data.sectionComparison.length > 1 && (
        <Card>
          <CardHeader title={subjectName ? `${t("progress.sectionCompare")} · ${subjectName}` : t("progress.sectionCompare")} />
          <CardBody className="pt-2">
            <KVBarChart data={data.sectionComparison} xKey="name" valueKey="avg" horizontal height={260} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
