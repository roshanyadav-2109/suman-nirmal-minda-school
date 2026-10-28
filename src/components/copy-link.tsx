"use client";
import { useState } from "react";

// Copies the address of what's on screen (filters included) so it can be sent
// to a colleague. Whoever opens it sees it only if their role has that page.
export function CopyLink() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  return (
    <button type="button" onClick={copy} title="Copy a link to this page" aria-live="polite"
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-hair bg-surface px-2.5 text-[13px] font-medium text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      </svg>
      <span className="hidden sm:inline">{copied ? "Link copied" : "Copy link"}</span>
      {copied && <span className="sm:hidden">Copied</span>}
    </button>
  );
}
