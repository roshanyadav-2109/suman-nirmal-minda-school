import Link from "next/link";
import { getCurrentYear, type Session } from "@/lib/session";
import { getT } from "@/i18n/server";
import { getOfficeStats } from "@/lib/data/dashboard";
import { StatCard, DashHeader, AnnouncementsPanel, EventsPanel, QuickLinks } from "@/components/dashboards/parts";
import { MarksIcon } from "@/components/icons";

// Administration overview for the office.
export async function OfficeDashboard({ session }: { session: Session }) {
  const { t } = await getT();
  const year = await getCurrentYear();
  const s = year ? await getOfficeStats(year.id) : null;

  return (
    <div>
      <DashHeader name={session.fullName} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("common.students")} value={s?.students ?? "—"} tone="gold" />
        <StatCard label={t("roles.staff")} value={s?.staff ?? "—"} />
        <StatCard label={t("nav.allotments")} value={s?.allotments ?? "—"} />
        <StatCard label={t("marks.released")} value={`${s?.released ?? 0}`} sub={`${s?.draft ?? 0} ${t("marks.draft").toLowerCase()}`} tone="up" />
      </div>

      {s && s.draft > 0 && (
        <Link href="/marks" className="mb-6 flex items-center gap-3 rounded-md border border-black bg-panel px-4 py-3 transition-colors hover:bg-[rgb(37,99,235)]/[0.05]">
          <MarksIcon size={20} className="text-ink-900" />
          <div className="text-[14px] text-ink-900"><span className="font-semibold">{s.draft}</span> {t("marks.draft").toLowerCase()} — <span className="font-semibold text-[rgb(37,99,235)] underline">{t("marks.release").toLowerCase()}</span></div>
        </Link>
      )}

      <div className="mb-6"><QuickLinks role="office" /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnnouncementsPanel />
        <EventsPanel />
      </div>
    </div>
  );
}
