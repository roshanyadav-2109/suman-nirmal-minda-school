import Link from "next/link";
import { getCurrentYear, type Session } from "@/lib/session";
import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getMyChildren } from "@/lib/data/analytics";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ProgressIcon, ArrowRightIcon } from "@/components/icons";
import { DashHeader, AnnouncementsPanel, EventsPanel, QuickLinks } from "@/components/dashboards/parts";

// Parent view: an ID card per child (one login shows all siblings).
export async function GuardianDashboard({ session }: { session: Session }) {
  const { t } = await getT();
  const year = await getCurrentYear();
  const children = await getMyChildren();
  if (!children.length || !year) {
    return (<div><DashHeader name={session.fullName} emoji="🙏" /><EmptyState icon={ProgressIcon} title={t("common.noData")} /></div>);
  }
  const supabase = await createClient();
  const childIds = children.map((c) => c.id);

  const { data: enr } = await supabase
    .from("student_enrollment")
    .select("student_id, roll_no, section:section_id(name, class:class_id(name))")
    .in("student_id", childIds).eq("academic_year_id", year.id);
  const infoOf = new Map<number, { className: string; sectionName: string; roll: number | null }>();
  for (const e of enr ?? []) {
    const s = e.section as unknown as { name: string; class: { name: string } } | null;
    if (s) infoOf.set(e.student_id, { className: s.class.name, sectionName: s.name, roll: e.roll_no });
  }

  return (
    <div>
      <DashHeader name={session.fullName} emoji="🙏" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const info = infoOf.get(child.id);
          const initials = child.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <Card key={child.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-panel text-[15px] font-semibold text-ink-900">{initials}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold text-ink-900">{child.full_name}</div>
                      <div className="text-[12px] tabular text-ink-900">{child.admission_no}</div>
                    </div>
                  </div>
                  <Link href={`/progress?child=${child.id}`} aria-label={t("nav.childProgress")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[rgb(37,99,235)] text-white transition-colors hover:bg-[rgb(29,78,216)]">
                    <ArrowRightIcon size={16} />
                  </Link>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-hair pt-3">
                  <div>
                    <dt className="t-label">{t("common.class")}</dt>
                    <dd className="mt-0.5 text-[15px] text-ink-900">{info?.className ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t("common.section")}</dt>
                    <dd className="mt-0.5 text-[15px] text-ink-900">{info?.sectionName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t("dashboard.rollNo")}</dt>
                    <dd className="mt-0.5 text-[15px] tabular text-ink-900">{info?.roll ?? "—"}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mb-6"><QuickLinks role="guardian" /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnnouncementsPanel />
        <EventsPanel />
      </div>
    </div>
  );
}
