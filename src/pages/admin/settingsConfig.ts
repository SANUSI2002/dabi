import type { CatalogKey } from "@/store/useCatalog";
import { DRUG_FORMS, DRUG_CLASSES } from "@/data/catalog";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: string[];
  default?: string | number | boolean;
};

export type CatalogDef = {
  key: CatalogKey;
  tab: string;
  addTitle: string;
  columns: { key: string; label: string; kind?: "code" | "money" | "bool" | "badge" }[];
  fields: FieldDef[];
};

export const CATALOGS: CatalogDef[] = [
  {
    key: "drugs",
    tab: "Drugs",
    addTitle: "Add Drug to Catalog",
    columns: [
      { key: "name", label: "Name" },
      { key: "form", label: "Form" },
      { key: "strength", label: "Strength" },
      { key: "klass", label: "Class" },
      { key: "reorder", label: "Reorder" },
    ],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "form", label: "Form", type: "select", options: DRUG_FORMS, default: "Tablet" },
      { key: "strength", label: "Strength", type: "text" },
      { key: "klass", label: "Class", type: "select", options: DRUG_CLASSES, default: "Other" },
      { key: "reorder", label: "Reorder level", type: "number", default: 50 },
    ],
  },
  {
    key: "labTests",
    tab: "Lab Tests",
    addTitle: "Add Lab Test",
    columns: [
      { key: "name", label: "Test" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "ref", label: "Reference" },
      { key: "price", label: "Price", kind: "money" },
      { key: "tat", label: "TAT (min)" },
    ],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "category", label: "Category", type: "select", options: ["Haematology", "Parasitology", "Serology", "Clinical Chemistry", "Urinalysis", "Microbiology"], default: "Haematology" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "ref", label: "Reference range", type: "text" },
      { key: "price", label: "Price (₦)", type: "number", default: 1000 },
      { key: "tat", label: "Turnaround (min)", type: "number", default: 30 },
    ],
  },
  {
    key: "diagnoses",
    tab: "Diagnoses",
    addTitle: "Add Diagnosis",
    columns: [
      { key: "code", label: "ICD-11", kind: "code" },
      { key: "name", label: "Name" },
      { key: "chapter", label: "Chapter" },
      { key: "ncd", label: "NCD", kind: "bool" },
      { key: "notifiable", label: "Notifiable", kind: "bool" },
    ],
    fields: [
      { key: "code", label: "ICD-11 code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "chapter", label: "Chapter", type: "text" },
      { key: "ncd", label: "Chronic / NCD", type: "checkbox" },
      { key: "notifiable", label: "Notifiable disease", type: "checkbox" },
    ],
  },
  {
    key: "vaccines",
    tab: "Vaccines",
    addTitle: "Add Vaccine",
    columns: [
      { key: "code", label: "Code", kind: "code" },
      { key: "name", label: "Name" },
      { key: "ageLabel", label: "Due age" },
      { key: "dose", label: "Dose" },
      { key: "route", label: "Route" },
      { key: "site", label: "Site" },
    ],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "ageLabel", label: "Due age (label)", type: "text", default: "6 weeks" },
      { key: "ageWeeks", label: "Due age (weeks)", type: "number", default: 6 },
      { key: "dose", label: "Dose number", type: "number", default: 1 },
      { key: "route", label: "Route", type: "select", options: ["Oral", "IM", "SC", "ID"], default: "IM" },
      { key: "site", label: "Site", type: "text", default: "Left outer thigh" },
    ],
  },
  {
    key: "notifiable",
    tab: "Notifiable Diseases",
    addTitle: "Add Notifiable Disease",
    columns: [
      { key: "code", label: "Code", kind: "code" },
      { key: "name", label: "Name" },
      { key: "class", label: "Class" },
      { key: "priority", label: "Priority", kind: "badge" },
      { key: "window", label: "Reporting Window" },
    ],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "class", label: "IDSR class", type: "select", options: ["IDSR Immediate", "IDSR Weekly", "IDSR Monthly"], default: "IDSR Weekly" },
      { key: "priority", label: "Priority", type: "select", options: ["Routine", "High", "Critical"], default: "Routine" },
      { key: "window", label: "Reporting window", type: "text", default: "Weekly" },
    ],
  },
  {
    key: "services",
    tab: "Service Types & Tariffs",
    addTitle: "Add Service Type",
    columns: [
      { key: "code", label: "Code", kind: "code" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "price", label: "Default Price", kind: "money" },
      { key: "billable", label: "Billable", kind: "bool" },
    ],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "category", label: "Category", type: "select", options: ["Administrative", "Consultation", "MCH", "Child Health", "FP", "Lab", "Laboratory", "Pharmacy", "Procedure", "Other"], default: "Consultation" },
      { key: "price", label: "Default price (₦)", type: "number", default: 0 },
      { key: "billable", label: "Billable", type: "checkbox", default: true },
    ],
  },
  {
    key: "categories",
    tab: "Patient Categories",
    addTitle: "Add Patient Category",
    columns: [
      { key: "code", label: "Code", kind: "code" },
      { key: "name", label: "Name" },
      { key: "exempt", label: "Exempt", kind: "bool" },
      { key: "reason", label: "Reason" },
    ],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "exempt", label: "Exempt from charges", type: "checkbox" },
      { key: "reason", label: "Reason / note", type: "text" },
    ],
  },
  {
    key: "users",
    tab: "Users",
    addTitle: "Add User",
    columns: [
      { key: "name", label: "Name" },
      { key: "username", label: "Username", kind: "code" },
      { key: "role", label: "Role", kind: "badge" },
      { key: "status", label: "Status", kind: "badge" },
    ],
    fields: [
      { key: "name", label: "Full name", type: "text" },
      { key: "username", label: "Username", type: "text" },
      { key: "role", label: "Role", type: "select", options: ["Medical Officer", "Nurse", "Community Health Worker", "Lab Technician", "Pharmacy Technician", "Health Records Officer", "M&E / HMIS Officer", "Receptionist", "System Admin"], default: "Nurse" },
      { key: "cadre", label: "Cadre", type: "text" },
      { key: "license", label: "License number", type: "text" },
    ],
  },
];
