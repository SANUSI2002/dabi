// Rich HR profile layered onto the existing lightweight staff roster (useHr).
// One row per staffId — mirrors Horilla's split of Employee / EmployeeWorkInformation /
// EmployeeBankDetails / Document / DisciplinaryAction / EmployeeNote / BonusPoint.

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type Gender = "Male" | "Female" | "Other";
export type MaritalStatus = "Single" | "Married" | "Divorced" | "Widowed";

export type EmployeeProfile = {
  id: string; // == useHr staff id
  dob?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  address?: string;
  lga?: string;
  state?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  qualification?: string;
  companyId: string;
  departmentId?: string;
  jobPositionId?: string;
  jobRoleId?: string;
  employeeTypeId?: string;
  reportingManagerId?: string; // staff id
  dateJoining?: string;
  contractEndDate?: string;
  workEmail?: string;
  workPhone?: string;
  tagIds: string[];
  bankName?: string;
  accountNumber?: string;
  bankBranch?: string;
};

/** master-data "document-types" label (configurable) — seeds use the values below */
export type DocumentCategory = string;
export type DocumentStatus = "Requested" | "Uploaded" | "Approved" | "Rejected";

export type EmployeeDocument = {
  id: string;
  employeeId: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  issueDate?: string;
  expiryDate?: string;
  notifyBeforeDays: number;
  rejectReason?: string;
};

export type PolicyCategory = "Conduct" | "Safety & Clinical" | "Data & Security" | "IT & Assets" | "Leave & Attendance" | "Other";
export type Policy = {
  id: string;
  category: PolicyCategory;
  title: string;
  purpose: string;
  body: string;
  updatedAt: string;
};

export type ActionType = {
  id: string;
  name: string;
  blockOption: boolean; // blocks profile edits / self-service while active
};

export type DisciplinaryAction = {
  id: string;
  employeeIds: string[];
  actionTypeId: string;
  description: string;
  unit: "Days" | "Hours";
  amount: number;
  startDate: string;
  attachment?: string;
};

export type EmployeeNote = {
  id: string;
  employeeId: string;
  note: string;
  by: string;
  at: string;
};

export type BonusEntry = { delta: number; reason: string; at: string; by: string };
export type BonusPoints = {
  employeeId: string;
  points: number;
  history: BonusEntry[];
};

export type Qualification = {
  id: string;
  employeeId: string;
  title: string;
  issuingBody: string;
  dateObtained: string;
  certificateRef?: string;
};

