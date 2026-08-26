"use client";
import { useState } from "react";
import { AnnounceIcon, CloseIcon } from "@/components/icons";

export type AnnItem = { id: number; poster: string; time: string; title: string; body: string; scope: string };

// Clickable announcement cards; a card opens a ~70% modal with the full text.
export function AnnouncementsGrid({ items }: { items: AnnItem[] }) {
  const [sel, setSel] = useState<AnnItem | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => setSel(a)}
            className="flex flex-col rounded-sm border border-hair bg-surface p-5 text-left transition-colors hover:border-[rgb(37,99,235)]/40"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                <AnnounceIcon size={17} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-ink-900">{a.poster}</div>
                <div className="text-[12px] text-ink-900">{a.time}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold leading-snug text-ink-900">{a.title}</h2>
                <div className="relative mt-1.5 max-h-[5.5rem] overflow-hidden">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-900">{a.body}</p>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-surface to-transparent" />
                </div>
              </div>
              <span aria-hidden className="w-[3px] shrink-0 self-stretch rounded-full bg-[rgb(37,99,235)]/25" />
            </div>

            <div className="mt-4 border-t border-dashed border-hair" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-900">{a.scope}</div>
          </button>
        ))}
      </div>

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
            <div className="flex items-center gap-2.5 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                <AnnounceIcon size={18} />
              </span>
              <div>
                <div className="text-[14px] font-bold text-ink-900">{sel.poster}</div>
                <div className="text-[12px] text-ink-900">{sel.time}</div>
              </div>
            </div>
            <h2 className="mt-4 text-[20px] font-bold leading-snug text-ink-900">{sel.title}</h2>
            <div className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-ink-900">{sel.body}</div>
            <div className="mt-4 border-t border-dashed border-hair pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-900">{sel.scope}</div>
          </div>
        </div>
      )}
    </>
  );
}
