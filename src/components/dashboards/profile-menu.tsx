"use client";
import { useState } from "react";
import { signOut } from "@/lib/actions";

// A simple human figure (waving goodbye) — the logout "artifact".
function LogoutHuman() {
  return (
    <svg viewBox="0 0 128 128" className="h-28 w-28" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="58" cy="118" rx="32" ry="5" className="fill-ink-900/10" stroke="none" />
      <circle cx="56" cy="30" r="14" className="text-ink-900" />
      <path d="M56 44 v34" className="text-ink-900" />
      <path d="M56 54 l-16 16" className="text-ink-900" />
      <path d="M56 54 l20 -16" className="text-ink-900" />
      <path d="M56 78 l-12 28" className="text-ink-900" />
      <path d="M56 78 l12 28" className="text-ink-900" />
      <path d="M84 28 q7 5 0 12" className="text-[rgb(37,99,235)]" strokeWidth={3.5} />
      <path d="M92 21 q12 9 0 22" className="text-[rgb(37,99,235)]" strokeWidth={3.5} />
    </svg>
  );
}

// Shared logout-confirmation modal (rectangular, ~70% of screen) with a human
// artifact. Used by the student profile card and the staff top-right card.
export function SignOutModal({
  open,
  onClose,
  promptLabel,
  confirmLabel,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  promptLabel: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-[92vw] flex-col items-center justify-center overflow-y-auto rounded-sm bg-surface p-6 text-center shadow-[var(--shadow-pop)] sm:h-[70vh] sm:w-[70vw] sm:p-8">
        <LogoutHuman />
        <p className="mt-6 t-h3 text-ink-900">{promptLabel}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <form action={signOut}>
            <button className="rounded-sm bg-black px-5 py-2.5 text-[13px] font-normal text-white transition-colors hover:bg-[rgb(38,38,38)]">
              {confirmLabel}
            </button>
          </form>
          <button
            onClick={onClose}
            className="rounded-sm border border-hair bg-surface px-5 py-2.5 text-[13px] font-normal text-ink-900 transition-colors hover:bg-panel"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Vertical three-dot button beside the student's name. Opens the logout modal.
export function ProfileMenu({
  promptLabel,
  confirmLabel,
  cancelLabel,
}: {
  promptLabel: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex shrink-0 flex-col items-center gap-[3px] rounded-md p-2 text-ink-900 hover:bg-surface"
      >
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
      </button>
      <SignOutModal open={open} onClose={() => setOpen(false)} promptLabel={promptLabel} confirmLabel={confirmLabel} cancelLabel={cancelLabel} />
    </>
  );
}
