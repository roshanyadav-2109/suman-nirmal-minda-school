/* eslint-disable @next/next/no-img-element -- Cloudinary already serves sized, compressed images */
"use client";
import { AnnounceIcon, CloseIcon } from "@/components/icons";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty";
import { cldImage } from "@/lib/cloudinary-url";

export type AnnItem = { id: number; title: string; body: string; date: string; imageUrl?: string | null };

// Clickable announcement rows; a row opens a rectangular modal (~60% of the
// screen) with the full announcement text.
export function AnnouncementsList({ items, emptyLabel }: { items: AnnItem[]; emptyLabel: string }) {
  const [sel, setSel] = useState<AnnItem | null>(null);
  if (!items.length) return <EmptyState title={emptyLabel} />;

  return (
    <>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setSel(a)}
              className="flex w-full gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-panel"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                <AnnounceIcon size={26} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink-900">{a.title}</div>
                <div className="line-clamp-1 text-[13px] text-ink-900">{a.body}</div>
                <div className="mt-0.5 text-[12px] text-ink-900">{a.date}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {sel && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-md" onClick={() => setSel(null)} />
          <div className="relative z-10 flex h-[85vh] w-[92vw] flex-col rounded-sm bg-surface p-6 shadow-[var(--shadow-pop)] sm:h-[70vh] sm:w-[70vw]">
            <button
              aria-label="Close"
              onClick={() => setSel(null)}
              className="absolute right-3 top-3 rounded-sm p-1.5 text-ink-900 hover:bg-panel"
            >
              <CloseIcon size={20} />
            </button>
            <div className="pr-8">
              <div className="text-[12px] font-medium text-ink-900">{sel.date}</div>
              <h2 className="t-h2 mt-1 text-ink-900">{sel.title}</h2>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
              {sel.imageUrl && (
                <img src={cldImage(sel.imageUrl, "c_limit,w_1400,q_auto,f_auto")} alt=""
                  className="mb-4 max-h-[50vh] w-full rounded-sm border border-hair object-contain" />
              )}
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-900">{sel.body}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