export const profiles: EmployeeProfile[] = [
  { id: "s1", dob: day(38 * 365), gender: "Female", maritalStatus: "Married", address: "14 Marine Road", lga: "Amuwo-Odofin", state: "Lagos", emergencyContactName: "Chuka Okonjo", emergencyContactPhone: "0803 111 2222", emergencyContactRelation: "Spouse", qualification: "MBBS, MPH", companyId: "co1", departmentId: "d2", jobPositionId: "jp2", jobRoleId: "jr3", employeeTypeId: "et1", dateJoining: day(1400), workEmail: "adaeze.okonjo@sabihealth.ng", workPhone: "0803 000 0001", tagIds: ["tg4"], bankName: "GTBank", accountNumber: "0123456789", bankBranch: "Festac" },
  { id: "s2", dob: day(34 * 365), gender: "Female", maritalStatus: "Married", address: "22 Church Street", lga: "Amuwo-Odofin", state: "Lagos", emergencyContactName: "Emeka Nwangbo", emergencyContactPhone: "0805 222 3333", emergencyContactRelation: "Spouse", qualification: "RN, RM", companyId: "co1", departmentId: "d1", jobPositionId: "jp1", jobRoleId: "jr1", employeeTypeId: "et1", reportingManagerId: "s1", dateJoining: day(1000), workEmail: "grace.nwangbo@sabihealth.ng", workPhone: "0803 000 0002", tagIds: ["tg1", "tg2"], bankName: "Access Bank", accountNumber: "0223456789", bankBranch: "Mile 2" },
  { id: "s3", dob: day(27 * 365), gender: "Female", maritalStatus: "Single", address: "8 Kirikiri Lane", lga: "Amuwo-Odofin", state: "Lagos", emergencyContactName: "Ifeoma Williams", emergencyContactPhone: "0806 333 4444", emergencyContactRelation: "Sister", qualification: "RN", companyId: "co1", departmentId: "d1", jobPositionId: "jp1", jobRoleId: "jr2", employeeTypeId: "et1", reportingManagerId: "s2", dateJoining: day(420), workEmail: "mary.williams@sabihealth.ng", workPhone: "0803 000 0003", tagIds: [] },
  { id: "s4", dob: day(41 * 365), gender: "Male", maritalStatus: "Married", address: "31 Ojo Road", lga: "Amuwo-Odofin", state: "Lagos", qualification: "HND Health Records", companyId: "co1", departmentId: "d5", jobPositionId: "jp5", employeeTypeId: "et1", reportingManagerId: "s1", dateJoining: day(1800), workEmail: "ogundele.olajumoke@sabihealth.ng", tagIds: [] },
  { id: "s5", dob: day(24 * 365), gender: "Female", maritalStatus: "Single", address: "5 Ijegun Road", lga: "Amuwo-Odofin", state: "Lagos", qualification: "CHEW Certificate", companyId: "co1", departmentId: "d7", jobPositionId: "jp9", employeeTypeId: "et2", reportingManagerId: "s2", dateJoining: day(300), contractEndDate: day(-65), tagIds: [] },
  { id: "s6", dob: day(31 * 365), gender: "Female", maritalStatus: "Married", address: "19 Festac Link", lga: "Amuwo-Odofin", state: "Lagos", qualification: "BSc Statistics", companyId: "co1", departmentId: "d5", jobPositionId: "jp6", employeeTypeId: "et1", reportingManagerId: "s1", dateJoining: day(900), tagIds: ["tg4"] },
  { id: "s7", dob: day(29 * 365), gender: "Male", maritalStatus: "Single", address: "2 Trade Fair Road", lga: "Amuwo-Odofin", state: "Lagos", qualification: "AMLSCN", companyId: "co1", departmentId: "d3", jobPositionId: "jp3", jobRoleId: "jr4", employeeTypeId: "et3", reportingManagerId: "s1", dateJoining: day(200), contractEndDate: day(-100), tagIds: [] },
  { id: "s8", dob: day(26 * 365), gender: "Female", maritalStatus: "Single", address: "44 Wilmer Street", lga: "Amuwo-Odofin", state: "Lagos", qualification: "OND Office Tech", companyId: "co1", departmentId: "d6", jobPositionId: "jp7", employeeTypeId: "et1", reportingManagerId: "s1", dateJoining: day(600), tagIds: [] },
];

export const policies: Policy[] = [
  {
    id: "pol1", category: "Safety & Clinical", title: "Infection Prevention & Control Policy",
    purpose: "To protect patients, staff and visitors from healthcare-associated infection.",
    body: "All clinical staff must perform hand hygiene at the 5 WHO moments, use appropriate PPE for the level of patient contact, and follow the facility's sharps and waste-segregation protocol. Any needle-stick or exposure incident must be reported to the infection control focal person within 1 hour. Isolation precautions apply to any suspected or confirmed notifiable disease per the Surveillance module.",
    updatedAt: day(120),
  },
  {
    id: "pol2", category: "Data & Security", title: "NDPR Patient Data Privacy Policy",
    purpose: "To ensure compliance with the Nigeria Data Protection Regulation (NDPR) for patient and staff data.",
    body: "Patient records may only be accessed for direct care, billing, or reporting duties tied to the accessor's role. Every view, edit and export is written to the audit log. Data must never be shared outside the facility without the patient's consent or a lawful basis. Staff who leave the facility have their system access revoked as part of the offboarding Work Handover stage.",
    updatedAt: day(60),
  },
  {
    id: "pol3", category: "Conduct", title: "Code of Conduct",
    purpose: "To set expectations for professional, ethical behaviour with patients and colleagues.",
    body: "All staff must treat patients and colleagues with dignity and respect, maintain confidentiality, and avoid conflicts of interest. Harassment, discrimination or falsification of clinical records will not be tolerated and may lead to disciplinary action up to and including termination.",
    updatedAt: day(200),
  },
  {
    id: "pol4", category: "Leave & Attendance", title: "Attendance & Punctuality Policy",
    purpose: "To ensure adequate clinical coverage across all shifts.",
    body: "Staff must clock in within the shift's late-grace window and clock out at the end of their shift. Repeated lateness or missed checkouts are reviewed under the Workforce exception-resolution process and may result in a disciplinary action.",
    updatedAt: day(90),
  },
  {
    id: "pol5", category: "IT & Assets", title: "Equipment & Device Usage Policy",
    purpose: "To protect company-issued devices and clinical equipment from misuse or loss.",
    body: "Company-issued phones, laptops and access badges remain the property of the facility and must be returned during offboarding Work Handover. Loss or damage should be reported immediately via Helpdesk or the Assets module.",
    updatedAt: day(150),
  },
];

