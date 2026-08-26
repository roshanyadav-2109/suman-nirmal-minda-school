import { getT } from "@/i18n/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PromotionIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty";
import type { PromSummaryRow } from "@/lib/data/promotion";

// Read-only promotion outcomes (principal = school-wide; class teacher = own class).
export async function PromotionSummary({ rows, toYearName }: { rows: PromSummaryRow[]; toYearName: string }) {
  const { t } = await getT();
  if (!rows.length) return <EmptyState icon={PromotionIcon} title={t("x.noPromotions")} hint={t("x.noPromotionsHint")} />;

  const tot = rows.reduce((a, r) => ({
    promoted: a.promoted + r.promoted, retained: a.retained + r.retained,
    transferred: a.transferred + r.transferred, graduated: a.graduated + r.graduated, total: a.total + r.total,
  }), { promoted: 0, retained: 0, transferred: 0, graduated: 0, total: 0 });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("x.promoted")} n={tot.promoted} tone="text-up" />
        <Kpi label={t("x.retained")} n={tot.retained} tone="text-watch" />
        <Kpi label={t("x.transferred")} n={tot.transferred} tone="text-down" />
        <Kpi label={t("x.graduated")} n={tot.graduated} tone="text-gold-700" />
      </div>
      <Card>
        <CardHeader eyebrow={t("x.promoteTo", { year: toYearName })} title={t("x.promotionByClass")} />
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-semibold">{t("common.class")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("x.promoted")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("x.retained")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("x.transferred")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("x.graduated")}</th>
                  <th className="py-2 text-right font-semibold">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.classId} className="border-t border-hair">
                    <td className="py-2 pr-3 font-medium text-ink-900">{t("common.class")} {r.className}</td>
                    <td className="py-2 pr-3 text-right text-up">{r.promoted || "–"}</td>
                    <td className="py-2 pr-3 text-right text-watch">{r.retained || "–"}</td>
                    <td className="py-2 pr-3 text-right text-down">{r.transferred || "–"}</td>
                    <td className="py-2 pr-3 text-right text-gold-700">{r.graduated || "–"}</td>
                    <td className="py-2 text-right font-semibold text-ink-900">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Kpi({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <div className="rounded-md border border-hair bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="t-label">{label}</div>
      <div className={`mt-1 text-[30px] font-bold leading-none tabular ${tone}`}>{n}</div>
    </div>
  );
}
