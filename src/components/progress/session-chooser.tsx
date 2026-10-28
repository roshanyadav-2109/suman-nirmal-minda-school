import Link from "next/link";
import { cn } from "@/lib/utils";

export type YearOpt = { yearId: number; yearName: string; isCurrent: boolean };

// Session picker for the student's progress: "Lifetime" (full history in one)
// plus every academic year the pupil has records for.
export function SessionChooser({
  years,
  active,
  lifetimeLabel,
  childId,
  leading,
}: {
  years: YearOpt[];
  active: string; // "lifetime" | "<yearId>"
  lifetimeLabel: string;
  childId?: number;
  leading?: React.ReactNode; // e.g. the ward switcher, shown in the same row
}) {
  const href = (session: string) => {
    const p = new URLSearchParams();
    p.set("session", session);
    if (childId) p.set("child", String(childId));
    return `/dashboard/progress?${p.toString()}`;
  };
  const opts = [{ key: "lifetime", label: lifetimeLabel }, ...years.map((y) => ({ key: String(y.yearId), label: y.yearName }))];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {leading}
      {leading && <span className="mx-1 hidden h-5 w-px bg-hair sm:block" />}
      {opts.map((o) => {
        const isActive = active === o.key;
        return (
          <Link prefetch={false}
            key={o.key}
            href={href(o.key)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
