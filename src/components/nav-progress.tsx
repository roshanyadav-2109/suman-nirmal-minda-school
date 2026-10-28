"use client";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NavigateCtx = createContext<(href: string) => void>(() => {});

// Filters and pickers change the address with this instead of router.push, so
// the bar at the top shows the moment they're used.
export function useNavigate() {
  return useContext(NavigateCtx);
}

// A thin bar across the top of the screen from the moment someone clicks a link
// or changes a filter until the new page is on screen — so every click visibly
// "takes", even while the server is still answering.
export function NavProgress({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const [pushing, start] = useTransition();
  // Set when a link is clicked: the address we were on. We have arrived once
  // the address differs from it.
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const qs = (s: string) => new URLSearchParams(s).toString();
      const from = window.location.pathname + (qs(window.location.search) ? `?${qs(window.location.search)}` : "");
      const to = url.pathname + (qs(url.search) ? `?${qs(url.search)}` : "");
      if (to === from) return;
      setLeaving(from);
      clearTimeout(timer);
      timer = setTimeout(() => setLeaving(null), 15000); // never stuck if a navigation is abandoned
    }
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); clearTimeout(timer); };
  }, []);

  const busy = pushing || leaving === here;
  const navigate = (href: string) => start(() => router.push(href));

  return (
    <NavigateCtx.Provider value={navigate}>
      {busy && <div className="nav-progress" role="progressbar" aria-label="Loading" />}
      {children}
    </NavigateCtx.Provider>
  );
}
