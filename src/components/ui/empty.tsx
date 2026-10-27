/* eslint-disable @next/next/no-img-element -- fixed-size static illustrations */
import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/icons";

// The school's illustrations (public/art/*.png, transparent, 320×320), one per
// situation an empty or error screen can be in.
export type ArtName =
  | "nothing-yet" | "no-marks" | "pick-student" | "no-results" | "no-sections"
  | "marks-office-only" | "no-next-year" | "no-promotions" | "no-bus" | "no-bus-assigned"
  | "coming-soon-transport" | "coming-soon" | "loading"
  | "error" | "network-bad" | "not-found" | "no-access" | "session-expired" | "maintenance"
  | "saved" | "all-done" | "holiday";

export function Illustration({ name, size = 150, className }: { name: ArtName; size?: number; className?: string }) {
  return (
    <img
      src={`/art/${name}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={cn("select-none", className)}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

// Empty state that tells the user what to do next (brief §5.6). `art` picks the
// illustration; without one it shows the general "nothing here yet" picture.
// `icon` is still accepted from older call sites but no longer drawn.
export function EmptyState({
  art = "nothing-yet",
  title,
  hint,
  className,
  children,
}: {
  art?: ArtName;
  icon?: IconComponent;
  title: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <Illustration name={art} className="mb-4" />
      <p className="t-h3 text-ink-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[14px] text-ink-500">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
