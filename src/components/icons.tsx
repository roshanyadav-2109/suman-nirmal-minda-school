// Central icon set — the school's own two-tone line icons, drawn to the school
// emblem's palette. This is the ONLY place icons are defined: every page imports
// from here, so the whole set changes in one file.
//
//   outline  currentColor (inherits the text colour, so a menu item can grey out)
//   fill     emblem sky blue #4FB0EE at low opacity — the soft tint behind a shape
//   accent   emblem red #E11B22 — a small mark only (a dot, a ribbon, a pin)
//
// Every icon sits on a 24×24 grid with a 1.75 stroke and round joins, so the set
// reads as one family at 18px.

export type IconProps = { className?: string; size?: number; strokeWidth?: number };
export type IconComponent = React.ComponentType<IconProps>;

const SKY = "#4FB0EE";
const RED = "#E11B22";
// Tint props for the soft fill behind a shape.
const tint = { fill: SKY, fillOpacity: 0.35 } as const;

function make(name: string, body: React.ReactNode): IconComponent {
  function Icon({ className, size = 18, strokeWidth = 1.75 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        focusable="false"
      >
        {body}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

// ── Side menu ────────────────────────────────────────────────────────────────

export const DashboardIcon = make("DashboardIcon", <>
  <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...tint} />
  <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
  <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
  <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
</>);

export const BusIcon = make("BusIcon", <>
  <rect x="5" y="3" width="14" height="15" rx="3" />
  <rect x="7.5" y="6" width="9" height="5" rx="1" {...tint} />
  <path d="M5 8H3.5v3M19 8h1.5v3" />
  <circle cx="8.5" cy="14.5" r="1" />
  <circle cx="15.5" cy="14.5" r="1" />
  <path d="M11 14.5h2M7.5 18v2.5M16.5 18v2.5" />
</>);

export const BusRidersIcon = make("BusRidersIcon", <>
  <rect x="2" y="6" width="12.5" height="10" rx="2" />
  <rect x="4" y="8.2" width="3.5" height="3" rx="0.6" {...tint} />
  <rect x="9" y="8.2" width="3.5" height="3" rx="0.6" {...tint} />
  <circle cx="5.5" cy="17" r="1.6" />
  <circle cx="11.5" cy="17" r="1.6" />
  <circle cx="19" cy="7" r="1.6" />
  <path d="M19 9.5v5.5M19 15l-1.3 4.5M19 15l1.3 4.5M17.3 12h3.4" />
</>);

export const ProgressIcon = make("ProgressIcon", <>
  <path d="M5.5 18.5 10 13l3.5 2.2L19 8.5v10z" {...tint} stroke="none" />
  <path d="M4 3.5v16.5h16.5" />
  <path d="m5.5 17.5 4.5-4.5 3.5 2.2 6-6.7" />
  <path d="M15.5 8.5H19.5V12.5" />
</>);

export const AttendanceIcon = make("AttendanceIcon", <>
  <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
  <rect x="9" y="3" width="6" height="3" rx="1" />
  <circle cx="12" cy="11.5" r="3.5" {...tint} />
  <path d="m10.4 11.6 1.1 1.1 2.2-2.4M8.5 17.5h7" />
  <circle cx="12" cy="2.6" r="1.1" fill={RED} stroke="none" />
</>);

export const MarksIcon = make("MarksIcon", <>
  <path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l4 4v3" />
  <path d="M13 3v4h4" />
  <circle cx="9.5" cy="11.5" r="2.5" stroke={RED} />
  <path d="M7 16.5h4.5" />
  <path d="m19.8 11.3 1.6 1.6-6.6 6.6-2.4.8.8-2.4z" {...tint} />
</>);

export const StudentsIcon = make("StudentsIcon", <>
  <circle cx="17" cy="9" r="2.5" />
  <path d="M13.5 19.5a4 4 0 0 1 7.5-1.8" />
  <circle cx="9" cy="11" r="3" />
  <path d="M3 21a6 6 0 0 1 12 0z" {...tint} />
  <path d="M4.5 6 9 4l4.5 2L9 8z" {...tint} />
  <path d="M5.5 6.5v2.5" />
</>);

export const AnnounceIcon = make("AnnounceIcon", <>
  <path d="M3.5 10v4h3l8.5 4.5V5.5L6.5 10z" {...tint} />
  <path d="m6.5 14 1.2 5h2.6l-.9-4" />
  <circle cx="17.2" cy="12" r="1.1" fill={RED} stroke="none" />
  <path d="m19.5 8 1.5-1M20 12h2M19.5 16l1.5 1" stroke={RED} />
</>);

export const CalendarIcon = make("CalendarIcon", <>
  <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
  <path d="M8 3v4M16 3v4M3.5 9.5h17" />
  <rect x="10.5" y="13" width="3" height="3" rx="0.8" {...tint} />
  <path d="M7 13.5h.01M7 17h.01M17 13.5h.01M17 17h.01" strokeWidth={2.4} />
</>);

export const ReportIcon = make("ReportIcon", <>
  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
  <path d="M14 3v5h5" />
  <rect x="8.25" y="15" width="2" height="3" rx="0.4" {...tint} stroke="none" />
  <rect x="11.25" y="12.5" width="2" height="5.5" rx="0.4" {...tint} stroke="none" />
  <path d="M9.25 18v-1M12.25 18v-3.5M15.25 18v-6" />
</>);

export const LeaveIcon = make("LeaveIcon", <>
  <path d="M11 18H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
  <path d="M7 3v3.5M12 3v3.5M3 9.5h13" />
  <path d="m21.5 12-9 3.5 3 1.2 1.2 3.3z" {...tint} />
  <path d="m15.5 16.7 2.5-2.2" />
</>);

export const FeedbackIcon = make("FeedbackIcon", <>
  <path d="M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 3.5V18H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" {...tint} />
  <path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth={2.6} />
</>);

export const AllotmentIcon = make("AllotmentIcon", <>
  <rect x="9" y="3" width="12" height="8" rx="1" />
  <rect x="15" y="3" width="6" height="8" rx="1" {...tint} stroke="none" />
  <circle cx="5" cy="4.8" r="1.6" />
  <path d="M2.5 11V9a2.5 2.5 0 0 1 4.6-1.3L11.5 6" />
  <path d="M12 11v3M5 14h14M5 14v1.5M12 14v1.5M19 14v1.5" />
  <circle cx="5" cy="18" r="1.3" {...tint} />
  <circle cx="12" cy="18" r="1.3" {...tint} />
  <circle cx="19" cy="18" r="1.3" {...tint} />
  <path d="M3 21.5a2 2 0 0 1 4 0M10 21.5a2 2 0 0 1 4 0M17 21.5a2 2 0 0 1 4 0" />
</>);

export const PromotionIcon = make("PromotionIcon", <>
  <rect x="3" y="15" width="5" height="5.5" rx="0.6" />
  <rect x="9.5" y="11" width="5" height="9.5" rx="0.6" />
  <rect x="16" y="7" width="5" height="13.5" rx="0.6" {...tint} />
  <path d="M3.5 11.5C8 10.5 11.5 8 13.5 3.5" />
  <path d="M10.8 4.2 13.5 3.5l.9 2.7" />
</>);

// ── Sign-in roles ────────────────────────────────────────────────────────────

export const RolePrincipalIcon = make("RolePrincipalIcon", <>
  <path d="m8.8 14.6-2.3 6.4 2.8-1.2 1.6 2.4 1.3-5.6M15.2 14.6l2.3 6.4-2.8-1.2-1.6 2.4-1.3-5.6" fill={RED} />
  <circle cx="12" cy="9.5" r="6.5" />
  <circle cx="12" cy="9.5" r="4" {...tint} />
  <path d="m12 7.3.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" strokeWidth={1.2} />
</>);

export const RoleTeacherIcon = make("RoleTeacherIcon", <>
  <path d="M2.5 6.5c3-1.5 6.2-1 9.5 1 3.3-2 6.5-2.5 9.5-1V19c-3-1.5-6.2-1-9.5 1-3.3-2-6.5-2.5-9.5-1z" {...tint} />
  <path d="M12 7.5V20M5 10.5h4M5 13.5h4" />
  <path d="m19.5 3.5 1.5 1.5-5 5-2 .6.6-2z" />
</>);

export const RoleParentIcon = make("RoleParentIcon", <>
  <circle cx="8" cy="4.5" r="2" />
  <path d="M5.5 21v-6.5H5V10a3 3 0 0 1 6 0v4.5h-.5V21z" {...tint} />
  <circle cx="17" cy="10.5" r="1.7" />
  <path d="M15.5 21v-2.5h-1l1.3-4.5h2.4l1.3 4.5h-1V21" />
  <path d="m11 12.2 3.8 2" />
</>);

export const RoleStudentIcon = make("RoleStudentIcon", <>
  <path d="M5 21.5a7 7 0 0 1 14 0z" {...tint} />
  <circle cx="12" cy="11.5" r="3.5" fill="#fff" />
  <path d="M3.5 7 12 3.5 20.5 7 12 10.5z" fill="#fff" />
  <path d="M3.5 7 12 3.5 20.5 7 12 10.5z" {...tint} />
  <path d="M5.5 8v3.5" />
</>);

export const RoleOfficeIcon = make("RoleOfficeIcon", <>
  <path d="M3 9.5 12 4l9 5.5z" {...tint} />
  <circle cx="12" cy="7.3" r="0.9" />
  <path d="M6 11.5v6.5M10 11.5v6.5M14 11.5v6.5M18 11.5v6.5M4 18.5h16M3 21h18" />
</>);

export const RoleConductorIcon = make("RoleConductorIcon", <>
  <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
  <rect x="7.5" y="12" width="9" height="3.5" rx="0.8" {...tint} />
  <path d="M8.5 19.5v2M15.5 19.5v2" />
  <path d="M12 9s-3-2.8-3-5a3 3 0 0 1 6 0c0 2.2-3 5-3 5z" fill={RED} stroke={RED} />
  <circle cx="12" cy="4" r="1" fill="#fff" stroke="none" />
</>);

// ── Buttons and small UI ─────────────────────────────────────────────────────

export const MenuIcon = make("MenuIcon", <path d="M4 6.5h16M4 12h16M4 17.5h16" />);

export const CloseIcon = make("CloseIcon", <path d="m6 6 12 12M18 6 6 18" />);

export const LogoutIcon = make("LogoutIcon", <>
  <path d="M13 4H6v16h7" />
  <path d="M6 4l6 2v14l-6 0z" {...tint} />
  <path d="M15 12h6.5M19 9.5l2.5 2.5-2.5 2.5" stroke={RED} />
</>);

export const LanguageIcon = make("LanguageIcon", <>
  <circle cx="10" cy="10" r="7" {...tint} />
  <path d="M3 10h14M10 3c2 2 2.8 4.3 2.8 7s-.8 5-2.8 7M10 3c-2 2-2.8 4.3-2.8 7s.8 5 2.8 7" />
  <circle cx="17.5" cy="17.5" r="4.5" fill="#fff" />
  <path d="m15.8 19.6 1.7-4.2 1.7 4.2M16.4 18.3h2.2" strokeWidth={1.4} />
</>);

export const SearchIcon = make("SearchIcon", <>
  <circle cx="10.5" cy="10.5" r="6.5" {...tint} />
  <path d="m15.5 15.5 5 5" />
</>);

export const PlusIcon = make("PlusIcon", <>
  <rect x="3.5" y="3.5" width="17" height="17" rx="4" {...tint} />
  <path d="M12 8v8M8 12h8" />
</>);

export const CheckIcon = make("CheckIcon", <>
  <circle cx="12" cy="12" r="8.5" {...tint} />
  <path d="m8.5 12.2 2.4 2.4 4.6-5" />
</>);

export const AlertIcon = make("AlertIcon", <>
  <path d="M10.3 4.2 2.6 17.7A2 2 0 0 0 4.3 20.7h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
  <path d="M12 9.5V14M12 17.2h.01" stroke={RED} strokeWidth={2.2} />
</>);

export const ArrowRightIcon = make("ArrowRightIcon", <path d="m9 5.5 6.5 6.5L9 18.5" />);

// Trend arrows inherit the badge colour (green up, red down), so no tint here.
export const ArrowUpRightIcon = make("ArrowUpRightIcon", <path d="M7 17 17 7M9 7h8v8" />);
export const ArrowDownRightIcon = make("ArrowDownRightIcon", <path d="M7 7l10 10M17 9v8H9" />);

// Bar-chart toggle (beside the line-chart toggle, which is ProgressIcon).
export const ViewsIcon = make("ViewsIcon", <>
  <rect x="4" y="13" width="4" height="7" rx="0.8" />
  <rect x="10" y="9" width="4" height="11" rx="0.8" {...tint} />
  <rect x="16" y="4" width="4" height="16" rx="0.8" {...tint} />
</>);

export const NotebookIcon = make("NotebookIcon", <>
  <rect x="6" y="3" width="14" height="18" rx="2" />
  <path d="M9 3v18" {...tint} />
  <path d="M4 7h3.5M4 11h3.5M4 15h3.5M12 8h5M12 12h5M12 16h3" />
</>);

// Login demo tiles still ask for these two names.
export const AwardIcon = RolePrincipalIcon;
