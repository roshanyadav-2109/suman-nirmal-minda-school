"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/components/search-box";
import { CopyLink } from "@/components/copy-link";
import { NavProgress } from "@/components/nav-progress";
import { cn } from "@/lib/utils";
import { navFor, type NavRole } from "@/lib/nav";
import { useT } from "@/i18n/provider";
import { SchoolEmblem } from "@/components/brand";
import { SCHOOL } from "@/lib/school";
import { SignOutModal } from "@/components/dashboards/profile-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";

// The standard three-line menu button, drawn plainly rather than from the illustrated set.
function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AppShell({
  name,
  role,
  roleLabel,
  children,
}: {
  name: string;
  role: NavRole;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navFor(role);

  // Desktop side menu can be hidden from the top bar for more room.
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = () => setCollapsed((c) => !c);

  // Everyone gets search; staff search people and classes, families search
  // pages and notices (and their own children).
  const isStaffRole = role === "principal" || role === "office" || role === "class_teacher" || role === "subject_teacher";

  const isDashboard = pathname === "/dashboard";

  // Longest matching prefix wins, so /transport/riders lights up its own entry
  // and not the /transport one above it. The "/" boundary keeps a href from
  // matching a sibling that merely starts with the same letters.
  const matches = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = items
    .map((i) => i.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const navList = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.labelKey}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-sm px-3 py-2 text-[14px] transition-colors",
              active ? "font-semibold text-ink-900" : "font-normal text-ink-500 hover:text-ink-900",
            )}
          >
            {active ? (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#0F6CBD]" />
            ) : (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[rgb(156,163,175)] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
            <Icon size={24} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const brandHeader = (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-hair px-4">
      <SchoolEmblem size={32} />
      <div className="leading-tight">
        <div className="text-[13px] font-bold text-ink-900">{SCHOOL.name}</div>
        {SCHOOL.place && <div className="text-[11px] text-muted">{SCHOOL.place}</div>}
      </div>
    </div>
  );

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // Everyone's name, role and sign-out sit at the foot of the side menu, on
  // every page — the same place in the desktop rail and the phone drawer —
  // with the Neural AI credit beneath.
  const personCard = (
    <div className="border-t border-hair p-3">
      <button
        onClick={() => { setOpen(false); setMenuOpen(true); }}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-panel"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-panel text-[13px] font-semibold text-ink-900">{initials}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block break-words text-[14px] font-semibold text-ink-900">{name}</span>
          <span className="block truncate text-[12px] text-ink-500">{roleLabel}</span>
        </span>
        <span className="flex flex-col items-center gap-[3px] text-ink-700" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      <a href="https://neuralai.in" target="_blank" rel="noreferrer"
        className="mt-1 block text-center text-[11px] text-ink-500 hover:text-[#0F6CBD]">
        Powered by <span className="font-semibold text-ink-700">Neural AI</span>
      </a>
    </div>
  );

  return (
    <NavProgress>
    <div className={cn("min-h-dvh bg-white lg:grid", collapsed ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[264px_1fr]")}>
      {/* Desktop side menu — attached to the left edge, full height */}
      <aside className={cn("sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-hair bg-surface", !collapsed && "lg:flex")}>
        {brandHeader}
        <div className="flex-1 overflow-y-auto">
          {navList}
        </div>
        {personCard}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-16 items-center justify-between border-b border-hair px-4">
              <div className="flex items-center gap-2.5">
                <SchoolEmblem size={32} />
                <span className="text-[13px] font-bold text-ink-900">{SCHOOL.name}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {navList}
            </div>
            {personCard}
          </aside>
        </div>
      )}

      <SignOutModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        promptLabel={t("dashboard.logoutPrompt")}
        confirmLabel={t("dashboard.confirmSignOut")}
        cancelLabel={t("dashboard.cancel")}
      />

      <div className="flex min-w-0 flex-col">
        {/* Top bar: menu button, student search for staff, a parent's language picker. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hair bg-white px-3 sm:px-4">
          <button aria-label="Menu" onClick={() => setOpen(true)} className="rounded-sm p-1.5 text-ink-700 hover:bg-panel lg:hidden">
            <HamburgerIcon />
          </button>
          <button aria-label={collapsed ? "Show menu" : "Hide menu"} title={collapsed ? "Show menu" : "Hide menu"} onClick={toggleCollapsed}
            className="hidden rounded-sm p-1.5 text-ink-700 hover:bg-panel lg:block">
            <HamburgerIcon />
          </button>
          <div className={cn(!collapsed && "lg:hidden")}>
            <SchoolEmblem size={28} />
          </div>
          {role !== "transport" && (
            <SearchBox placeholder={t(isStaffRole ? "x.searchEverything" : "x.searchFamily")} />
          )}
          <div className="ml-auto flex items-center gap-2">
            {role === "guardian" && isDashboard && <LocaleSwitcher />}
            {role !== "transport" && <CopyLink />}
          </div>
        </header>

        {/* Each section is its own block on the page — no shared wrapper. */}
        <main className="w-full flex-1 p-3 lg:px-5 lg:py-4">
          {children}
        </main>
      </div>
    </div>
    </NavProgress>
  );
}
