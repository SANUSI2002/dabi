export type Sex = "M" | "F";
export type Payer = "Out of Pocket" | "Government Scheme" | "NHIS";

export type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  preferredName?: string;
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
  hospitalNumber?: string; // legacy paper-file / alternate identifier
  language?: string;
  occupation?: string;
  bloodGroup?: string;
  allergies?: string;
  nextOfKin?: string;
  nokPhone?: string;
  nokRelation?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  consentToContact?: boolean;
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

export type PrescriptionStatus = "Pending" | "Dispensed" | "Partially Dispensed" | "Outsourced" | "Refused" | "Cancelled";

export type Prescription = {
  id: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  qty: number;
  route?: string;
  indication?: string;
  instructions?: string;
  substitutionAllowed?: boolean;
  status: PrescriptionStatus;
  dispensedQty?: number;
  dispensedBy?: string;
  dispensedAt?: string;
  refusalReason?: string;
  /** free-text override reason if dispensed despite a safety warning */
  overrideReason?: string;
};

export type LabOrder = {
  id: string;
  patientId: string;
  test: string;
  category: string;
  urgency: "Routine" | "Urgent";
  status: "Pending" | "Sample Collected" | "In Process" | "Awaiting Approval" | "Resulted" | "Rejected";
  orderedAt: string;
  orderedBy: string;
  result?: string;
  flag?: "Normal" | "Low" | "High" | "Critical";
  verifiedBy?: string;
  // Workflow tracking — sample -> phased processing -> result entry -> sign-off
  sampleType?: string;
  sampleCollectedBy?: string;
  sampleCollectedAt?: string;
  phaseIndex?: number;
  phaseLog?: { name: string; by: string; at: string }[];
  resultFields?: Record<string, string>;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  revisionNote?: string;
  // result communication to the ordering clinician (distinct from the result itself)
  resultViewedBy?: string;
  resultViewedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  criticalCommunicatedBy?: string;
  criticalCommunicatedTo?: string;
  criticalCommunicatedAt?: string;
  // specimen rejection
  rejectedReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
};

export type EncounterStatus = "in-progress" | "signed" | "amended" | "cancelled";

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
  // document lifecycle — older mock records have no status and are treated as signed
  status?: EncounterStatus;
  signedBy?: string;
  signedAt?: string;
  amendedBy?: string;
  amendedAt?: string;
  amendmentNote?: string;
  visitType?: string;
  followUp?: string;
  patientInstructions?: string;
  /** NHMIS reporting indicators ticked during the encounter */
  nhmisIndicators?: string[];
  /** template the note was started from */
  templateKey?: string;
};

export type BedMove = {
  ward: string;
  bed: string;
  from: string; // ISO — when the patient moved into this bed
  reason?: string;
  by?: string;
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
  admittingClinician?: string;
  service?: string;
  reason?: string;
  isolation?: string;
  expectedDischarge?: string;
  dischargeReady?: boolean;
  bedHistory?: BedMove[];
  dischargedAt?: string;
  dischargedBy?: string;
  dischargeDestination?: string;
  dischargeSummary?: string;
};

export const INPATIENT_SERVICES = ["General Medicine", "Paediatrics", "Obstetrics", "Surgery", "Isolation", "Observation"] as const;
export const DISCHARGE_OUTCOMES = ["Recovered", "Improved", "Referred to higher level", "Discharged against advice", "Absconded", "Died"] as const;

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

export type PatientTransfer = {
  id: string;
  direction: "In" | "Out";
  patientId?: string; // linked local record (always set for Out)
  patientName: string;
  facility: string; // the other facility
  reason: "Relocation" | "Catchment reassignment" | "Service not available here" | "Patient request" | "Higher level of care";
  summary?: string; // clinical handover note
  date: string;
  status: "Pending" | "Completed" | "Cancelled";
  recordsSent?: boolean; // Out: EMR summary transmitted to the receiving facility
  completedAt?: string;
  handledBy?: string;
};

export type ReferralFeedback = {
  outcome: "Admitted & managed" | "Treated & discharged" | "Investigations done" | "Patient did not attend" | "Referred onward";
  note: string;
  by: string; // receiving-facility clinician
  at: string;
  backReferral: boolean; // returned for continued care at the PHC
};

export type ReferralStatus =
  | "Requested" | "Accepted" | "Declined" | "Scheduled" | "Attended" | "Completed" | "Cancelled"
  | "Open" | "Acknowledged"; // legacy seed values, treated as Requested / Accepted

export type Referral = {
  id: string;
  patientId: string;
  /** Internal = another unit/clinic in this facility; Out = external organisation; In = received from elsewhere */
  type: "Out" | "In" | "Internal";
  diagnosis: string;
  facility: string; // receiving unit or facility
  reason: string;
  urgency: "Routine" | "Urgent" | "Emergency";
  status: ReferralStatus;
  date: string;
  referredBy?: string;
  clinicalSummary?: string;
  attachedResultIds?: string[];
  receivingClinician?: string;
  declineReason?: string;
  appointmentDate?: string;
  attendedDate?: string;
  feedback?: ReferralFeedback;
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

export type FpVisitType = "New Visit" | "Revisit" | "Resupply" | "Switch method" | "Removal";
export type FpVisit = {
  date: string;
  type: FpVisitType;
  method: string;
  nextVisit?: string;
  notes?: string;
  by: string;
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
  visits?: FpVisit[];
  discontinueReason?: string;
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

export type AuditFieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type AuditEvent = {
  id: string;
  ts: string;
  user: string;
  role: string;
  action: string;
  resource: string;
  ip: string;
  /** field-level before/after diff (Phase 46) */
  changes?: AuditFieldChange[];
  /** extra structured context (approval ref, reason, workflow instance…) */
  meta?: Record<string, unknown>;
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

export type BirthRegisterEntry = {
  id: string;
  deliveryId: string;
  patientId: string; // mother
  babyName: string;
  sex: Sex;
  bornAt: string; // ISO datetime
  weight: number;
  placeOfBirth: string;
  motherName: string;
  fatherName?: string;
  informantName: string;
  informantRelation: string;
  npopcNo: string; // birth-notification number
  regNo?: string; // civil registration number
  status: "Notified" | "Registered" | "Certificate issued";
  notifiedAt: string;
  registeredAt?: string;
  certIssuedAt?: string;
};

export type PncVisit = {
  id: string;
  patientId: string;
  deliveryId?: string;
  contact?: 1 | 2 | 3 | 4; // WHO PNC contact number
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
  notes?: string;
};

export type CmamOutcome = "Cured" | "Defaulter" | "Death" | "Non-response" | "Transferred";

export type CmamScreening = {
  id: string;
  patientId: string;
  date: string;
  muac: number;
  oedema: string;
  appetite: string;
  cls: "Normal" | "MAM" | "SAM";
  program: string;
  source?: "Nutrition" | "Child Health"; // where the screening originated
  outcome?: CmamOutcome;
  dischargedAt?: string;
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

export type Aefi = {
  symptoms: string;
  severity: "Non-serious" | "Serious";
  onsetHours: number;
  action: string;
  reportedAt: string;
  reportedBy: string;
};

export type Immunization = {
  id: string;
  patientId: string;
  vaccineCode: string;
  vaccineName: string;
  givenAt: string;
  givenBy: string;
  batchNo: string;
  site: string;
  aefi?: Aefi;
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
