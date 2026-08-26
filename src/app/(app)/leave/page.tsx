import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { fmtDate } from "@/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill, type Status } from "@/components/ui/status";
import { LeaveIcon } from "@/components/icons";
import { LeaveForm, LeaveDecision } from "@/components/leave/leave-ui";
import { AbsenceList } from "@/components/leave/absence-ui";
import { getMyChildren } from "@/lib/data/analytics";
import { getAbsenceNotices } from "@/lib/data/absence";

const statusStatus: Record<string, Status> = { pending: "watch", approved: "up", rejected: "down", cancelled: "flat" };

export default async function LeavePage() {
  const session = (await getSession())!;
  const supabase = await createClient();
  const { t, locale } = await getT();
  const isOwner = session.role === "student" || session.role === "guardian";
  const isGuardian = session.role === "guardian";

  const [{ data: rows }, notices, children] = await Promise.all([
    supabase.from("leave_application")
      .select("id, from_date, to_date, reason, status, student:student_id(full_name)")
      .order("created_at", { ascending: false }),
    getAbsenceNotices(),
    isGuardian ? getMyChildren() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title={t("leave.title")} />
      <div className={isGuardian ? "grid gap-5 lg:grid-cols-[1fr_360px]" : ""}>
        <div className="space-y-5">
          {/* Absence notices — auto-created when a class teacher marks a pupil absent */}
          <Card>
            <CardBody>
              <AbsenceList notices={notices} canExplain={isOwner} />
            </CardBody>
          </Card>

          {/* Leave applications (guardian applies; class teacher decides) */}
          {!(session.role === "student") && (
            <Card>
              <CardHeader title={t("leave.title")} />
              <CardBody className="space-y-3 pt-1">
                {rows && rows.length ? (
                  rows.map((l) => {
                    const name = (l.student as unknown as { full_name: string } | null)?.full_name ?? "—";
                    return (
                      <div key={l.id} className="rounded-md border border-hair bg-surface p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold text-ink-900">{name}</div>
                            <div className="mt-0.5 text-[13px] text-ink-500 tabular">{fmtDate(locale, l.from_date)} – {fmtDate(locale, l.to_date)}</div>
                            <p className="mt-1 text-[14px] text-ink-700">{l.reason}</p>
                          </div>
                          <StatusPill status={statusStatus[l.status]}>{t(`leave.${l.status}`)}</StatusPill>
                        </div>
                        {!isOwner && l.status === "pending" && (
                          <div className="mt-3 border-t border-hair pt-3"><LeaveDecision id={l.id} /></div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <EmptyState icon={LeaveIcon} title={t("common.noData")} hint={isGuardian ? t("leave.apply") : undefined} />
                )}
              </CardBody>
            </Card>
          )}
        </div>
        {isGuardian && children.length > 0 && <LeaveForm students={children} />}
      </div>
    </div>
  );
}
