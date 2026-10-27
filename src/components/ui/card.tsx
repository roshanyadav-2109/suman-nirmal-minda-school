import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border border-hair bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    // A title strip across the top of the panel, like a register's header row.
    <div className={cn("flex items-center justify-between gap-3 rounded-t-md border-b border-hair bg-[#fafafa] px-4 py-2.5", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        {/* The eyebrow names the panel ("Class comparison"); the title, when
            there is one too, says what it shows ("Average") and sits after it. */}
        <h3 className="truncate text-[14px] font-semibold text-ink-900">{eyebrow || title}</h3>
        {title && eyebrow && <span className="truncate text-[13px] text-ink-500">{title}</span>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
