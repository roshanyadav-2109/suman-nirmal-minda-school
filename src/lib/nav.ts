import {
  DashboardIcon, ProgressIcon, AttendanceIcon, MarksIcon, StudentsIcon,
  AnnounceIcon, CalendarIcon, ReportIcon, LeaveIcon, AllotmentIcon,
  PromotionIcon,
  type IconComponent,
} from "@/components/icons";

export type NavRole = "student" | "guardian" | "subject_teacher" | "class_teacher" | "principal" | "office";

export type NavItem = {
  href: string;
  icon: IconComponent;
  labelKey: string;
  roles: NavRole[];
};

const ALL: NavRole[] = ["student", "guardian", "subject_teacher", "class_teacher", "principal", "office"];

export const NAV: NavItem[] = [
  { href: "/", icon: DashboardIcon, labelKey: "nav.dashboard", roles: ALL },
  { href: "/progress", icon: ProgressIcon, labelKey: "nav.myProgress", roles: ["student"] },
  { href: "/progress", icon: ProgressIcon, labelKey: "nav.childProgress", roles: ["guardian"] },
  { href: "/progress", icon: ProgressIcon, labelKey: "nav.progress", roles: ["subject_teacher", "class_teacher", "principal"] },
  { href: "/attendance", icon: AttendanceIcon, labelKey: "nav.attendance", roles: ALL },
  { href: "/marks", icon: MarksIcon, labelKey: "nav.marks", roles: ["subject_teacher", "class_teacher", "office"] },
  { href: "/students", icon: StudentsIcon, labelKey: "nav.students", roles: ["class_teacher", "principal", "office"] },
  { href: "/announcements", icon: AnnounceIcon, labelKey: "nav.announcements", roles: ALL },
  { href: "/calendar", icon: CalendarIcon, labelKey: "nav.calendar", roles: ALL },
  { href: "/reports", icon: ReportIcon, labelKey: "nav.reports", roles: ["student", "guardian", "class_teacher", "principal", "office"] },
  { href: "/leave", icon: LeaveIcon, labelKey: "nav.leave", roles: ["student", "guardian", "class_teacher"] },
  { href: "/allotments", icon: AllotmentIcon, labelKey: "nav.allotments", roles: ["principal", "office"] },
  { href: "/promotion", icon: PromotionIcon, labelKey: "nav.promotion", roles: ["office", "principal", "class_teacher"] },
];

export function navFor(role: NavRole): NavItem[] {
  const seen = new Set<string>();
  return NAV.filter((i) => i.roles.includes(role)).filter((i) => {
    if (seen.has(i.href)) return false;
    seen.add(i.href);
    return true;
  });
}
