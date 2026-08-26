import { ArrowUpRightIcon, ArrowDownRightIcon, ArrowRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Status = "up" | "watch" | "down" | "flat";

const styles: Record<Status, string> = {
  up: "bg-up-soft text-up",
  watch: "bg-watch-soft text-watch",
  down: "bg-down-soft text-down",
  flat: "bg-panel text-ink-500",
};

// Delta chip: "+7" up, "-4" down, etc. Uses semantic data-status colours only.
export function DeltaBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn("text-muted tabular", className)}>—</span>;
  }
  const status: Status = value >= 2 ? "up" : value <= -2 ? "down" : value < 0 ? "watch" : "flat";
  const Icon = status === "up" ? ArrowUpRightIcon : status === "down" || status === "watch" ? ArrowDownRightIcon : ArrowRightIcon;
  const sign = value > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xs px-1.5 py-0.5 text-[12px] font-semibold tabular",
        styles[status],
        className,
      )}
    >
      <Icon size={13} strokeWidth={2.2} />
      {sign}
      {value}
    </span>
  );
}

export function StatusPill({
  status,
  children,
  className,
}: {
  status: Status;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[12px] font-semibold", styles[status], className)}>
      {children}
    </span>
  );
}

const bandStatus: Record<string, Status> = {
  A1: "up", A2: "up", B1: "flat", B2: "flat", C1: "watch", C2: "watch", D: "down", E: "down",
};
export function BandChip({ band }: { band: string | null }) {
  if (!band) return <span className="text-muted">—</span>;
  return (
    <span className={cn("inline-block rounded-xs px-1.5 py-0.5 text-[12px] font-semibold tabular", styles[bandStatus[band] ?? "flat"])}>
      {band}
    </span>
  );
}
