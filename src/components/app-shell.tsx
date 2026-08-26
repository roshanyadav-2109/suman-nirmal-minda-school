"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { navFor, type NavRole } from "@/lib/nav";
import { useT } from "@/i18n/provider";
import { SchoolEmblem } from "@/components/brand";
import { SCHOOL } from "@/lib/school";
import { SignOutModal } from "@/components/dashboards/profile-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";

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

  // Every role gets the white floating rail; only the student carries identity
  // in their dashboard (so the top-bar identity menu is hidden for them).
  const isStudent = role === "student";
  const isDashboard = pathname === "/";

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[rgb(37,99,235)]" />
            ) : (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[rgb(156,163,175)] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
            <Icon size={18} className={active ? "text-[rgb(37,99,235)]" : "text-muted"} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const brandHeader = (
    <div className="flex h-16 items-center gap-2.5 px-4">
      <SchoolEmblem size={36} />
      <div className="leading-tight">
        <div className="text-[13px] font-bold text-ink-900">{SCHOOL.name}</div>
        {SCHOOL.place && <div className="text-[11px] text-muted">{SCHOOL.place}</div>}
      </div>
    </div>
  );

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // Non-students carry their identity + sign-out in a card at the TOP-RIGHT
  // (like the student's dashboard profile card).
  // The identity/sign-out card lives only on the dashboard (like the student's).
  const personMenu = !isStudent && isDashboard ? (
    <>
      <button onClick={() => setMenuOpen(true)} aria-haspopup="dialog" className="flex items-center gap-2.5 rounded-md border border-hair bg-surface px-2.5 py-1.5 hover:bg-panel">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[12px] font-semibold text-white">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block truncate text-[13px] font-semibold text-ink-900">{name}</span>
          <span className="block truncate text-[12px] text-ink-900">{roleLabel}</span>
        </span>
        <span className="flex flex-col items-center gap-[3px] text-ink-900" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      <SignOutModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        promptLabel={t("dashboard.logoutPrompt")}
        confirmLabel={t("dashboard.confirmSignOut")}
        cancelLabel={t("dashboard.cancel")}
      />
    </>
  ) : null;

  // Rail footer: vendor wordmark ("hebrew" over "technologies"). "hebrew" sets
  // the width; "technologies" spreads its letters to fill that exact width.
  const brandFooter = (
    <div className="px-4 py-4 text-center">
      <a href="https://hebrewtechnologies.com" target="_blank" rel="noreferrer" className="inline-block">
        <div className="text-[24px] font-medium lowercase leading-none tracking-[0.08em] text-ink-900">hebrew</div>
        <div className="mt-1.5 flex justify-between text-[12px] font-normal lowercase leading-none text-muted" aria-hidden>
          {"technologies".split("").map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
        <span className="sr-only">technologies</span>
      </a>
    </div>
  );

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar — white floating rail for every role */}
      <aside className="sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-md border border-hair bg-surface lg:flex">
        {brandHeader}
        <div className="flex-1 overflow-y-auto">
          {navList}
        </div>
        {brandFooter}
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
              <button
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
                className="rounded-sm p-1.5 text-ink-500 hover:bg-panel"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {navList}
            </div>
            {brandFooter}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* No full navbar — just the mobile hamburger + a person card top-right. */}
        <header className={cn("flex h-14 items-center gap-3 px-3 sm:px-5", !personMenu && "lg:hidden")}>
          <button aria-label="Menu" onClick={() => setOpen(true)} className="rounded-sm p-1.5 text-ink-700 hover:bg-panel lg:hidden">
            <MenuIcon size={20} />
          </button>
          <div className="lg:hidden">
            <SchoolEmblem size={28} />
          </div>
          {(personMenu || (role === "guardian" && isDashboard)) && (
            <div className="ml-auto flex items-center gap-2">
              {role === "guardian" && isDashboard && <LocaleSwitcher />}
              {personMenu}
            </div>
          )}
        </header>

        {/* Each section is its own block on the page — no shared wrapper. */}
        <main className="w-full flex-1 p-3 lg:py-3 lg:pl-1 lg:pr-3">
          {children}
        </main>
      </div>
    </div>
  );
}
