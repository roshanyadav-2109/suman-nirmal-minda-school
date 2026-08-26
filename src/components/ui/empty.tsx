import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/icons";

// Empty state that tells the user what to do next (brief §5.6).
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
  children,
}: {
  icon?: IconComponent;
  title: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-md border border-dashed border-hair bg-panel/40 px-6 py-10 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-gold-100 text-gold-700">
          <Icon size={20} />
        </div>
      )}
      <p className="t-h3 text-ink-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[14px] text-ink-500">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
