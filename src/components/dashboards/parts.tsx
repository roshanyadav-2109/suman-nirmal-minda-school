import { CalendarIcon, type IconComponent } from "@/components/icons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { fmtDate } from "@/i18n/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AnnouncementsList } from "@/components/dashboards/announcements-list";
import { getAnnouncements } from "@/lib/data/announcements";
import { navFor, type NavRole } from "@/lib/nav";
import { getFleetSummary } from "@/lib/data/transport";
import type { TransportCardLabels } from "@/components/transport/transport-card";
import type { TFunction } from "@/i18n/translate";
import { cn } from "@/lib/utils";
import { TrendArrow } from "@/components/ui/status";
import { TRANSPORT_ENABLED } from "@/lib/features";

// A distinct, premium colour per destination — icons only, no block behind.
export const NAV_COLOR: Record<string, string> = {
  "/dashboard/progress": "text-[rgb(79,70,229)]",
  "/dashboard/attendance": "text-[rgb(22,163,74)]",
  "/dashboard/marks": "text-[rgb(219,39,119)]",
  "/dashboard/students": "text-[#0F6CBD]",
  "/dashboard/announcements": "text-[rgb(234,88,12)]",
  "/dashboard/calendar": "text-[rgb(219,39,119)]",
  "/dashboard/reports": "text-[rgb(124,58,237)]",
  "/dashboard/leave": "text-[rgb(13,148,136)]",
  "/dashboard/allotments": "text-[rgb(2,132,199)]",
  "/dashboard/feedback": "text-[rgb(217,70,239)]",
  "/dashboard/promotion": "text-[rgb(5,150,105)]",
};

export async function DashHeader({ name, subtitleKey = "dashboard.overview", emoji }: { name: string; subtitleKey?: string; emoji?: string }) {
  const { t } = await getT();
  const firstName = name.split(" ").slice(-1)[0];
  return (
    <div className="mb-6">
      <h1 className="t-h1 text-ink-900">{t("dashboard.hello", { name: firstName })}{emoji ? ` ${emoji}` : ""}</h1>
      <p className="mt-1 text-[14px] text-ink-900">{t(subtitleKey)}</p>
    </div>
  );
}

export function StatCard({ label, value, sub, tone = "ink", href }: { label: string; value: React.ReactNode; sub?: string; tone?: "ink" | "up" | "down" | "watch" | "gold"; href?: string }) {
  // The figure is always black; good / watch / bad shows only as a coloured arrow.
  const arrow = tone === "up" || tone === "down" || tone === "watch" ? tone : null;
  const inner = (
    <>
      <div className="text-[13px] font-semibold text-ink-700">{label}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[30px] font-semibold leading-none tabular text-ink-900">
        {value}
        {arrow && <TrendArrow tone={arrow} size={20} />}
      </div>
      {sub && <div className="mt-1.5 text-[13px] text-ink-500">{sub}</div>}
    </>
  );
  const base = "block rounded-md border border-hair bg-surface p-4";
  if (href) return <Link href={href} className={cn(base, "transition-colors hover:border-[#0F6CBD]")}>{inner}</Link>;
  return <div className={base}>{inner}</div>;
}

// The two or three things this person most often comes to do, as big buttons
// right under the greeting. The first is the main one and is filled in.
export type DashAction = { href: string; label: string; icon: IconComponent };
export function ActionButtons({ actions }: { actions: DashAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <Link key={a.href + a.label} href={a.href}
            className={cn(
              "inline-flex h-12 items-center gap-2.5 rounded-md px-5 text-[15px] font-semibold transition-colors",
              // Main action: soft school-blue tint with a blue edge; the others
              // plain white. Light fills let the coloured icons sit naturally.
              i === 0
                ? "border border-[#9FD0F3] bg-[#EAF4FD] text-[#174C7A] hover:bg-[#DCEDFB]"
                : "border border-hair bg-surface text-ink-900 hover:border-[#9FD0F3] hover:bg-[#F5FAFE]",
            )}>
            <Icon size={22} />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

// Reusable async panels (RLS-scoped) used across every role dashboard.
export async function AnnouncementsPanel() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const rows = await getAnnouncements(4);
  const items = rows.map((a) => ({ id: a.id, title: a.title, body: a.body, date: fmtDate(locale, a.published_at), imageUrl: a.image_url }));
  return (
    <Card>
      <CardHeader title={t("announce.title")} />
      <CardBody className="pt-2">
        <AnnouncementsList items={items} emptyLabel={t("common.noData")} />
      </CardBody>
    </Card>
  );
}

export async function EventsPanel() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: future }, { data: recent }] = await Promise.all([
    supabase.from("event").select("id, title, event_type, start_date").gte("start_date", today).order("start_date", { ascending: true }).limit(4),
    supabase.from("event").select("id, title, event_type, start_date").order("start_date", { ascending: false }).limit(4),
  ]);
  const rows = (future && future.length ? future : recent ?? []).slice(0, 4);
  return (
    <Card>
      <CardHeader title={t("announce.events")} />
      <CardBody className="pt-2">
        {rows.length ? (
          <ul className="divide-y divide-hair">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <CalendarIcon size={26} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink-900">{e.title}</div>
                  <div className="text-[12px] capitalize text-ink-900">{e.event_type}</div>
                </div>
                <div className="shrink-0 text-[13px] font-normal text-ink-900 tabular">{fmtDate(locale, e.start_date)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("common.noData")} />
        )}
      </CardBody>
    </Card>
  );
}

export async function QuickLinks({ role }: { role: NavRole }) {
  const { t } = await getT();
  const links = navFor(role).filter((l) => l.href !== "/dashboard");
  return (
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
              <Icon size={32} />
              <span className="text-[15px] font-medium text-ink-900">{t(l.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Buses on the road right now. Hidden entirely until the office sets transport
// up, so a school without buses never sees three zeroes.
export async function FleetStrip() {
  if (!TRANSPORT_ENABLED) return null;
  const { t } = await getT();
  const fleet = await getFleetSummary();
  if (!fleet.buses) return null;
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[13px] font-semibold text-ink-900">{t("transport.title")}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t("transport.busesRunning")} value={fleet.running} sub={`${t("transport.of")} ${fleet.buses}`} tone={fleet.running ? "up" : "ink"} href="/dashboard/transport" />
        <StatCard label={t("transport.totalRiders")} value={fleet.riders} href="/dashboard/transport" />
        <StatCard label={t("transport.staleBuses")} value={fleet.stale} sub={t("transport.staleBusesHint")} tone={fleet.stale ? "watch" : "ink"} href="/dashboard/transport" />
      </div>
    </div>
  );
}

// The pupil's dashboard and the parent's dashboard hand TransportCard the same
// thirteen strings. They are resolved server-side so the card ships no
// dictionary, and built here so the list exists once rather than twice.
export function transportCardLabels(t: TFunction): TransportCardLabels {
  return {
    trackBus: t("transport.trackBus"), notStarted: t("transport.notStarted"),
    signalLost: t("transport.signalLost"), arrivingIn: t("transport.arrivingIn"),
    atStop: t("transport.atStop"), onTheWay: t("transport.onTheWay"),
    stopsRemaining: t("transport.stopsRemaining"), min: t("transport.min"),
    minAgo: t("transport.minAgo"), liveNow: t("transport.liveNow"),
    lastSeen: t("transport.lastSeen"), yourStop: t("transport.yourStop"),
    scheduled: t("transport.scheduled"),
      runFinished: t("transport.runFinished"),
    nextStop: t("transport.nextStop"),
    passedYourStop: t("transport.passedYourStop"),
};
}
