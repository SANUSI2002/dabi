import type { Patient, Payer, QueueEntry, Sex, Station } from "@/data/types";

// Translation between the EMR API's records and the shapes the existing screens render.
// The screens keep their own vocabulary (F/M, "Out of Pocket", "In Progress"); the API uses codes.

export type ApiSex = "FEMALE" | "MALE" | "OTHER" | "UNKNOWN";
export type ApiPayer = "OUT_OF_POCKET" | "GOVERNMENT_SCHEME" | "NHIS" | "HMO" | "CORPORATE";

/** A patient as the registry list, duplicate checks and full record return it (list rows omit some fields). */
export type ApiPatient = {
  id: string;
  medicalRecordNumber: string;
  givenName: string;
  familyName: string;
  otherNames?: string | null;
  preferredName?: string | null;
  dateOfBirth: string;
  sex: ApiSex;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  addressWard?: string | null;
  nationalId?: string | null;
  hospitalNumber?: string | null;
  payer?: ApiPayer | null;
  category?: string | null;
  language?: string | null;
  occupation?: string | null;
  bloodGroup?: string | null;
  reportedAllergies?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  consentToContact?: boolean | null;
  createdAt?: string;
};

export type ApiQueuePriority = "EMERGENCY" | "URGENT" | "NORMAL";
export type ApiQueueStatus = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "REFERRED";

export type ApiQueueEntry = {
  id: string;
  encounterId: string;
  patientId: string;
  station: Station;
  priority: ApiQueuePriority;
  status: ApiQueueStatus;
  complaint: string | null;
  queuedAt: string;
  calledAt: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  waitMinutes: number;
  version: number;
  patient: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "preferredName" | "dateOfBirth" | "sex" | "payer">;
};

const SEX_FROM_API: Record<ApiSex, Sex> = { FEMALE: "F", MALE: "M", OTHER: "Other", UNKNOWN: "Unknown" };
const SEX_TO_API: Record<Sex, ApiSex> = { F: "FEMALE", M: "MALE", Other: "OTHER", Unknown: "UNKNOWN" };
const PAYER_FROM_API: Record<ApiPayer, Payer> = {
  OUT_OF_POCKET: "Out of Pocket", GOVERNMENT_SCHEME: "Government Scheme", NHIS: "NHIS", HMO: "HMO", CORPORATE: "Corporate",
};
const PAYER_TO_API: Record<Payer, ApiPayer> = {
  "Out of Pocket": "OUT_OF_POCKET", "Government Scheme": "GOVERNMENT_SCHEME", NHIS: "NHIS", HMO: "HMO", Corporate: "CORPORATE",
};
export const PRIORITY_FROM_API: Record<ApiQueuePriority, QueueEntry["priority"]> = { EMERGENCY: "Emergency", URGENT: "Urgent", NORMAL: "Normal" };
export const PRIORITY_TO_API: Record<QueueEntry["priority"], ApiQueuePriority> = { Emergency: "EMERGENCY", Urgent: "URGENT", Normal: "NORMAL" };
export const STATUS_FROM_API: Record<ApiQueueStatus, QueueEntry["status"]> = { WAITING: "Waiting", IN_PROGRESS: "In Progress", COMPLETED: "Completed", REFERRED: "Referred" };
export const STATUS_TO_API: Record<QueueEntry["status"], ApiQueueStatus> = { Waiting: "WAITING", "In Progress": "IN_PROGRESS", Completed: "COMPLETED", Referred: "REFERRED" };

const text = (value: string | null | undefined) => value ?? undefined;

export function patientFromApi(record: ApiPatient): Patient {
  return {
    id: record.id,
    mrn: record.medicalRecordNumber,
    firstName: record.givenName,
    lastName: record.familyName,
    otherName: text(record.otherNames),
    preferredName: text(record.preferredName),
    sex: SEX_FROM_API[record.sex],
    dob: record.dateOfBirth,
    phone: text(record.phone),
    address: record.address ?? "",
    lga: record.lga ?? "",
    state: record.state ?? "",
    ward: text(record.addressWard),
    category: record.category ?? "",
    // A registration with no scheme recorded is self-paying.
    payer: record.payer ? PAYER_FROM_API[record.payer] : "Out of Pocket",
    nin: text(record.nationalId),
    hospitalNumber: text(record.hospitalNumber),
    language: text(record.language),
    occupation: text(record.occupation),
    bloodGroup: text(record.bloodGroup),
    allergies: text(record.reportedAllergies),
    nextOfKin: text(record.nextOfKinName),
    nokPhone: text(record.nextOfKinPhone),
    nokRelation: text(record.nextOfKinRelationship),
    emergencyContactName: text(record.emergencyContactName),
    emergencyContactPhone: text(record.emergencyContactPhone),
    emergencyContactRelation: text(record.emergencyContactRelationship),
    consentToContact: record.consentToContact ?? undefined,
    registeredAt: record.createdAt ?? "",
  };
}

/** The registration form as the API's create body. Blank optional fields are left out, never sent as "". */
export type RegistrationForm = {
  firstName: string; lastName: string; otherName: string; preferredName: string; sex: Sex; dob: string;
  phone: string; consentToContact: boolean; address: string; lga: string; state: string; ward: string;
  language: string; occupation: string; category: string; payer: Payer; nin: string; hospitalNumber: string;
  bloodGroup: string; allergies: string; nextOfKin: string; nokPhone: string; nokRelation: string;
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string;
};

export function registrationToApi(form: RegistrationForm) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    givenName: form.firstName.trim(),
    familyName: form.lastName.trim(),
    otherNames: optional(form.otherName),
    preferredName: optional(form.preferredName),
    dateOfBirth: form.dob,
    sex: SEX_TO_API[form.sex],
    phone: optional(form.phone),
    consentToContact: form.consentToContact,
    address: optional(form.address),
    lga: optional(form.lga),
    state: optional(form.state),
    addressWard: optional(form.ward),
    language: optional(form.language),
    occupation: optional(form.occupation),
    category: optional(form.category),
    payer: PAYER_TO_API[form.payer],
    nationalId: optional(form.nin.replace(/\s/g, "")),
    hospitalNumber: optional(form.hospitalNumber),
    bloodGroup: optional(form.bloodGroup),
    reportedAllergies: optional(form.allergies),
    nextOfKinName: optional(form.nextOfKin),
    nextOfKinPhone: optional(form.nokPhone),
    nextOfKinRelationship: optional(form.nokRelation),
    emergencyContactName: optional(form.emergencyContactName),
    emergencyContactPhone: optional(form.emergencyContactPhone),
    emergencyContactRelationship: optional(form.emergencyContactRelation),
  };
}

/** A queue entry as the queue table renders it, plus the version its next change must match. */
export type LiveQueueEntry = QueueEntry & { version: number; patient: Patient };

export function queueEntryFromApi(entry: ApiQueueEntry): LiveQueueEntry {
  return {
    id: entry.id,
    patientId: entry.patientId,
    encounterId: entry.encounterId,
    station: entry.station,
    priority: PRIORITY_FROM_API[entry.priority],
    complaint: text(entry.complaint),
    status: STATUS_FROM_API[entry.status],
    assignedTo: text(entry.assignedToName),
    enqueuedAt: entry.queuedAt,
    waitMins: entry.waitMinutes,
    version: entry.version,
    patient: patientFromApi(entry.patient),
  };
}
