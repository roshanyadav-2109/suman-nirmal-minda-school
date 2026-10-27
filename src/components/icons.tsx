/* eslint-disable @next/next/no-img-element -- fixed-size static icons; next/image adds nothing here */
// Central icon set — the school's own illustrated icons (public/icons/*.png,
// transparent, 128×128), cut from the approved icon sheets. This is the ONLY
// place icons are referenced: every page imports these names, so swapping an
// icon means replacing its PNG.

export type IconProps = { className?: string; size?: number; strokeWidth?: number };
export type IconComponent = React.ComponentType<IconProps>;

function make(name: string, file: string): IconComponent {
  function Icon({ className, size = 18 }: IconProps) {
    return (
      <img
        src={`/icons/${file}.png`}
        width={size}
        height={size}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className={className}
        style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }
  Icon.displayName = name;
  return Icon;
}

// ── Side menu ────────────────────────────────────────────────────────────────
export const DashboardIcon = make("DashboardIcon", "dashboard");
export const BusIcon = make("BusIcon", "transport");
export const BusRidersIcon = make("BusRidersIcon", "bus-riders");
export const ProgressIcon = make("ProgressIcon", "progress");
export const AttendanceIcon = make("AttendanceIcon", "attendance");
export const MarksIcon = make("MarksIcon", "marks");
export const StudentsIcon = make("StudentsIcon", "students");
export const AnnounceIcon = make("AnnounceIcon", "announcements");
export const CalendarIcon = make("CalendarIcon", "calendar");
export const ReportIcon = make("ReportIcon", "reports");
export const LeaveIcon = make("LeaveIcon", "leave");
export const FeedbackIcon = make("FeedbackIcon", "feedback");
export const AllotmentIcon = make("AllotmentIcon", "assigned-teachers");
export const PromotionIcon = make("PromotionIcon", "promotion");

// ── Sign-in roles ────────────────────────────────────────────────────────────
export const RolePrincipalIcon = make("RolePrincipalIcon", "role-principal");
export const RoleTeacherIcon = make("RoleTeacherIcon", "role-teacher");
export const RoleParentIcon = make("RoleParentIcon", "role-parent");
export const RoleStudentIcon = make("RoleStudentIcon", "role-student");
export const RoleOfficeIcon = make("RoleOfficeIcon", "role-office");
export const RoleConductorIcon = make("RoleConductorIcon", "role-conductor");
export const AwardIcon = RolePrincipalIcon;

// ── Buttons and small UI ─────────────────────────────────────────────────────
export const MenuIcon = make("MenuIcon", "menu");
export const CloseIcon = make("CloseIcon", "close");
export const LogoutIcon = make("LogoutIcon", "signout");
export const LanguageIcon = make("LanguageIcon", "language");
export const SearchIcon = make("SearchIcon", "search");
export const PlusIcon = make("PlusIcon", "add");
export const CheckIcon = make("CheckIcon", "check");
export const AlertIcon = make("AlertIcon", "alert");
export const ArrowRightIcon = make("ArrowRightIcon", "arrow-right");
export const ArrowUpRightIcon = make("ArrowUpRightIcon", "trend-up");
export const ArrowDownRightIcon = make("ArrowDownRightIcon", "trend-down");
export const ChartLineIcon = make("ChartLineIcon", "chart-line");
export const ViewsIcon = make("ViewsIcon", "chart-bar");
export const NotebookIcon = make("NotebookIcon", "notebook");
export const PrintIcon = make("PrintIcon", "print");
export const ExcelIcon = make("ExcelIcon", "excel");
