"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SCHOOL } from "@/lib/school";

// The school emblem (SCHOOL.logo, a file in public/).
// Falls back to a typographic monogram if the asset is missing.
export function SchoolEmblem({ size = 40, className }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={SCHOOL.logo}
        alt={`${SCHOOL.name} emblem`}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn("object-contain", className)}
      />
    );
  }
  return (
    <div
      aria-label={`${SCHOOL.name} emblem placeholder`}
      title="School emblem slot"
      style={{ width: size, height: size }}
      className={cn(
        "flex items-center justify-center rounded-md border border-gold-500/50 bg-gold-100 text-gold-700",
        className,
      )}
    >
      <span className="font-bold tracking-tight" style={{ fontSize: size * 0.42 }}>
        {SCHOOL.monogram}
      </span>
    </div>
  );
}

export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <SchoolEmblem size={40} />
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-ink-900">{SCHOOL.name}</div>
        <div className="text-[12px] text-ink-500">{subtitle ?? SCHOOL.place}</div>
      </div>
    </div>
  );
}
