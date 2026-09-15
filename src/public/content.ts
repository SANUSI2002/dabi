import { BrainCircuit, PackageCheck, ShieldCheck, Stethoscope, Users, type LucideIcon } from "lucide-react";

export type ProductCategory = { icon: LucideIcon; title: string; items: string };

export const categoryCards: ProductCategory[] = [
  { icon: Stethoscope, title: "Clinical", items: "Registration, appointments, consultation, EMR, wards, nursing, laboratory, pharmacy and maternal health" },
  { icon: PackageCheck, title: "Operations", items: "Inventory, procurement, equipment, maintenance, facility workflows and operational monitoring" },
  { icon: Users, title: "Workforce", items: "People, recruitment, onboarding, attendance, scheduling, timesheets and payroll" },
  { icon: ShieldCheck, title: "Finance", items: "Billing, accounting, receivables, payables, banking and financial reporting" },
  { icon: BrainCircuit, title: "Intelligence", items: "Dashboards, reporting, analytics, AI-assisted workflows and operational insights" },
];
