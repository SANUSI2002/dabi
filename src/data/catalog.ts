// Reference / configuration data used by the Settings module and clinical forms.

export type ServiceType = {
  code: string;
  name: string;
  category: string;
  price: number;
  billable: boolean;
  active: boolean;
};

export const SERVICE_TYPES: ServiceType[] = [
  { code: "REG", name: "New Patient Registration", category: "Administrative", price: 0, billable: false, active: true },
  { code: "CARD", name: "Patient Card", category: "Administrative", price: 200, billable: true, active: true },
  { code: "CONS", name: "General Consultation", category: "Consultation", price: 500, billable: true, active: true },
  { code: "REVIEW", name: "Follow-up Review", category: "Consultation", price: 300, billable: true, active: true },
  { code: "ANC", name: "Antenatal Care Visit", category: "MCH", price: 0, billable: false, active: true },
  { code: "DELIVERY", name: "Normal Delivery", category: "MCH", price: 15000, billable: true, active: true },
  { code: "LND", name: "Labour and Delivery", category: "MCH", price: 0, billable: false, active: true },
  { code: "AKWA", name: "Akwanbo (post-natal)", category: "MCH", price: 700, billable: true, active: true },
  { code: "IMMUN", name: "Immunization", category: "Child Health", price: 0, billable: false, active: true },
  { code: "CIRCUM", name: "Male Circumcision", category: "Child Health", price: 2000, billable: true, active: true },
  { code: "FP", name: "Family Planning Counsel", category: "FP", price: 0, billable: false, active: true },
  { code: "LAB", name: "Laboratory Test", category: "Lab", price: 1000, billable: true, active: true },
  { code: "MAL_RDT", name: "Malaria RDT", category: "Lab", price: 400, billable: true, active: true },
  { code: "FASTBS", name: "Fasting Blood Sugar", category: "Laboratory", price: 1000, billable: true, active: true },
  { code: "BP_CHK", name: "BP Screening", category: "Laboratory", price: 100, billable: true, active: true },
  { code: "PHARM", name: "Pharmacy Dispensing", category: "Pharmacy", price: 0, billable: true, active: true },
  { code: "INJECT", name: "Injection / IM", category: "Pharmacy", price: 300, billable: true, active: true },
  { code: "DRESSING", name: "Wound Dressing", category: "Procedure", price: 800, billable: true, active: true },
  { code: "CHESTE", name: "Chest Examination", category: "Procedure", price: 0, billable: true, active: true },
];

export type PatientCategory = {
  code: string;
  name: string;
  exempt: boolean;
  reason: string;
  active: boolean;
};

export const PATIENT_CATEGORIES: PatientCategory[] = [
  { code: "GEN", name: "General", exempt: false, reason: "—", active: true },
  { code: "U5", name: "Under-5", exempt: true, reason: "Free child health", active: true },
  { code: "ANC", name: "Pregnant women", exempt: true, reason: "Free MCH services", active: true },
  { code: "ELDER", name: "Elderly (65+)", exempt: true, reason: "Senior citizen waiver", active: true },
  { code: "STAFF", name: "Staff and family", exempt: true, reason: "Staff benefit", active: true },
  { code: "INDIG", name: "Indigent", exempt: true, reason: "LGA-supported", active: true },
  { code: "NHIS", name: "NHIS enrollee", exempt: false, reason: "Insurance covered", active: true },
  { code: "PVT", name: "Private", exempt: false, reason: "—", active: true },
  { code: "VIP", name: "VIP", exempt: false, reason: "VIP", active: true },
];

export type LabTest = {
  name: string;
  category: string;
  unit: string;
  ref: string;
  price: number;
  tat: number;
};

