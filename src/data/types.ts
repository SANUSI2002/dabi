export type Sex = "M" | "F";
export type Payer = "Out of Pocket" | "Government Scheme" | "NHIS";

export type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  sex: Sex;
  dob: string;
  phone?: string;
  address: string;
  lga: string;
  state: string;
  ward?: string;
  category: string; // PatientCategory.code
  payer: Payer;
  nin?: string;
  bloodGroup?: string;
  allergies?: string;
  nextOfKin?: string;
  nokPhone?: string;
  registeredAt: string;
};

export type Vitals = {
  bp?: string;
  temp?: number;
  pulse?: number;
  resp?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  muac?: number;
  glucose?: number;
  takenAt: string;
  takenBy: string;
};

export type Station = (typeof import("./catalog").STATIONS)[number];
export type QueueStatus = "Waiting" | "In Progress" | "Completed" | "Referred";

export type QueueEntry = {
  id: string;
  patientId: string;
  station: Station;
  priority: "Normal" | "Urgent" | "Emergency";
  complaint?: string;
  status: QueueStatus;
  assignedTo?: string;
  enqueuedAt: string;
  waitMins: number;
};

export type Prescription = {
  id: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  qty: number;
  status: "Pending" | "Dispensed" | "Outsourced";
};

export type LabOrder = {
  id: string;
  patientId: string;
  test: string;
  category: string;
  urgency: "Routine" | "Urgent";
  status: "Pending" | "Sample Collected" | "In Process" | "Resulted" | "Rejected";
  orderedAt: string;
  orderedBy: string;
  result?: string;
  flag?: "Normal" | "Low" | "High" | "Critical";
  verifiedBy?: string;
};

export type Encounter = {
  id: string;
  patientId: string;
  date: string;
  provider: string;
  complaint: string;
  examination?: string;
  assessment?: string;
  plan?: string;
  diagnoses: { code: string; name: string }[];
  prescriptions: Prescription[];
  labs: string[];
  station: Station;
};

export type Admission = {
  id: string;
  patientId: string;
  ward: string;
  bed: string;
  diagnosis: string;
  admittedAt: string;
  status: "Active" | "Discharged";
  outcome?: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  date: string;
  time: string;
  provider: string;
  type: "General" | "ANC" | "PNC" | "Follow-up" | "Immunization" | "Specialist";
  reason?: string;
  status: "Scheduled" | "Attended" | "No-Show" | "Cancelled";
};

export type DrugStock = {
  id: string;
  name: string;
  form: string;
  strength: string;
  klass: string;
  batches: number;
  stock: number;
  reorder: number;
};

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  cadre: string;
  phone?: string;
  email?: string;
  hireDate: string;
  license?: string;
  status: "Active" | "Inactive";
};

export type Referral = {
  id: string;
  patientId: string;
  type: "Out" | "In" | "Internal";
  diagnosis: string;
  facility: string;
  reason: string;
  urgency: "Routine" | "Urgent" | "Emergency";
  status: "Open" | "Completed";
  date: string;
};

export type AncRecord = {
  id: string;
  patientId: string;
  lmp: string;
  edd: string;
  gravida: number;
  para: number;
  bloodGroup?: string;
  hb?: number;
  ttDoses: number;
  status: "Active" | "Delivered" | "Transferred";
  visits: { date: string; weeks: number; weight: number; bp: string; hb?: number; fhr?: number; next: string }[];
};

export type FpClient = {
  id: string;
  patientId: string;
  method: string;
  firstTime: boolean;
  startDate: string;
  nextVisit?: string;
  counselled: boolean;
  status: "Active" | "Discontinued";
  notes?: string;
};

export type ChildVisit = {
  id: string;
  patientId: string;
  date: string;
  weight: number;
  height: number;
  muac: number;
  waz?: number;
  status: "Normal" | "MAM" | "SAM";
  feeding: string;
};

export type AuditEvent = {
  id: string;
  ts: string;
  user: string;
  role: string;
  action: string;
  resource: string;
  ip: string;
};

export type Delivery = {
  id: string;
  patientId: string;
  date: string;
  mode: string;
  gaWeeks: number;
  motherStatus: "Alive" | "Died" | "Referred";
  bloodLoss: number;
  babySex: Sex;
  babyStatus: "Alive" | "Fresh stillbirth" | "Macerated stillbirth";
  weight: number;
  apgar1: number;
  apgar5: number;
  breastfed1h: boolean;
  conductedBy: string;
};

export type PncVisit = {
  id: string;
  patientId: string;
  date: string;
  timing: string;
  daysPP: number;
  bp?: string;
  uterus: string;
  lochia: string;
  breast: string;
  breastfeeding: string;
  dangerSigns: string[];
  fpCounselled: boolean;
};

export type CmamScreening = {
  id: string;
  patientId: string;
  date: string;
  muac: number;
  oedema: string;
  appetite: string;
  cls: "Normal" | "MAM" | "SAM";
  program: string;
};

export type OutreachActivity = {
  id: string;
  chw: string;
  type: string;
  ward: string;
  households: number;
  referrals: number;
  date: string;
};

export type SurveillanceCase = {
  id: string;
  patientId: string;
  disease: string;
  onset: string;
  reportedAt: string;
  status: "Suspected" | "Confirmed" | "Discarded";
};

export type NcdClient = {
  id: string;
  patientId: string;
  condition: string;
  enrolledAt: string;
  bp?: string;
  fbs?: number;
  control: "Controlled" | "Uncontrolled";
  nextVisit: string;
};

export type InvoiceLine = {
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  number: string;
  patientId: string;
  payer: Payer;
  category: string;
  lines: InvoiceLine[];
  exempt: boolean;
  createdAt: string;
  status: "Unpaid" | "Paid" | "Waived";
  paidAt?: string;
  method?: "Cash" | "POS" | "Transfer" | "NHIS" | "Waiver";
};
