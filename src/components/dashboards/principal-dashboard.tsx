import { getCurrentYear, type Session } from "@/lib/session";
import { getT } from "@/i18n/server";
import { fmtPercent } from "@/i18n/format";
import { getSchoolOverview } from "@/lib/data/dashboard";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KVBarChart } from "@/components/charts";
import { DashHeader, StatCard, AnnouncementsPanel, EventsPanel, QuickLinks } from "@/components/dashboards/parts";

// School-wide overview for the principal.
export async function PrincipalDashboard({ session }: { session: Session }) {
  const { t, locale } = await getT();
  const year = await getCurrentYear();
  const ov = year ? await getSchoolOverview(year.id) : null;
  const classBars = (ov?.classes ?? []).filter((c) => c.avg != null).map((c) => ({ name: c.name, avg: c.avg as number }));

  return (
    <div>
      <DashHeader name={session.fullName} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("common.students")} value={ov?.students ?? "—"} tone="gold" href="/students" />
        <StatCard label={`${t("progress.overall")} ${t("progress.average")}`} value={fmtPercent(locale, ov?.avg ?? null, 1)} href="/progress" />
        <StatCard label={t("attendance.percent")} value={ov?.attendancePct != null ? `${ov.attendancePct}%` : "—"} tone={ov && ov.attendancePct != null && ov.attendancePct < 75 ? "down" : "up"} href="/attendance" />
        <StatCard label={t("progress.slippage")} value={ov?.slippage ?? 0} tone={ov && ov.slippage > 0 ? "watch" : "up"} sub={t("progress.needsSupport")} href="/progress" />
      </div>

      {classBars.length > 0 && (
        <Card className="mb-6">
          <CardHeader eyebrow={t("progress.classCompare")} title={t("progress.average")} />
          <CardBody className="pt-2"><KVBarChart data={classBars} xKey="name" valueKey="avg" height={240} /></CardBody>
        </Card>
      )}

      <div className="mb-6"><QuickLinks role="principal" /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnnouncementsPanel />
        <EventsPanel />
      </div>
    </div>
  );
}
