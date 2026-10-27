import { ArrowRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Status = "up" | "watch" | "down" | "flat";

const styles: Record<Status, string> = {
  up: "bg-up-soft text-up",
  watch: "bg-watch-soft text-watch",
  down: "bg-down-soft text-down",
  flat: "bg-panel text-ink-500",
};

// Numbers stay black everywhere; status is carried only by a small coloured
// triangle beside them — green ▲ good, yellow ▼ keep an eye on it, red ▼ needs attention.
export type Tone = "up" | "watch" | "down";
const TRIANGLE_COLOUR: Record<Tone, string> = { up: "#16A34A", watch: "#EAB308", down: "#DC2626" };

export function TrendArrow({ tone, size = 14, className }: { tone: Tone; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={TRIANGLE_COLOUR[tone]} aria-hidden
      className={cn("inline-block shrink-0", className)}>
      {tone === "up" ? <path d="M12 4 22 20H2z" /> : <path d="M12 20 2 4h20z" />}
    </svg>
  );
}

// Delta chip: "+7" up, "-4" down, etc. Black figure, coloured arrow.
export function DeltaBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn("text-muted tabular", className)}>—</span>;
  }
  const status: Status = value >= 2 ? "up" : value <= -2 ? "down" : value < 0 ? "watch" : "flat";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-xs bg-panel px-1.5 py-0.5 text-[12px] font-semibold tabular text-ink-900", className)}>
      {status === "flat" ? <ArrowRightIcon size={12} /> : <TrendArrow tone={status} size={12} />}
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
