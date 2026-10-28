import Link from "next/link";
import { getCurrentYear, getStudentCard, type Session } from "@/lib/session";
import { getT } from "@/i18n/server";
import { fmtPercent, fmtDate } from "@/i18n/format";
import { getStudentStanding } from "@/lib/data/analytics";
import { getStudentAttendance } from "@/lib/data/attendance";
import { getRideSummaries } from "@/lib/data/transport";
import { createClient } from "@/lib/supabase/server";
import { CardBody, CardHeader } from "@/components/ui/card";
import { navFor } from "@/lib/nav";
import { CalendarIcon, ArrowRightIcon, ProgressIcon, ReportIcon } from "@/components/icons";
import { ProfileMenu } from "@/components/dashboards/profile-menu";
import { AnnouncementsList } from "@/components/dashboards/announcements-list";
import { transportCardLabels, ActionButtons } from "@/components/dashboards/parts";
import { TransportCard } from "@/components/transport/transport-card";
import { TRANSPORT_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";
import { TrendArrow } from "@/components/ui/status";

type Att = Awaited<ReturnType<typeof getStudentAttendance>>;
type Standing = Awaited<ReturnType<typeof getStudentStanding>>;

// White section, defined by a hairline border on the page.
function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-md border border-hair bg-surface", className)}>{children}</div>;
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "ink" | "up" | "down" | "gold" }) {
  return (
    <div className="rounded-sm border border-hair bg-surface p-4">
      <div className="text-[13px] font-semibold text-ink-700">{label}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[28px] font-semibold leading-none tabular text-ink-900">
        {value}
        {(tone === "up" || tone === "down") && <TrendArrow tone={tone} size={18} />}
      </div>
      {sub && <div className="mt-1.5 text-[12px] font-normal text-ink-900">{sub}</div>}
    </div>
  );
}

// Two columns: the student's overview (main) and a right column stacking the
// profile card, Announcements, Quick Links and the Event Calendar.
export async function StudentDashboard({ session }: { session: Session }) {
  const year = await getCurrentYear();
  const studentId = session.studentId!;
  const [standing, att] = await Promise.all([
    year ? getStudentStanding(studentId, year.id) : Promise.resolve(null),
    year ? getStudentAttendance(studentId, year.id) : Promise.resolve(null),
  ]);

  return (
    <div className="grid max-w-6xl items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
      <MainContent name={session.fullName} standing={standing} att={att} />
      <div className="flex flex-col gap-3">
        <ProfileCard name={session.fullName} studentId={studentId} />
        <BusCard studentId={studentId} />
        <AnnouncementsCard />
        <EventCalendarCard />
      </div>
    </div>
  );
}

