import {
  Activity, BadgeDollarSign, BellRing, Boxes, Building2, ChartNoAxesCombined, CircleUserRound,
  ClipboardCheck, DatabaseZap, FileCheck2, FileKey2, FileText, Fingerprint,
  Flag, Gauge, HandCoins, Headphones, HeartPulse, KeyRound, Layers3, LockKeyhole,
  PackageCheck, Palette, ReceiptText, ScrollText, ServerCog, Settings2, ShieldCheck,
  Sparkles, Users, WalletCards, Rocket, Map,
  type LucideIcon,
} from "lucide-react";
import type { PlatformPermission } from "./domain";

export type CommandNavItem = { to: string; label: string; icon: LucideIcon; permission?: PlatformPermission };
export type CommandNavGroup = { title: string; items: CommandNavItem[] };

export const COMMAND_NAV: CommandNavGroup[] = [
  { title: "", items: [{ to: "/command-center", label: "Overview", icon: Gauge, permission: "platform.view" }] },
  { title: "Customers", items: [
    { to: "/command-center/organizations", label: "Organizations", icon: Building2, permission: "platform.view" },
    { to: "/command-center/onboarding", label: "Verification center", icon: ClipboardCheck, permission: "platform.view" },
    { to: "/command-center/provisioning", label: "Tenant provisioning", icon: ServerCog, permission: "organizations.manage" },
    { to: "/command-center/setup", label: "Go-live setup", icon: Rocket, permission: "onboarding.manage" },
    { to: "/command-center/documents", label: "Documents", icon: FileCheck2, permission: "platform.view" },
    { to: "/command-center/support", label: "Support access", icon: Headphones, permission: "support.access.request" },
  ] },
  { title: "Product Management", items: [
    { to: "/command-center/roadmap", label: "Product roadmap", icon: Map, permission: "roadmap.view" },
    { to: "/command-center/releases", label: "Releases", icon: PackageCheck, permission: "roadmap.view" },
  ] },
  { title: "Commercial", items: [
    { to: "/command-center/opportunities", label: "Deals & activation", icon: HandCoins, permission: "subscriptions.manage" },
    { to: "/command-center/subscriptions", label: "Subscriptions", icon: WalletCards, permission: "platform.view" },
    { to: "/command-center/licenses", label: "License center", icon: FileKey2, permission: "platform.view" },
    { to: "/command-center/packages", label: "Packages", icon: PackageCheck, permission: "platform.view" },
    { to: "/command-center/catalog", label: "Product catalog", icon: Boxes, permission: "platform.view" },
    { to: "/command-center/pricing", label: "Pricing", icon: BadgeDollarSign, permission: "platform.view" },
    { to: "/command-center/invoices", label: "Invoices", icon: ReceiptText, permission: "platform.view" },
    { to: "/command-center/transactions", label: "Transactions", icon: HandCoins, permission: "platform.view" },
  ] },
  { title: "Identity", items: [
    { to: "/command-center/users", label: "Users", icon: Users, permission: "platform.view" },
    { to: "/command-center/roles", label: "Roles & permissions", icon: ShieldCheck, permission: "platform.view" },
    { to: "/command-center/sso", label: "SSO", icon: Fingerprint, permission: "platform.view" },
    { to: "/command-center/sessions", label: "Sessions", icon: KeyRound, permission: "platform.view" },
  ] },
  { title: "Platform", items: [
    { to: "/command-center/entitlements", label: "Entitlements", icon: Layers3, permission: "platform.view" },
    { to: "/command-center/feature-flags", label: "Feature flags", icon: Flag, permission: "platform.view" },
    { to: "/command-center/integrations", label: "Integrations", icon: DatabaseZap, permission: "platform.view" },
    { to: "/command-center/notifications", label: "Notifications", icon: BellRing, permission: "platform.view" },
  ] },
  { title: "Operations", items: [
    { to: "/command-center/analytics", label: "Usage analytics", icon: ChartNoAxesCombined, permission: "platform.view" },
    { to: "/command-center/health", label: "System health", icon: HeartPulse, permission: "platform.view" },
    { to: "/command-center/incidents", label: "Incidents", icon: Activity, permission: "platform.view" },
    { to: "/command-center/jobs", label: "Jobs & sync", icon: ServerCog, permission: "platform.view" },
    { to: "/command-center/audit", label: "Audit logs", icon: ScrollText, permission: "audit.view" },
  ] },
  { title: "Customization", items: [
    { to: "/command-center/branding", label: "Branding", icon: Palette, permission: "branding.manage" },
    { to: "/command-center/themes", label: "Themes", icon: Sparkles, permission: "branding.manage" },
    { to: "/command-center/terminology", label: "Terminology", icon: FileText, permission: "organizations.manage" },
  ] },
  { title: "Administration", items: [
    { to: "/command-center/internal-users", label: "Internal users", icon: CircleUserRound, permission: "identity.manage" },
    { to: "/command-center/security", label: "Security", icon: LockKeyhole, permission: "security.manage" },
    { to: "/command-center/settings", label: "Global settings", icon: Settings2, permission: "organizations.manage" },
  ] },
];

export const COMMAND_ITEMS = COMMAND_NAV.flatMap((group) => group.items);
