"use client";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import { quickSearch } from "@/app/(app)/search/actions";
import type { SearchGroup } from "@/lib/data/search";
import { cn } from "@/lib/utils";

// The top-bar search. Results appear as you type (after a short pause), grouped
// by kind; arrow keys move, Enter opens, Escape closes. Enter with nothing
// highlighted opens the full results page.
// Phones get a short placeholder so it isn't cut off mid-word.
const PHONE = "(max-width: 639px)";
function onPhoneChange(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function SearchBox({ placeholder }: { placeholder: string }) {
  const t = useT();
  const onPhone = useSyncExternalStore(onPhoneChange, () => window.matchMedia(PHONE).matches, () => false);
  const hint = onPhone ? t("x.searchShort") : placeholder;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Results only count while there is a real search term.
  const shown = q.trim().length >= 2 ? groups : [];
  // Flat list of openable hits, in display order, for keyboard movement, and
  // each hit's position in it (-1 for hits that only show information).
  const flat = shown.flatMap((g) => g.hits.filter((h) => h.href).map((h) => h.href as string));
  const position: number[][] = [];
  {
    let n = 0;
    for (const g of shown) position.push(g.hits.map((h) => (h.href ? n++ : -1)));
  }

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const id = setTimeout(() => {
      start(async () => {
        const res = await quickSearch(term);
        if (mine === seq.current) { setGroups(res); setActive(-1); }
      });
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function go(href: string) { setOpen(false); setQ(""); setGroups([]); router.push(href); }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active]);
      else if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  const term = q.trim();

  return (
    <div ref={box} className="relative w-full max-w-[520px]">
      <div className="flex items-center gap-2 rounded-md border border-hair bg-surface px-3 focus-within:border-[#0F6CBD]">
        <SearchIcon size={18} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={hint}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open && term.length >= 2}
          className="h-9 w-full bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-500"
        />
        {pending && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-hair border-t-[#0F6CBD]" aria-hidden />}
      </div>

      {open && term.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-hair bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.12)]" role="listbox">
          {shown.length === 0 && !pending && (
            <p className="px-3 py-3 text-[13px] text-ink-500">{t("x.searchNothing", { q: term })}</p>
          )}
          {shown.map((g, gi) => (
            <div key={g.key} className="border-b border-hair last:border-b-0">
              <div className="bg-[#fafafa] px-3 py-1.5 text-[12px] font-semibold text-ink-700">{g.label}</div>
              <ul>
                {g.hits.map((h, i) => {
                  const mine = position[gi][i];
                  const inner = (
                    <>
                      <span className="block truncate text-[14px] font-medium text-ink-900">{h.title}</span>
                      {h.detail && <span className="block truncate text-[12px] text-ink-500">{h.detail}</span>}
                    </>
                  );
                  return (
                    <li key={g.key + i}>
                      {h.href ? (
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(h.href!)}
                          className={cn("block w-full px-3 py-2 text-left hover:bg-[#F5F9FE]", mine >= 0 && mine === active && "bg-[#EBF3FC]")}>
                          {inner}
                        </button>
                      ) : (
                        <div className="px-3 py-2">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/search?q=${encodeURIComponent(term)}`)}
            className="block w-full border-t border-hair px-3 py-2 text-left text-[13px] font-medium text-[#0F6CBD] hover:bg-[#F5F9FE]">
            {t("x.searchSeeAll", { q: term })}
          </button>
        </div>
      )}
    </div>
  );
}
