import Link from "next/link";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { PromotionIcon } from "@/components/icons";
import { PromotionConsole } from "@/components/promotion/promotion-console";
import { PromotionSummary } from "@/components/promotion/promotion-summary";
import { NewSessionForm } from "@/components/promotion/new-session-form";
import {
  getPromotionYears, getPromotableClasses, getPromotionRoster, getSectionsByLevel, getPromotionSummary,
} from "@/lib/data/promotion";
import { numParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PromotionPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { t } = await getT();
  const session = await getSession();
  const staffRole = session?.staffRole;
  const isOffice = staffRole === "office";
  const canSummary = staffRole === "principal" || session?.isClassTeacher;

  if (!isOffice && !canSummary) {
    return (<div><PageHeader title={t("nav.promotion")} /><EmptyState icon={PromotionIcon} title={t("common.noAccess")} /></div>);
  }

  const { from, to } = await getPromotionYears();
  if (!from) {
    return (<div><PageHeader title={t("nav.promotion")} /><EmptyState icon={PromotionIcon} title={t("x.noNextYear")} hint={t("x.noNextYearHint")} /></div>);
  }
  // No next session yet → office creates one here before promoting.
  if (!to) {
    if (!isOffice) {
      return (<div><PageHeader title={t("nav.promotion")} /><EmptyState icon={PromotionIcon} title={t("x.noNextYear")} hint={t("x.noNextYearHint")} /></div>);
    }
    const base = parseInt(from.name.slice(0, 4), 10);
    const y = (Number.isFinite(base) ? base : new Date().getUTCFullYear()) + 1;
    return (
      <div>
        <PageHeader title={t("nav.promotion")} description={t("x.newSessionHint")} />
        <NewSessionForm name={`${y}-${String((y + 1) % 100).padStart(2, "0")}`} start={`${y}-04-01`} end={`${y + 1}-03-31`} />
      </div>
    );
  }

  // ---- Principal / class teacher: read-only outcome summary ----
  if (!isOffice) {
    const rows = await getPromotionSummary(to.id);
    return (
      <div>
        <PageHeader title={t("nav.promotion")} description={t("x.promotionSummaryDesc", { from: from.name, to: to.name })} />
        <PromotionSummary rows={rows} toYearName={to.name} />
      </div>
    );
  }

  // ---- Office: promotion console ----
  const classes = await getPromotableClasses(from.id, to.id);
  const selectedId = numParam(sp.class);
  const selected = classes.find((c) => c.id === selectedId) ?? null;

  let console_: React.ReactNode = null;
  if (selected) {
    const level = selected.level;
    const graduating = level >= 12;
    const [roster, same, next] = await Promise.all([
      getPromotionRoster(from.id, to.id, selected.id),
      getSectionsByLevel(level),
      graduating ? Promise.resolve(null) : getSectionsByLevel(level + 1),
    ]);
    console_ = (
      <PromotionConsole
        fromYear={from.id} toYear={to.id} toYearName={to.name}
        className={selected.name} roster={roster}
        sameSections={same?.sections ?? []} nextSections={next?.sections ?? []}
        graduating={graduating}
      />
    );
  }

  return (
    <div>
      <PageHeader title={t("nav.promotion")} description={t("x.promotionConsoleDesc", { from: from.name, to: to.name })} />

      <Card className="mb-5">
        <CardBody>
          <div className="t-label mb-2">{t("x.pickClass")}</div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const active = c.id === selectedId;
              const allDone = c.promoted >= c.students && c.students > 0;
              return (
                <Link key={c.id} href={`/promotion?class=${c.id}`}
                  className={`rounded-sm border px-3 py-2 text-[13px] transition-colors ${active ? "border-gold-500 bg-gold-100 text-ink-900" : "border-hair bg-surface text-ink-700 hover:border-gold-500 hover:bg-gold-100"}`}>
                  <span className="font-semibold">{t("common.class")} {c.name}</span>
                  <span className="ml-2 tabular text-muted">{c.students}</span>
                  {allDone && <span className="ml-2 rounded-xs bg-up-soft px-1.5 py-0.5 text-[11px] font-semibold text-up">✓</span>}
                </Link>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {console_ ?? <EmptyState icon={PromotionIcon} title={t("x.pickClassTitle")} hint={t("x.pickClassHint")} />}
    </div>
  );
}