export const LAB_TESTS: LabTest[] = [
  { name: "Full Blood Count", category: "Haematology", unit: "", ref: "See differential", price: 2500, tat: 60 },
  { name: "Packed Cell Volume (PCV)", category: "Haematology", unit: "%", ref: "36–48", price: 500, tat: 20 },
  { name: "Haemoglobin (Hb)", category: "Haematology", unit: "g/dL", ref: "11–16", price: 500, tat: 20 },
  { name: "White Blood Cell Count", category: "Haematology", unit: "x10⁹/L", ref: "4–11", price: 800, tat: 40 },
  { name: "Platelet Count", category: "Haematology", unit: "x10⁹/L", ref: "150–400", price: 800, tat: 40 },
  { name: "Malaria Parasite (MP)", category: "Parasitology", unit: "", ref: "Not seen", price: 500, tat: 30 },
  { name: "Malaria RDT", category: "Parasitology", unit: "", ref: "Negative", price: 400, tat: 15 },
  { name: "Stool Microscopy", category: "Parasitology", unit: "", ref: "No ova/cyst", price: 700, tat: 45 },
  { name: "Urinalysis", category: "Urinalysis", unit: "", ref: "Normal", price: 600, tat: 20 },
  { name: "Widal Test", category: "Serology", unit: "titre", ref: "< 1:80", price: 1200, tat: 60 },
  { name: "Retroviral Screening (HIV)", category: "Serology", unit: "", ref: "Non-reactive", price: 0, tat: 30 },
  { name: "Hepatitis B Surface Antigen", category: "Serology", unit: "", ref: "Negative", price: 800, tat: 30 },
  { name: "Hepatitis C Antibody", category: "Serology", unit: "", ref: "Negative", price: 1000, tat: 30 },
  { name: "Pregnancy Test (β-HCG)", category: "Serology", unit: "", ref: "Negative", price: 700, tat: 15 },
  { name: "Fasting Blood Sugar", category: "Clinical Chemistry", unit: "mmol/L", ref: "3.9–5.5", price: 1000, tat: 20 },
  { name: "Random Blood Sugar", category: "Clinical Chemistry", unit: "mmol/L", ref: "< 7.8", price: 1000, tat: 20 },
  { name: "Serum Electrolytes / Urea / Creatinine", category: "Clinical Chemistry", unit: "", ref: "Panel", price: 6500, tat: 120 },
  { name: "Liver Function Test", category: "Clinical Chemistry", unit: "", ref: "Panel", price: 6000, tat: 120 },
  { name: "Total Cholesterol", category: "Clinical Chemistry", unit: "mmol/L", ref: "< 5.2", price: 1500, tat: 60 },
  { name: "Sputum AFB Microscopy", category: "Sputum AFB Microscopy", unit: "", ref: "Negative", price: 0, tat: 240 },
];

export const LAB_PANELS: Record<string, string[]> = {
  Haematology: ["Full Blood Count", "PCV", "Haemoglobin", "WBC Count", "Platelet Count", "ESR", "Reticulocyte Count"],
  Parasitology: ["Malaria Parasite", "Malaria RDT", "Stool Microscopy", "Microfilaria", "Skin Snip"],
  Serology: ["Retroviral Screening (HIV)", "HBsAg", "HCV Ab", "VDRL", "Widal", "H. pylori Antigen", "Pregnancy Test (β-HCG)"],
  "Clinical Chemistry": ["Fasting Blood Sugar", "Random Blood Sugar", "HbA1c", "Electrolytes/Urea/Creatinine", "LFT", "Lipid Profile", "Uric Acid"],
  Urinalysis: ["Colour", "Appearance", "pH", "Specific Gravity", "Protein", "Glucose", "Ketone", "Blood", "Leucocytes", "Nitrites", "Bilirubin", "Urobilinogen"],
  "Microscopy / Culture": ["Microscopy", "Culture", "Sensitivity", "Pus Cells", "Epithelial Cells", "RBC", "Yeast Cells", "Casts", "Crystals"],
  "Blood Bank": ["Blood Group", "Genotype", "Rh(D)", "Coombs Test (Direct)", "Coombs Test (Indirect)", "Sickling Test"],
};

export type Diagnosis = {
  code: string;
  name: string;
  chapter: string;
  ncd: boolean;
  notifiable: boolean;
};

