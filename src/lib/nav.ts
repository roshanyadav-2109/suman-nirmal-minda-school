import {
  DashboardIcon, ProgressIcon, AttendanceIcon, MarksIcon, StudentsIcon,
  AnnounceIcon, CalendarIcon, ReportIcon, LeaveIcon, AllotmentIcon,
  PromotionIcon, RoleStudentIcon, ExcelIcon, NotebookIcon,
  BusIcon, BusRidersIcon,
  type IconComponent,
} from "@/components/icons";

export type NavRole = "student" | "guardian" | "subject_teacher" | "class_teacher" | "principal" | "office" | "transport";

export type NavItem = {
  href: string;
  icon: IconComponent;
  labelKey: string;
  roles: NavRole[];
};

const ALL: NavRole[] = ["student", "guardian", "subject_teacher", "class_teacher", "principal", "office"];

export const NAV: NavItem[] = [
  { href: "/dashboard", icon: DashboardIcon, labelKey: "nav.dashboard", roles: ALL },
  { href: "/dashboard/transport", icon: BusIcon, labelKey: "nav.transport", roles: [...ALL, "transport"] },
  { href: "/dashboard/transport/riders", icon: BusRidersIcon, labelKey: "nav.transportRiders", roles: ["principal", "office"] },
  { href: "/dashboard/progress", icon: ProgressIcon, labelKey: "nav.myProgress", roles: ["student"] },
  { href: "/dashboard/progress", icon: ProgressIcon, labelKey: "nav.childProgress", roles: ["guardian"] },
  { href: "/dashboard/progress", icon: ProgressIcon, labelKey: "nav.progress", roles: ["subject_teacher", "class_teacher", "principal"] },
  { href: "/dashboard/attendance", icon: AttendanceIcon, labelKey: "nav.attendance", roles: ALL },
  { href: "/dashboard/schedule", icon: CalendarIcon, labelKey: "nav.schedule", roles: ALL },
  { href: "/dashboard/marks", icon: MarksIcon, labelKey: "nav.marks", roles: ["subject_teacher", "class_teacher", "office"] },
  { href: "/dashboard/students", icon: StudentsIcon, labelKey: "nav.students", roles: ["class_teacher", "principal", "office"] },
  { href: "/dashboard/announcements", icon: AnnounceIcon, labelKey: "nav.announcements", roles: ALL },
  { href: "/dashboard/calendar", icon: CalendarIcon, labelKey: "nav.calendar", roles: ALL },
  { href: "/dashboard/reports", icon: ReportIcon, labelKey: "nav.reports", roles: ["student", "guardian", "class_teacher", "principal", "office"] },
  { href: "/dashboard/fees", icon: ExcelIcon, labelKey: "nav.fees", roles: ["student", "guardian", "principal", "office"] },
  { href: "/dashboard/library", icon: NotebookIcon, labelKey: "nav.library", roles: ["student", "subject_teacher", "class_teacher", "principal", "office"] },
  { href: "/dashboard/leave", icon: LeaveIcon, labelKey: "nav.leave", roles: ["student", "guardian", "class_teacher"] },
  { href: "/dashboard/allotments", icon: AllotmentIcon, labelKey: "nav.allotments", roles: ["principal", "office"] },
  { href: "/dashboard/promotion", icon: PromotionIcon, labelKey: "nav.promotion", roles: ["office", "principal", "class_teacher"] },
  { href: "/dashboard/manage", icon: AllotmentIcon, labelKey: "nav.manage", roles: ["office"] },
  { href: "/dashboard/details", icon: RoleStudentIcon, labelKey: "nav.details", roles: ["student"] },
];

export function navFor(role: NavRole): NavItem[] {
  const seen = new Set<string>();
  return NAV.filter((i) => i.roles.includes(role)).filter((i) => {
    if (seen.has(i.href)) return false;
    seen.add(i.href);
    return true;
  });
}
