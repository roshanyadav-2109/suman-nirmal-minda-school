"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/manage/students", label: "Students" },
  { href: "/dashboard/manage/teachers", label: "Assigned Teachers" },
  { href: "/dashboard/manage/classes", label: "Classes & Subjects" },
  { href: "/dashboard/manage/exams", label: "Exams" },
  { href: "/dashboard/manage/access", label: "Give access" },
];

// The parts of Manage School, as tabs along the top.
export function ManageTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5 border-b border-hair pb-3" aria-label="Manage School">
      {TABS.map((tab) => {
        const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} aria-current={on ? "page" : undefined}
            className={cn("rounded-sm border px-3.5 py-2 text-[14px] font-medium transition-colors",
              on ? "border-[#0F6CBD] bg-[#EBF3FC] font-semibold text-[#0F6CBD]" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]")}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