export const DIAGNOSES: Diagnosis[] = [
  { code: "1F40", name: "Malaria, uncomplicated", chapter: "Infectious diseases", ncd: false, notifiable: true },
  { code: "1D40", name: "Sepsis", chapter: "Infectious diseases", ncd: false, notifiable: false },
  { code: "CA07", name: "Upper respiratory infection", chapter: "Respiratory", ncd: false, notifiable: false },
  { code: "1A00", name: "Cholera", chapter: "Infectious diseases", ncd: false, notifiable: true },
  { code: "DA92", name: "Functional dyspepsia", chapter: "Digestive", ncd: false, notifiable: false },
  { code: "GC08", name: "Urinary tract infection", chapter: "Genitourinary", ncd: false, notifiable: false },
  { code: "EA80", name: "Tinea / skin infection", chapter: "Skin", ncd: false, notifiable: false },
  { code: "BA00", name: "Essential hypertension", chapter: "Circulatory", ncd: true, notifiable: false },
  { code: "5A11", name: "Type 2 diabetes mellitus", chapter: "Endocrine", ncd: true, notifiable: false },
  { code: "CA23", name: "Asthma", chapter: "Respiratory", ncd: true, notifiable: false },
  { code: "1B10", name: "Tuberculosis of lung", chapter: "Infectious diseases", ncd: false, notifiable: true },
  { code: "KA20", name: "Disorder of low birth weight", chapter: "Perinatal", ncd: false, notifiable: false },
  { code: "ME24", name: "Preterm labour", chapter: "Pregnancy & childbirth", ncd: false, notifiable: false },
  { code: "DA61", name: "Peptic ulcer disease", chapter: "Digestive", ncd: false, notifiable: false },
  { code: "1E31", name: "Measles", chapter: "Infectious diseases", ncd: false, notifiable: true },
  { code: "5B50", name: "Moderate acute malnutrition", chapter: "Nutrition", ncd: false, notifiable: false },
  { code: "5B51", name: "Severe acute malnutrition", chapter: "Nutrition", ncd: false, notifiable: false },
];

export type Vaccine = {
  code: string;
  name: string;
  ageLabel: string;
  ageWeeks: number;
  dose: number;
  route: string;
  site: string;
};

export const VACCINES: Vaccine[] = [
  { code: "BCG", name: "Bacillus Calmette–Guérin (BCG)", ageLabel: "Birth", ageWeeks: 0, dose: 1, route: "ID", site: "Left deltoid" },
  { code: "OPV0", name: "Oral Polio Vaccine (OPV 0)", ageLabel: "Birth", ageWeeks: 0, dose: 1, route: "Oral", site: "Mouth" },
  { code: "HEPB0", name: "Hepatitis B (birth dose)", ageLabel: "Birth", ageWeeks: 0, dose: 1, route: "IM", site: "Right outer thigh" },
  { code: "OPV1", name: "Oral Polio Vaccine (Dose 1)", ageLabel: "6 weeks", ageWeeks: 6, dose: 1, route: "Oral", site: "Mouth" },
  { code: "PENTA1", name: "Pentavalent Vaccine (Dose 1)", ageLabel: "6 weeks", ageWeeks: 6, dose: 1, route: "IM", site: "Left outer thigh" },
  { code: "PCV1", name: "Pneumococcal Conjugate (Dose 1)", ageLabel: "6 weeks", ageWeeks: 6, dose: 1, route: "IM", site: "Right outer thigh" },
  { code: "ROTA1", name: "Rotavirus Vaccine (Dose 1)", ageLabel: "6 weeks", ageWeeks: 6, dose: 1, route: "Oral", site: "Mouth" },
  { code: "OPV2", name: "Oral Polio Vaccine (Dose 2)", ageLabel: "10 weeks", ageWeeks: 10, dose: 2, route: "Oral", site: "Mouth" },
  { code: "PENTA2", name: "Pentavalent Vaccine (Dose 2)", ageLabel: "10 weeks", ageWeeks: 10, dose: 2, route: "IM", site: "Left outer thigh" },
  { code: "PCV2", name: "Pneumococcal Conjugate (Dose 2)", ageLabel: "10 weeks", ageWeeks: 10, dose: 2, route: "IM", site: "Right outer thigh" },
  { code: "ROTA2", name: "Rotavirus Vaccine (Dose 2)", ageLabel: "10 weeks", ageWeeks: 10, dose: 2, route: "Oral", site: "Mouth" },
  { code: "OPV3", name: "Oral Polio Vaccine (Dose 3)", ageLabel: "14 weeks", ageWeeks: 14, dose: 3, route: "Oral", site: "Mouth" },
  { code: "PENTA3", name: "Pentavalent Vaccine (Dose 3)", ageLabel: "14 weeks", ageWeeks: 14, dose: 3, route: "IM", site: "Left outer thigh" },
  { code: "PCV3", name: "Pneumococcal Conjugate (Dose 3)", ageLabel: "14 weeks", ageWeeks: 14, dose: 3, route: "IM", site: "Right outer thigh" },
  { code: "IPV1", name: "Inactivated Polio Vaccine (Dose 1)", ageLabel: "14 weeks", ageWeeks: 14, dose: 1, route: "IM", site: "Right outer thigh" },
  { code: "MV1", name: "Measles Vaccine (Dose 1)", ageLabel: "9 months", ageWeeks: 39, dose: 1, route: "SC", site: "Left upper arm" },
  { code: "YF", name: "Yellow Fever Vaccine", ageLabel: "9 months", ageWeeks: 39, dose: 1, route: "SC", site: "Left upper arm" },
  { code: "MENA", name: "Meningococcal A Conjugate", ageLabel: "9 months", ageWeeks: 39, dose: 1, route: "SC", site: "Right upper arm" },
  { code: "VITA1", name: "Vitamin A (Dose 1)", ageLabel: "9 months", ageWeeks: 39, dose: 1, route: "Oral", site: "Mouth" },
  { code: "MV2", name: "Measles–Rubella (Dose 2)", ageLabel: "15 months", ageWeeks: 65, dose: 2, route: "SC", site: "Left upper arm" },
];

