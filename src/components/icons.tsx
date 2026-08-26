// Central icon set — Hugeicons. This is the ONLY place the icon library is
// referenced, so swapping the free set for a premium Hugeicons license (or any
// other consistent line set) is a one-file change. Single stroke width for a
// calm, consistent look (brief §5.5).
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  ChartLineData02Icon,
  TaskDone01Icon,
  PencilEdit02Icon,
  UserMultipleIcon,
  Megaphone01Icon,
  Calendar03Icon,
  File01Icon,
  Airplane01Icon,
  Message01Icon,
  Structure01Icon,
  Menu01Icon,
  Cancel01Icon,
  Logout01Icon,
  Login03Icon,
  TranslationIcon,
  GraduationCapIcon,
  ArrowUpRight01Icon,
  ArrowDownRight01Icon,
  ArrowRight01Icon,
  Alert01Icon,
  AlertCircleIcon,
  ChampionIcon,
  Award01Icon,
  Search01Icon,
  Time04Icon,
  InboxIcon,
  SentIcon,
  UserIcon,
  Notebook01Icon,
  TestTube01Icon,
  CheckmarkCircle01Icon,
  Add01Icon,
  ArrowUpDoubleIcon,
  Comment01Icon,
  RepeatIcon,
  FavouriteIcon,
  Analytics01Icon,
  Share08Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

export type IconProps = { className?: string; size?: number; strokeWidth?: number };
export type IconComponent = React.ComponentType<IconProps>;

function make(icon: typeof DashboardSquare01Icon): IconComponent {
  return function Icon({ className, size = 18, strokeWidth = 1.8 }: IconProps) {
    return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} color="currentColor" className={className} />;
  };
}

export const DashboardIcon = make(DashboardSquare01Icon);
export const ProgressIcon = make(ChartLineData02Icon);
export const AttendanceIcon = make(TaskDone01Icon);
export const MarksIcon = make(PencilEdit02Icon);
export const StudentsIcon = make(UserMultipleIcon);
export const AnnounceIcon = make(Megaphone01Icon);
export const CalendarIcon = make(Calendar03Icon);
export const ReportIcon = make(File01Icon);
export const LeaveIcon = make(Airplane01Icon);
export const FeedbackIcon = make(Message01Icon);
export const AllotmentIcon = make(Structure01Icon);

export const MenuIcon = make(Menu01Icon);
export const CloseIcon = make(Cancel01Icon);
export const LogoutIcon = make(Logout01Icon);
export const LoginIcon = make(Login03Icon);
export const LanguageIcon = make(TranslationIcon);
export const GradCapIcon = make(GraduationCapIcon);

export const ArrowUpRightIcon = make(ArrowUpRight01Icon);
export const ArrowDownRightIcon = make(ArrowDownRight01Icon);
export const ArrowRightIcon = make(ArrowRight01Icon);

export const AlertIcon = make(Alert01Icon);
export const AlertCircle = make(AlertCircleIcon);
export const TrophyIcon = make(ChampionIcon);
export const AwardIcon = make(Award01Icon);
export const SearchIcon = make(Search01Icon);
export const ClockIcon = make(Time04Icon);
export const InboxIconC = make(InboxIcon);
export const SentIconC = make(SentIcon);
export const UserIconC = make(UserIcon);
export const NotebookIcon = make(Notebook01Icon);
export const TestTubeIcon = make(TestTube01Icon);
export const CheckIcon = make(CheckmarkCircle01Icon);
export const PlusIcon = make(Add01Icon);
export const PromotionIcon = make(ArrowUpDoubleIcon);

// X-style post action bar
export const ReplyIcon = make(Comment01Icon);
export const RepostIcon = make(RepeatIcon);
export const LikeIcon = make(FavouriteIcon);
export const ViewsIcon = make(Analytics01Icon);
export const ShareIcon = make(Share08Icon);
export const MoreIcon = make(MoreHorizontalIcon);
