import {
  LayoutDashboard,
  FileText,
  HeartPulse,
  Stethoscope,
  Calendar,
  Building2,
  ClipboardList,
  TestTube,
  Syringe,
  FileBadge2 as InsuranceIcon,
  Pill,
  Users,
  ShieldAlert,
  CalendarPlus,
  Store,
  ReceiptText,
  Truck,
  UploadCloud,
  Zap,
  HeartHandshake,
  Settings,
  LogOut,
} from "lucide-react";

// Navigation and quick-action definitions for the patient dashboard (live data comes from the API).
// `icon` holds the lucide-react component itself (not a rendered
// element) — consumers render it as <item.icon size={18} />.
export const NAV_ITEMS = [

  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { key: "records", label: "Medical Records", icon: FileText, to: "/records" },
  { key: "vitals", label: "Vital History", icon: HeartPulse, to: "/vitals" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, to: "/doctor" },
  { key: "wellness-hub", label: "Wellness Hub", icon: HeartHandshake, to: "/wellness-hub" },
  
  { key: "appointments", label: "Appointments", icon: Calendar, to: "/appointments" },
  { key: "hospitals", label: "Hospitals", icon: Building2, to: "/hospitals" },
  { key: "prescriptions", label: "Prescriptions", icon: ClipboardList,  to: "/prescriptions", },
  { key: "pharmacy-market", label: "Pharmacy Market", icon: Store, to: "/pharmacy-market" },
  { key: "pharmacy-quotes", label: "Pharmacy Quotes", icon: ReceiptText, to: "/pharmacy-quotes" },
  { key: "delivery-tracking", label: "Delivery Tracking", icon: Truck, to: "/delivery-tracking" },
  // { key: "lab", label: "Lab Results", icon: TestTube },
  // { key: "vaccinations", label: "Vaccinations", icon: Syringe },
  { key: "insurance", label: "Insurance", icon: InsuranceIcon, to: "/insurance" },
  // { key: "medications", label: "Medications", icon: Pill },
  {key: "family",label: "Family", icon: Users,to: "/family",},
  // { key: "emergency", label: "Emergency ID", icon: ShieldAlert },
];

export const FOOTER_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings, to: "/profile" },
  { key: "logout", label: "Logout", icon: LogOut, danger: true },
];
export const QUICK_ACTIONS = [
  { title: "Book Appointment", subtitle: "Schedule with your doctor", icon: CalendarPlus, to: "/appointments" },
  { title: "Upload Record", subtitle: "Add new lab results", icon: UploadCloud, to: "/records" },
  { title: "Emergency access", subtitle: "Show your emergency card", icon: Zap, action: "emergency" },
];

