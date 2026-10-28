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
    // On a narrow screen the buttons drop below the title rather than cutting it off.
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-md border-b border-hair bg-[#fafafa] px-4 py-2.5", className)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        {/* The eyebrow names the panel ("Class comparison"); the title, when
            there is one too, says what it shows ("Average") and sits after it. */}
        <h3 className="text-[14px] font-semibold text-ink-900 sm:truncate">{eyebrow || title}</h3>
        {title && eyebrow && <span className="text-[13px] text-ink-500 sm:truncate">{title}</span>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
