import Link from "next/link";
import { type Session } from "@/lib/session";
import { getT } from "@/i18n/server";
import { getStaffScope } from "@/lib/data/scope";
import { StudentsIcon, ProgressIcon, AttendanceIcon, MarksIcon } from "@/components/icons";
import { DashHeader, AnnouncementsPanel, EventsPanel, QuickLinks, NAV_COLOR } from "@/components/dashboards/parts";
import type { NavRole } from "@/lib/nav";

// One unified teacher portal: own class (full access) + subject-only sections.
export async function TeacherDashboard({ session }: { session: Session }) {
  const { t } = await getT();
  const scope = await getStaffScope();
  const myClass = scope.sectionMeta.find((m) => m.isClassTeacher) ?? null;
  const subjectSections = scope.sectionMeta.filter((m) => !m.isClassTeacher);
  const yr = scope.currentYearId ?? "";

  const classActions = myClass ? [
    { href: `/progress?section=${myClass.id}&year=${yr}`, path: "/progress", icon: ProgressIcon, label: t("nav.progress") },
    { href: `/attendance?section=${myClass.id}`, path: "/attendance", icon: AttendanceIcon, label: t("nav.attendance") },
    { href: `/marks?section=${myClass.id}`, path: "/marks", icon: MarksIcon, label: t("nav.marks") },
    { href: `/students?section=${myClass.id}`, path: "/students", icon: StudentsIcon, label: t("nav.students") },
  ] : [];

  return (
    <div>
      <DashHeader name={session.fullName} />

      {myClass && (
        <section className="mb-4 rounded-md border border-hair bg-surface p-4">
          <div className="text-[16px] font-semibold text-ink-900">{t("dashboard.myClass")}</div>
          <div className="mt-3 flex items-stretch gap-5">
            {/* Class name — left, large & regular, spanning the block height */}
            <div className="flex shrink-0 items-center">
              <span className="text-[36px] font-normal leading-none text-ink-900">{myClass.label}</span>
            </div>
            {/* 2×2 action grid */}
            <div className="grid flex-1 grid-cols-2 gap-2">
              {classActions.map((l) => {
                const Icon = l.icon;
                return (
                  <Link key={l.label} href={l.href} className="flex items-center gap-2 rounded-md border border-hair bg-surface px-3 py-3 text-[13px] font-medium text-ink-900 transition-colors hover:border-[rgb(37,99,235)]/40">
                    <Icon size={18} className={NAV_COLOR[l.path] ?? "text-[rgb(37,99,235)]"} />{l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {subjectSections.length > 0 && (
        <div className="mb-4 rounded-md border border-hair bg-surface p-4">
          <div className="mb-2.5 text-[13px] font-semibold text-ink-900">{t("dashboard.otherSubjects")}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjectSections.map((m) => (
              <Link key={m.id} href={`/progress?section=${m.id}&year=${yr}${m.subjects[0] ? `&subject=${m.subjects[0].id}` : ""}`}
                className="group rounded-md border border-hair bg-surface p-3.5 transition-colors hover:border-[rgb(37,99,235)]/40 hover:bg-[rgb(37,99,235)]/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-ink-900">{m.label}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-900">{t("dashboard.subjectOnly")}</span>
                </div>
                <div className="mt-1 text-[13px] text-ink-900"><span className="text-ink-900">{t("dashboard.teaches")}: </span>{m.subjects.map((s) => s.name).join(", ") || "—"}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4"><QuickLinks role={session.navRole as NavRole} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnnouncementsPanel />
        <EventsPanel />
      </div>
    </div>
  );
}
