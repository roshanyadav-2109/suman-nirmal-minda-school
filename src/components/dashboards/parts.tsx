import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { fmtDate } from "@/i18n/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CalendarIcon } from "@/components/icons";
import { AnnouncementsList } from "@/components/dashboards/announcements-list";
import { navFor, type NavRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

// A distinct, premium colour per destination — icons only, no block behind.
export const NAV_COLOR: Record<string, string> = {
  "/progress": "text-[rgb(79,70,229)]",
  "/attendance": "text-[rgb(22,163,74)]",
  "/marks": "text-[rgb(219,39,119)]",
  "/students": "text-[rgb(37,99,235)]",
  "/announcements": "text-[rgb(234,88,12)]",
  "/calendar": "text-[rgb(219,39,119)]",
  "/reports": "text-[rgb(124,58,237)]",
  "/leave": "text-[rgb(13,148,136)]",
  "/allotments": "text-[rgb(2,132,199)]",
  "/feedback": "text-[rgb(217,70,239)]",
  "/promotion": "text-[rgb(5,150,105)]",
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
  const toneCls = { ink: "text-ink-900", up: "text-up", down: "text-down", watch: "text-watch", gold: "text-[rgb(37,99,235)]" }[tone];
  const inner = (
    <>
      <div className="text-[12px] font-normal text-ink-900">{label}</div>
      <div className={cn("mt-1 text-[30px] font-normal leading-none tabular", toneCls)}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-900">{sub}</div>}
    </>
  );
  const base = "block rounded-md border border-hair bg-surface p-4";
  if (href) return <Link href={href} className={cn(base, "transition-colors hover:border-black")}>{inner}</Link>;
  return <div className={base}>{inner}</div>;
}

// Reusable async panels (RLS-scoped) used across every role dashboard.
export async function AnnouncementsPanel() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data } = await supabase
    .from("announcement")
    .select("id, title, body, published_at")
    .order("published_at", { ascending: false })
    .limit(4);
  const items = (data ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, date: fmtDate(locale, a.published_at) }));
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
                <CalendarIcon size={18} className="shrink-0 text-ink-900" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink-900">{e.title}</div>
                  <div className="text-[12px] capitalize text-ink-900">{e.event_type}</div>
                </div>
                <div className="shrink-0 text-[13px] font-normal text-ink-900 tabular">{fmtDate(locale, e.start_date)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarIcon} title={t("common.noData")} />
        )}
      </CardBody>
    </Card>
  );
}

export async function QuickLinks({ role }: { role: NavRole }) {
  const { t } = await getT();
  const links = navFor(role).filter((l) => l.href !== "/");
  return (
    <div className="rounded-md border border-hair bg-surface p-4">
      <div className="mb-2.5 text-[13px] font-semibold text-ink-900">{t("dashboard.quickLinks")}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href + l.labelKey}
              href={l.href}
              className="group flex items-center gap-3 rounded-md border border-hair bg-surface p-3.5 transition-colors hover:border-[rgb(37,99,235)]/40 hover:bg-[rgb(37,99,235)]/[0.05]"
            >
              <Icon size={24} className="text-ink-900" />
              <span className="text-[15px] font-medium text-ink-900">{t(l.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
