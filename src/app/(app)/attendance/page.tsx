import Link from "next/link";
import { getSession, getCurrentYear } from "@/lib/session";
import { getT } from "@/i18n/server";
import { fmtDate, fmtMonth } from "@/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScopeBar } from "@/components/scope-bar";
import { AttendanceBoard } from "@/components/attendance/attendance-board";
import { AttendanceOverview } from "@/components/attendance/attendance-overview";
import { AttendanceAdminControls } from "@/components/attendance/attendance-admin-controls";
import { DetailedSectionAttendance } from "@/components/attendance/detailed-section-attendance";
import { AttendanceIcon } from "@/components/icons";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import { getMyChildren } from "@/lib/data/analytics";
import { getDateAttendance, getSectionAttendanceSummary, getStudentAttendance, getLatestAttendanceDate, getLatestAttendanceDateAll, getAttendanceOverview, getSectionAttendanceRange } from "@/lib/data/attendance";
import type { AttStatus } from "@/app/(app)/attendance/actions";

import { numParam, strParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;
const str = strParam;
const statusStyle: Record<string, "up" | "down" | "watch" | "flat"> = { present: "up", absent: "down", late: "watch", leave: "flat", holiday: "flat" };
const statusText: Record<"up" | "down" | "watch" | "flat", string> = { up: "text-up", down: "text-down", watch: "text-watch", flat: "text-muted" };

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const { t, locale } = await getT();
  const year = await getCurrentYear();

  // ---- Owner: view own / child attendance ----
  if (session.role === "student" || session.role === "guardian") {
    let studentId = session.studentId;
    let children: { id: number; full_name: string; admission_no: string }[] = [];
    if (session.role === "guardian") {
      children = await getMyChildren();
      studentId = num(sp.child) ?? children[0]?.id ?? null;
    }
    if (!studentId || !year) return <EmptyState icon={AttendanceIcon} title={t("common.noData")} />;
    const att = await getStudentAttendance(studentId, year.id);
    return (
      <div>
        <PageHeader title={t("attendance.title")} />
        {session.role === "guardian" && children.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {children.map((c) => (
              <Link key={c.id} href={`/attendance?child=${c.id}`} className={`rounded-sm border px-3 py-1.5 text-[13px] font-medium ${c.id === studentId ? "border-gold-500 bg-gold-100 text-ink-900" : "border-hair bg-surface text-ink-500 hover:bg-panel"}`}>{c.full_name}</Link>
            ))}
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardBody>
              <div className="t-label">{t("attendance.percent")}</div>
              <div className={`mt-1 text-[38px] font-bold leading-none tabular ${att.pct < 75 ? "text-down" : "text-ink-900"}`}>{att.pct}%</div>
              <div className="mt-1 text-[13px] text-ink-500">{att.present} / {att.total} {t("attendance.present").toLowerCase()}</div>
              {att.pct < 75 && <div className="mt-3 text-[12px] font-medium text-down">{t("attendance.belowThreshold")}</div>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={year.name} />
            <CardBody className="pt-2">
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {att.recent.map((r, i) => {
                  const st = r.status === "late" ? "present" : r.status; // only present / absent
                  return (
                    <li key={i} className="flex items-center justify-between rounded-sm border border-hair px-2.5 py-1.5">
                      <span className="text-[13px] tabular text-ink-700">{fmtDate(locale, r.on_date, { day: "numeric", month: "short" })}</span>
                      <span className={`text-[12px] font-medium ${statusText[statusStyle[st]]}`}>{t(`attendance.${st}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Principal / Office: aggregate attendance (no per-pupil board) ----
  // Both see the day/month overview; the PRINCIPAL can also drill into a
  // section for per-student detail.
  if (session.isAdminScope) {
    const year = await getCurrentYear();
    if (!year) return (<div><PageHeader title={t("attendance.title")} /><EmptyState icon={AttendanceIcon} title={t("common.noData")} /></div>);

    const period: "day" | "month" = str(sp.period) === "month" ? "month" : "day";
    const date = str(sp.date) ?? (await getLatestAttendanceDateAll(year.id)) ?? new Date().toISOString().slice(0, 10);
    const month = str(sp.month) ?? date.slice(0, 7);

    let start = date, end = date, label = fmtDate(locale, date);
    if (period === "month") {
      const [y, m] = month.split("-").map(Number);
      start = `${month}-01`;
      end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      label = fmtMonth(locale, `${month}-01`);
    }

    const overview = await getAttendanceOverview(start, end, year.id);
    const isPrincipal = session.staffRole === "principal";
    const selectedSection = isPrincipal ? num(sp.section) : null;

    const hrefForSection = isPrincipal
      ? (secId: number) => {
          const qs = new URLSearchParams({ period });
          if (period === "day") qs.set("date", date); else qs.set("month", month);
          qs.set("section", String(secId));
          return `/attendance?${qs.toString()}`;
        }
      : undefined;

    // Selecting a section opens its own detail page (not shown below the overview).
    if (isPrincipal && selectedSection) {
      const detail = await getSectionAttendanceRange(selectedSection, start, end, year.id);
      let sectionLabel = "";
      for (const c of overview.classes) {
        const sec = c.sections.find((x) => x.id === selectedSection);
        if (sec) { sectionLabel = `${c.name}-${sec.name}`; break; }
      }
      const backQs = new URLSearchParams({ period });
      if (period === "day") backQs.set("date", date); else backQs.set("month", month);
      return (
        <div>
          <DetailedSectionAttendance students={detail} period={period} sectionLabel={sectionLabel} dateLabel={label} backHref={`/attendance?${backQs.toString()}`} />
        </div>
      );
    }

    return (
      <div>
        <PageHeader title={t("attendance.title")} description={t("x.attendanceOverview")} />
        <AttendanceAdminControls period={period} date={date} month={month} />
        <AttendanceOverview overview={overview} label={label} hrefForSection={hrefForSection} selectedSection={selectedSection} />
      </div>
    );
  }

  // ---- Teachers: mark (own class) or read-only (subject sections) ----
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (<div><PageHeader title={t("attendance.title")} /><EmptyState icon={AttendanceIcon} title={t("common.noData")} hint={t("x.attNoSections")} /></div>);
  }
  const yearId = num(sp.year) ?? scope.currentYearId;

  // Show ALL of the teacher's sections. Marking is a CLASS TEACHER duty, decided
  // PER selected section: they may mark only the section(s) they class-teach;
  // every other section (subject-only, or for principal/office) is read-only.
  const ctIds = new Set(scope.sectionMeta.filter((m) => m.isClassTeacher).map((m) => m.id));
  const sections = scope.sections;
  const section = sections.find((s) => s.id === num(sp.section)) ?? sections[0];
  const canMark = ctIds.has(section.id);
  const date = str(sp.date) ?? (await getLatestAttendanceDate(section.id)) ?? new Date().toISOString().slice(0, 10);

  const [roster, initialMap, summaryMap] = await Promise.all([
    getSectionStudents(section.id, yearId),
    getDateAttendance(section.id, date),
    getSectionAttendanceSummary(section.id, yearId),
  ]);
  const initial: Record<number, AttStatus> = {};
  for (const [k, v] of initialMap) if (v !== "holiday") initial[k] = v as AttStatus;
  const summary: Record<number, { pct: number; present: number; total: number }> = {};
  for (const [k, v] of summaryMap) summary[k] = { pct: v.pct, present: v.present, total: v.total };

  return (
    <div>
      <PageHeader eyebrow={`${section.class_name}-${section.name}`} title={t("attendance.title")}
        description={canMark ? t("attendance.markToday") : t("x.attViewOnly")} />
      <ScopeBar years={scope.years} sections={sections} yearId={yearId} sectionId={section.id} date={date} />
      <AttendanceBoard key={`${section.id}-${date}`} sectionId={section.id} yearId={yearId} date={date} roster={roster} initial={initial} summary={summary} readOnly={!canMark} />
    </div>
  );
}
