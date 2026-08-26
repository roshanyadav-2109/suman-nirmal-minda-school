import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { fmtDate } from "@/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill, type Status } from "@/components/ui/status";
import { FeedbackIcon } from "@/components/icons";
import { FeedbackForm, RespondForm } from "@/components/feedback/feedback-ui";
import { getMyChildren } from "@/lib/data/analytics";

const st: Record<string, Status> = { new: "watch", read: "flat", responded: "up" };

export default async function FeedbackPage() {
  const session = (await getSession())!;
  const supabase = await createClient();
  const { t, locale } = await getT();
  const isGuardian = session.role === "guardian";

  const { data: rows } = await supabase
    .from("feedback")
    .select("id, subject, body, status, response, created_at, student:student_id(full_name)")
    .order("created_at", { ascending: false });

  const children = isGuardian ? await getMyChildren() : [];

  return (
    <div>
      <PageHeader title={t("feedback.title")} />
      <div className={isGuardian ? "grid gap-5 lg:grid-cols-[1fr_360px]" : ""}>
        <div className="space-y-3">
          {rows && rows.length ? (
            rows.map((f) => {
              const name = (f.student as unknown as { full_name: string } | null)?.full_name ?? "—";
              return (
                <Card key={f.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-ink-900">{f.subject}</div>
                        <div className="text-[12px] text-muted">{name} · {fmtDate(locale, f.created_at)}</div>
                      </div>
                      <StatusPill status={st[f.status]}>{t(`feedback.${f.status}`)}</StatusPill>
                    </div>
                    <p className="mt-2 text-[14px] text-ink-700">{f.body}</p>
                    {f.response && (
                      <div className="mt-3 rounded-sm border-l-2 border-gold-500 bg-gold-100/50 px-3 py-2 text-[13px] text-ink-700">
                        {f.response}
                      </div>
                    )}
                    {!isGuardian && !f.response && (
                      <div className="mt-3 border-t border-hair pt-3"><RespondForm id={f.id} /></div>
                    )}
                  </CardBody>
                </Card>
              );
            })
          ) : (
            <EmptyState icon={FeedbackIcon} title={t("common.noData")} hint={isGuardian ? t("feedback.send") : undefined} />
          )}
        </div>
        {isGuardian && children.length > 0 && <FeedbackForm children={children} />}
      </div>
    </div>
  );
}
