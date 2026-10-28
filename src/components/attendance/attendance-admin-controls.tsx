"use client";
import { useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/components/nav-progress";

export function AttendanceAdminControls({ period, date, month }: { period: "day" | "month"; date: string; month: string }) {
  const t = useT();
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(patch: Record<string, string>, clear: string[] = []) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    for (const k of clear) next.delete(k);
    navigate(`${pathname}?${next.toString()}`);
  }

  const Toggle = ({ p, label }: { p: "day" | "month"; label: string }) => (
    <button
      onClick={() => push({ period: p }, ["section", p === "day" ? "month" : "date"])}
      aria-pressed={period === p}
      className={cn("h-10 rounded-sm border px-3.5 text-[13px] font-medium transition-colors",
        period === p ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]")}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
      <div className="w-full sm:w-auto">
        <label className="t-label mb-1 block">{t("common.filter")}</label>
        <div className="seg flex gap-1.5">
          <Toggle p="day" label={t("x.periodDay")} />
          <Toggle p="month" label={t("x.periodMonth")} />
        </div>
      </div>
      {period === "day" ? (
        <div className="w-full sm:w-auto sm:min-w-[170px]">
          <label className="t-label mb-1 block">{t("attendance.date")}</label>
          <Input type="date" value={date} onChange={(e) => push({ date: e.target.value }, ["section"])} />
        </div>
      ) : (
        <div className="w-full sm:w-auto sm:min-w-[170px]">
          <label className="t-label mb-1 block">{t("report.month")}</label>
          <Input type="month" value={month} onChange={(e) => push({ month: e.target.value }, ["section"])} />
        </div>
      )}
    </div>
  );
}
