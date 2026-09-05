import {
  LayoutDashboard,
  ListChecks,
  UserPlus,
  CalendarClock,
  Stethoscope,
  BedDouble,
  FileClock,
  FlaskConical,
  Pill,
  HeartPulse,
  Baby,
  Users,
  Syringe,
  Salad,
  ShieldPlus,
  Activity,
  Bug,
  Share2,
  ArrowLeftRight,
  Radar,
  Home,
  Boxes,
  Wrench,
  Receipt,
  IdCard,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  ScrollText,
  Settings,
  CalendarRange,
  Fingerprint,
  ClipboardList,
  SlidersHorizontal,
  FolderKanban,
  Palmtree,
  CheckSquare,
  Building2,
  Contact,
  Briefcase,
  ListChecks as OnboardIcon,
  LogOut,
  Target,
  Network,
  BookOpen,
  Users2,
  Package,
  Headset,
  Wallet,
  ShieldCheck,
  TrendingUp,
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: "queue" | "lab" | "rx";
  /** one level of nesting — a collapsible sub-section (keeps big modules like Accounting off a jam-packed flat list) */
  children?: { to: string; label: string }[];
};

export type NavGroup = { title: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: "Clinical",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/queue", label: "Clinical Queue", icon: ListChecks, badge: "queue" },
      { to: "/registration", label: "Registration", icon: UserPlus },
      { to: "/appointments", label: "Appointments", icon: CalendarClock },
      { to: "/consultation", label: "Consultation", icon: Stethoscope },
      { to: "/inpatient", label: "In-patient Care (IPC)", icon: BedDouble },
      { to: "/history", label: "Medical History", icon: FileClock },
    ],
  },
  {
    title: "Diagnostics",
    items: [
      { to: "/laboratory", label: "Laboratory", icon: FlaskConical, badge: "lab" },
      { to: "/pharmacy", label: "Pharmacy", icon: Pill, badge: "rx" },
    ],
  },
  {
    title: "Maternal & Child Health",
    items: [
      { to: "/anc", label: "Antenatal (ANC)", icon: HeartPulse },
      { to: "/labour", label: "Labour and Delivery", icon: Baby },
      { to: "/pnc", label: "Postnatal (PNC)", icon: HeartPulse },
      { to: "/family-planning", label: "Family Planning", icon: Users },
      { to: "/child-health", label: "Child Health", icon: Baby },
      { to: "/nutrition", label: "Nutrition (CMAM)", icon: Salad },
      { to: "/immunization", label: "Immunization", icon: Syringe },
    ],
  },
  {
    title: "Programs",
    items: [
      { to: "/ncd", label: "NCDs", icon: Activity },
      { to: "/malaria", label: "Malaria", icon: Bug },
      { to: "/referrals", label: "Referrals", icon: Share2 },
      { to: "/transfers", label: "Patient Transfers", icon: ArrowLeftRight },
      { to: "/surveillance", label: "Surveillance", icon: Radar },
      { to: "/outreach", label: "Outreach (CHW)", icon: Home },
    ],
  },
  {
    title: "Workforce",
    items: [
      { to: "/workforce", label: "Time Dashboard", icon: LayoutDashboard },
      { to: "/workforce/schedules", label: "Schedule Manager", icon: CalendarRange },
      { to: "/workforce/attendance", label: "Attendance", icon: Fingerprint },
      { to: "/workforce/timesheets", label: "Timesheets", icon: ClipboardList },
      { to: "/workforce/approvals", label: "Approvals", icon: CheckSquare },
      { to: "/workforce/leave", label: "Holiday & Leave", icon: Palmtree },
      { to: "/workforce/work", label: "Work & Tasks", icon: FolderKanban },
      { to: "/workforce/reports", label: "Time Reports", icon: BarChart3 },
      { to: "/workforce/policy", label: "Time Settings", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Human Resources",
    items: [
      { to: "/hr/dashboard", label: "HR Dashboard", icon: LayoutDashboard },
      { to: "/hr/employees", label: "Employee Directory", icon: Contact },
      { to: "/hr/org-chart", label: "Organization Chart", icon: Network },
      { to: "/hr/policies-discipline", label: "Policies & Discipline", icon: BookOpen },
      { to: "/hr/recruitment", label: "Recruitment", icon: Briefcase },
      { to: "/hr/talent-pool", label: "Talent Pool", icon: Users2 },
      { to: "/hr/onboarding", label: "Onboarding", icon: OnboardIcon },
      { to: "/hr/offboarding", label: "Offboarding", icon: LogOut },
      { to: "/hr/performance", label: "Performance", icon: Target },
      { to: "/hr/promotions", label: "Promotions", icon: TrendingUp },
      { to: "/hr/branch-transfers", label: "Branch Transfers", icon: ArrowLeftRight },
      { to: "/hr/payroll", label: "Payroll", icon: Wallet },
      { to: "/hr/assets", label: "Company Assets", icon: Package },
      { to: "/hr/helpdesk", label: "Helpdesk", icon: Headset },
      { to: "/hr/approvals", label: "Approval Workflows", icon: ShieldCheck },
      { to: "/hr/reports", label: "HR Reports", icon: BarChart3 },
      { to: "/hr/org-setup", label: "Organisation Setup", icon: Building2 },
    ],
  },
  {
    title: "Accounting",
    items: [
      { to: "/accounting", label: "Dashboard", icon: LayoutDashboard },
      {
        to: "/accounting/chart-of-accounts",
        label: "General Ledger",
        icon: BookOpenCheck,
        children: [
          { to: "/accounting/chart-of-accounts", label: "Chart of Accounts" },
          { to: "/accounting/journals", label: "Journal Entries" },
          { to: "/accounting/general-ledger", label: "General Ledger" },
          { to: "/accounting/trial-balance", label: "Trial Balance" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/billing", label: "Billing", icon: Receipt },
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/equipment", label: "Equipment & Maintenance", icon: Wrench },
      { to: "/hris", label: "HRIS", icon: IdCard },
      { to: "/msf-report", label: "MSF Report", icon: FileSpreadsheet },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/nhmis-sync", label: "NHMIS Sync", icon: RefreshCw },
      { to: "/audit-log", label: "Audit Log", icon: ScrollText },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);

// used for the "brand mark"
export { ShieldPlus };