export const actionTypes: ActionType[] = [
  { id: "at1", name: "Verbal Warning", blockOption: false },
  { id: "at2", name: "Written Warning", blockOption: false },
  { id: "at3", name: "Suspension", blockOption: true },
  { id: "at4", name: "Termination Notice", blockOption: true },
];

export const documents: EmployeeDocument[] = [
  { id: "doc1", employeeId: "s2", title: "Nursing & Midwifery Council of Nigeria (NMCN) License", category: "License / Certification", status: "Approved", issueDate: day(700), expiryDate: day(-20), notifyBeforeDays: 30 },
  { id: "doc2", employeeId: "s7", title: "Medical Laboratory Science Council (MLSCN) License", category: "License / Certification", status: "Approved", issueDate: day(400), expiryDate: day(-8), notifyBeforeDays: 30 },
  { id: "doc3", employeeId: "s1", title: "Medical & Dental Council (MDCN) License", category: "License / Certification", status: "Approved", issueDate: day(1200), expiryDate: day(-180), notifyBeforeDays: 30 },
  { id: "doc4", employeeId: "s5", title: "Contract of Employment", category: "Contract", status: "Approved", issueDate: day(300), notifyBeforeDays: 30 },
  { id: "doc5", employeeId: "s3", title: "NYSC Discharge Certificate", category: "Academic", status: "Requested", notifyBeforeDays: 30 },
];

export const disciplinaryActions: DisciplinaryAction[] = [
  { id: "da1", employeeIds: ["s5"], actionTypeId: "at1", description: "Repeated late arrival at the outreach van pickup point (3 occurrences in August).", unit: "Days", amount: 0, startDate: day(9) },
];

export const notes: EmployeeNote[] = [
  { id: "n1", employeeId: "s3", note: "Completed the neonatal resuscitation refresher — recommend for the next mentorship cohort.", by: "Nurse Grace Nwangbo", at: day(15) },
];

export const qualifications: Qualification[] = [
  { id: "q1", employeeId: "s1", title: "MBBS", issuingBody: "University of Lagos", dateObtained: day(4000) },
  { id: "q2", employeeId: "s1", title: "Master of Public Health (MPH)", issuingBody: "University of Ibadan", dateObtained: day(2200) },
  { id: "q3", employeeId: "s2", title: "Registered Nurse (RN)", issuingBody: "School of Nursing, Lagos", dateObtained: day(3600) },
  { id: "q4", employeeId: "s2", title: "Registered Midwife (RM)", issuingBody: "School of Midwifery, Lagos", dateObtained: day(3000) },
  { id: "q5", employeeId: "s7", title: "AMLSCN Certification", issuingBody: "Association of Medical Laboratory Scientists of Nigeria", dateObtained: day(1500) },
];

export const bonusPoints: BonusPoints[] = [
  { employeeId: "s2", points: 40, history: [{ delta: 25, reason: "Covered an unplanned night shift at short notice", at: day(20), by: "Dr. Adaeze Okonjo" }, { delta: 15, reason: "Zero missed-checkout incidents this quarter", at: day(4), by: "Dr. Adaeze Okonjo" }] },
  { employeeId: "s6", points: 15, history: [{ delta: 15, reason: "NHMIS monthly return submitted 5 days early", at: day(10), by: "Dr. Adaeze Okonjo" }] },
];
