"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function AttendanceAdminControls({ period, date, month }: { period: "day" | "month"; date: string; month: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(patch: Record<string, string>, clear: string[] = []) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    for (const k of clear) next.delete(k);
    router.push(`${pathname}?${next.toString()}`);
  }

  const Toggle = ({ p, label }: { p: "day" | "month"; label: string }) => (
    <button
      onClick={() => push({ period: p }, ["section", p === "day" ? "month" : "date"])}
      aria-pressed={period === p}
      className={cn("h-10 rounded-sm px-3 text-[13px] font-medium transition-colors",
        period === p ? "bg-ink-900 text-gold-100" : "bg-panel text-ink-900 hover:bg-[rgb(37,99,235)]/[0.05]")}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div>
        <label className="t-label mb-1 block">{t("common.filter")}</label>
        <div className="flex gap-1.5">
          <Toggle p="day" label={t("x.periodDay")} />
          <Toggle p="month" label={t("x.periodMonth")} />
        </div>
      </div>
      {period === "day" ? (
        <div className="min-w-[170px]">
          <label className="t-label mb-1 block">{t("attendance.date")}</label>
          <Input type="date" value={date} onChange={(e) => push({ date: e.target.value }, ["section"])} />
        </div>
      ) : (
        <div className="min-w-[170px]">
          <label className="t-label mb-1 block">{t("report.month")}</label>
          <Input type="month" value={month} onChange={(e) => push({ month: e.target.value }, ["section"])} />
        </div>
      )}
    </div>
  );
}