export type NotifiableDisease = {
  code: string;
  name: string;
  class: "IDSR Immediate" | "IDSR Weekly" | "IDSR Monthly";
  priority: "Routine" | "High" | "Critical";
  window: string;
};

export const NOTIFIABLE: NotifiableDisease[] = [
  { code: "MAL", name: "Malaria", class: "IDSR Weekly", priority: "Routine", window: "Weekly" },
  { code: "MEAS", name: "Measles", class: "IDSR Immediate", priority: "Critical", window: "24 hours" },
  { code: "CHOL", name: "Cholera", class: "IDSR Immediate", priority: "Critical", window: "Immediate" },
  { code: "AFP", name: "Acute Flaccid Paralysis", class: "IDSR Immediate", priority: "Critical", window: "24 hours" },
  { code: "TB", name: "Tuberculosis", class: "IDSR Monthly", priority: "High", window: "Monthly" },
  { code: "HIV", name: "HIV/AIDS", class: "IDSR Monthly", priority: "High", window: "Monthly" },
  { code: "MDTH", name: "Maternal Death", class: "IDSR Immediate", priority: "Critical", window: "Immediate" },
  { code: "LF", name: "Lassa Fever", class: "IDSR Immediate", priority: "Critical", window: "Immediate" },
  { code: "MENI", name: "Meningitis", class: "IDSR Immediate", priority: "Critical", window: "24 hours" },
  { code: "YF", name: "Yellow Fever", class: "IDSR Immediate", priority: "Critical", window: "24 hours" },
  { code: "AWD", name: "Acute Watery Diarrhoea", class: "IDSR Weekly", priority: "Routine", window: "Weekly" },
  { code: "DYS", name: "Bloody Diarrhoea (Dysentery)", class: "IDSR Weekly", priority: "Routine", window: "Weekly" },
  { code: "COVID", name: "COVID-19", class: "IDSR Immediate", priority: "Routine", window: "24 hours" },
];

export const OUT_REFERRAL_REASONS = [
  { code: "215", reason: "Unavailability of Expertise" },
  { code: "216", reason: "Unavailability of Equipment" },
  { code: "217", reason: "Unavailability of Blood / Blood Products" },
  { code: "218", reason: "Unavailability of Drugs" },
  { code: "219", reason: "Patient Request" },
  { code: "220", reason: "Lack of Operating Facility" },
  { code: "221", reason: "Complicated Cases" },
  { code: "222", reason: "Other Reasons" },
];

export const DRUG_FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Injection", "Drops", "Cream", "Pessary", "Other"];
export const DRUG_CLASSES = ["Antimalarial", "Antibiotic", "Analgesic", "Antihypertensive", "Antidiabetic", "Family Planning", "Vitamin & Supplement", "Respiratory", "Other"];
export const WARDS = ["Children's Ward", "Female Ward", "Male Ward", "Maternity Ward"];
export const STATIONS = ["Vital", "Consultation", "Lab", "Pharmacy", "ANC", "Immunization", "Family Planning", "Emergency", "Exit", "Child Health", "Delivery", "Nutrition"] as const;
export const FP_METHODS = ["Oral Pill", "Injectable (DMPA-IM)", "Injectable (DMPA-SC)", "Implant", "IUCD", "Male Condom", "Female Condom", "LAM", "Natural / Calendar"];
