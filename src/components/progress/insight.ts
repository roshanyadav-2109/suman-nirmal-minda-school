import type { TFunction } from "@/i18n/translate";

// Build a localized "needs support" reason from the RPC's component columns
// (so it renders in the active locale instead of a pre-built English string).
export function supportReason(
  t: TFunction,
  s: { avg_percent: number; weak_subjects: string | null; recent_trend: number },
): string {
  const parts: string[] = [];
  if (s.avg_percent < 40) parts.push(t("x.reasonOverall", { avg: Math.round(s.avg_percent) }));
  if (s.weak_subjects) parts.push(t("x.reasonWeak", { subjects: s.weak_subjects }));
  if (Number(s.recent_trend) < 0) parts.push(t("x.reasonTrend", { pts: Math.abs(Math.round(Number(s.recent_trend))) }));
  return parts.join(" · ");
}