// ── Right column: student profile card, with a vertical ⋮ menu by the name ───
async function ProfileCard({ name, studentId }: { name: string; studentId: number }) {
  const { t } = await getT();
  const card = await getStudentCard(studentId);
  const genderLabel = card?.gender ? card.gender[0].toUpperCase() + card.gender.slice(1) : "—";
  const rows: [string, React.ReactNode][] = [
    [t("dashboard.rollNo"), card?.roll ?? "—"],
    [t("dashboard.classLabel"), card?.classSection ?? "—"],
    [t("dashboard.gender"), genderLabel],
    [t("dashboard.classTeacher"), card?.classTeacher ?? "—"],
  ];
  return (
    <Panel>
      <CardBody>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-[20px] font-normal leading-tight text-ink-900">{name}</div>
          <ProfileMenu
            promptLabel={t("dashboard.logoutPrompt")}
            confirmLabel={t("dashboard.confirmSignOut")}
            cancelLabel={t("dashboard.cancel")}
          />
        </div>
        <dl className="mt-3.5 space-y-2 border-t border-hair pt-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[12px] text-ink-900">{label}</dt>
              <dd className="min-w-0 truncate text-right text-[13px] font-normal text-ink-900 tabular">{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Panel>
  );
}

// ── Right column: the pupil's bus, live ──────────────────────────────────────
// A pupil who does not ride a bus sees nothing at all here — an empty state
// would only advertise a service they have not bought.
async function BusCard({ studentId }: { studentId: number }) {
  if (!TRANSPORT_ENABLED) return null;
  const rides = await getRideSummaries([studentId]);
  if (!rides.length) return null;
  const { t } = await getT();
  return (
    <>
      {rides.map((ride) => (
        <TransportCard
          serverNow={new Date().toISOString()}
          key={ride.studentId}
          ride={ride}
          labels={transportCardLabels(t)}
        />
      ))}
    </>
  );
}

// ── Middle: the largest area — greeting + performance overview ───────────────
async function MainContent({ name, standing, att }: { name: string; standing: Standing | null; att: Att | null }) {
  const { t, locale } = await getT();
  const firstName = name.split(" ").slice(-1)[0];
  const links = navFor("student").filter((l) => l.href !== "/dashboard");
  // A distinct, lively colour per quick link.
  const linkColor: Record<string, string> = {
    "/dashboard/progress": "text-[rgb(79,70,229)]",
    "/dashboard/attendance": "text-[rgb(22,163,74)]",
    "/dashboard/announcements": "text-[rgb(217,119,6)]",
    "/dashboard/calendar": "text-[rgb(219,39,119)]",
    "/dashboard/reports": "text-[rgb(124,58,237)]",
    "/dashboard/leave": "text-[rgb(13,148,136)]",
  };
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h1 className="t-h1 text-ink-900">{t("dashboard.hello", { name: firstName })} 👋</h1>
        <p className="mt-1 text-[14px] text-ink-900">{t("dashboard.overview")}</p>
      </div>

      <ActionButtons actions={[
        { href: "/dashboard/progress", label: t("dashboard.ctaMyProgress"), icon: ProgressIcon },
        { href: "/dashboard/reports", label: t("dashboard.ctaReportCard"), icon: ReportIcon },
      ]} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label={`${t("progress.overall")} ${t("progress.average")}`} value={fmtPercent(locale, standing?.studentAvg ?? null, 1)} tone="gold" />
        <Stat label={t("attendance.percent")} value={att ? `${att.pct}%` : "—"} tone={att && att.pct < 75 ? "down" : "up"} sub={att ? `${att.present}/${att.total}` : undefined} />
        <Stat label={t("progress.sectionStanding")} value={standing?.sectionRank ? `${standing.sectionRank}/${standing.sectionSize}` : "—"} sub={standing ? `${t("progress.sectionAvg")} ${fmtPercent(locale, standing.sectionAvg, 1)}` : undefined} />
        <Stat label={t("progress.classStanding")} value={standing?.classRank ? `${standing.classRank}/${standing.classSize}` : "—"} sub={standing ? `${t("progress.classAvg")} ${fmtPercent(locale, standing.classAvg, 1)}` : undefined} />
      </div>

      {/* Quick links — same wrapping grid as the other dashboards, above My Progress */}
      <div>
        <div className="mb-3 text-[16px] font-semibold text-ink-900">{t("dashboard.quickLinks")}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href + l.labelKey}
                href={l.href}
                className="group flex items-center gap-3 rounded-md border border-hair bg-surface p-3.5 transition-colors hover:border-[#0F6CBD]/40 hover:bg-[#0F6CBD]/[0.05]"
              >
                <Icon size={32} className={linkColor[l.href] ?? "text-ink-900"} />
                <span className="text-[15px] font-medium text-ink-900">{t(l.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Progress call-to-action */}
      <div className="rounded-sm border border-hair bg-surface p-5">
        <h3 className="t-h3 text-ink-900">{t("progress.title")}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-900">{t("dashboard.progressCta")}</p>
        <Link href="/dashboard/progress" className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-[#0F6CBD] px-3.5 py-2 text-[13px] font-normal text-white transition-colors hover:bg-[#115EA3]">
          {t("nav.myProgress")}
          <ArrowRightIcon size={14} />
        </Link>
      </div>
    </section>
  );
}

// ── Right column: Announcements ──────────────────────────────────────────────
async function AnnouncementsCard() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data } = await supabase
    .from("announcement")
    .select("id, title, body, published_at")
    .order("published_at", { ascending: false })
    .limit(4);
  const items = (data ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, date: fmtDate(locale, a.published_at) }));
  return (
    <Panel>
      <CardHeader
        title={t("announce.title")}
        action={
          <Link href="/dashboard/announcements" className="inline-flex items-center gap-1 text-[12px] font-normal text-[#0F6CBD] hover:text-ink-900">
            {t("dashboard.viewAll")}
            <ArrowRightIcon size={13} />
          </Link>
        }
      />
      <CardBody className="pt-2">
        <AnnouncementsList items={items} emptyLabel={t("common.noData")} />
      </CardBody>
    </Panel>
  );
}

// ── Right column: Event Calendar (this month's upcoming events) ──────────────
async function EventCalendarCard() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const [{ data: inMonth }, { data: future }] = await Promise.all([
    supabase.from("event").select("id, title, event_type, start_date").gte("start_date", today).lte("start_date", monthEnd).order("start_date", { ascending: true }).limit(5),
    supabase.from("event").select("id, title, event_type, start_date").gte("start_date", today).order("start_date", { ascending: true }).limit(4),
  ]);
  const events = (inMonth && inMonth.length ? inMonth : future ?? []).slice(0, 5);

  return (
    <Panel>
      <CardHeader
        title={t("announce.events")}
        action={
          <Link href="/dashboard/calendar" className="inline-flex items-center gap-1 text-[12px] font-normal text-[#0F6CBD] hover:text-ink-900">
            {t("dashboard.viewAll")}
            <ArrowRightIcon size={13} />
          </Link>
        }
      />
      <CardBody className="pt-2">
        {events.length ? (
          <ul className="space-y-1.5">
            {events.map((e) => {
              const d = new Date(e.start_date);
              return (
                <li key={e.id}>
                  <Link href="/dashboard/calendar" className="group flex items-center gap-2.5 rounded-sm p-1 transition-colors hover:bg-panel">
                    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-sm bg-ink-900 leading-none text-gold-100">
                      <span className="text-[15px] font-bold tabular">{fmtDate(locale, d, { day: "2-digit" })}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-gold-300">{fmtDate(locale, d, { month: "short" })}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink-900 group-hover:text-[#0F6CBD]">{e.title}</span>
                      <span className="block text-[11px] capitalize text-ink-900">{e.event_type}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-sm border border-hair px-3 py-4 text-[13px] text-ink-900">
            <CalendarIcon size={16} className="text-ink-900" />
            {t("dashboard.noEventsMonth")}
          </div>
        )}
      </CardBody>
    </Panel>
  );
}
