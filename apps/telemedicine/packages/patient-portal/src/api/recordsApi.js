// Medical records, record folders, secure documents and the emergency summary.
// Records and folders are the patient's own metadata (/medical-records); files live in private
// storage behind /medical-documents and are only downloadable after the malware scan passes.
import { authorizedRequest } from "../utils/sabiIdentity";

const data = async (promise) => (await promise).data;
const get = (path, query) => data(authorizedRequest(path, { query }));
const send = (method, path, body) => data(authorizedRequest(path, { method, body }));

// ---------------- Records ----------------
export const RECORD_TYPES = [
  { value: "PHYSICAL", label: "In-person visit" },
  { value: "VIRTUAL", label: "Virtual consultation" },
  { value: "LAB_RESULT", label: "Lab result" },
  { value: "IMAGING", label: "Imaging" },
  { value: "OTHER", label: "Other" },
];
const typeLabel = (type) => RECORD_TYPES.find((t) => t.value === type)?.label || "Record";
export const isVisit = (record) => record.recordType === "PHYSICAL" || record.recordType === "VIRTUAL";

const displayDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export const toRecord = (r) => ({
  id: r.id,
  title: r.title,
  recordType: r.recordType,
  typeLabel: typeLabel(r.recordType),
  dateIso: r.date,
  date: displayDate(r.date),
  meta: [typeLabel(r.recordType), r.facility, r.doctorName].filter(Boolean).join(" · "),
  facility: r.facility,
  doctorName: r.doctorName,
  diagnosis: r.diagnosis,
  treatment: r.treatment,
  notes: r.notes,
  categoryId: r.categoryId,
});

// The API pages at 100; walk the pages so counts and folders always reflect every record.
export async function listRecords() {
  const items = [];
  for (let page = 1; ; page += 1) {
    const result = await get("/api/v1/medical-records", { page, limit: 100 });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) break;
  }
  return items.map(toRecord);
}

/** `fields.date` is a yyyy-mm-dd string from a date input. Blank optional fields are omitted. */
export function createRecord(fields) {
  const body = { title: fields.title.trim(), recordType: fields.recordType, date: new Date(`${fields.date}T00:00:00.000Z`).toISOString() };
  for (const key of ["facility", "doctorName", "diagnosis", "treatment", "notes"]) {
    if (fields[key]?.trim()) body[key] = fields[key].trim();
  }
  if (fields.categoryId) body.categoryId = fields.categoryId;
  return send("POST", "/api/v1/medical-records", body).then(toRecord);
}

export const fileRecord = (recordId, categoryId) =>
  send("PATCH", `/api/v1/medical-records/${recordId}/category`, { categoryId }).then(toRecord);

// ---------------- Folders ----------------
export const CATEGORY_ICONS = ["folder", "stethoscope", "flask", "scan", "syringe", "pill", "hospital"];

export const listCategories = () => get("/api/v1/medical-records/categories");
export const createCategory = (name, icon) => send("POST", "/api/v1/medical-records/categories", { name: name.trim(), icon });
export const deleteCategory = (id) => send("DELETE", `/api/v1/medical-records/categories/${id}`);

// ---------------- Emergency summary ----------------
const splitList = (value) => (value ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []);

export async function getEmergencySummary() {
  const profile = await get("/api/v1/medical-records/emergency-summary");
  return {
    bloodGroup: profile?.blood_type || null,
    genotype: profile?.genotype || null,
    allergies: splitList(profile?.known_allergies),
    chronicConditions: profile?.chronic_conditions || null,
    emergencyContact: profile?.emergencyContactName
      ? [profile.emergencyContactName, profile.emergencyContactRelation, profile.emergencyContactPhone].filter(Boolean).join(" · ")
      : null,
  };
}

/** Server-generated PDF (never cached by the API); returns a Blob. */
export const downloadEmergencyPdf = () => authorizedRequest("/api/v1/medical-documents/emergency-summary.pdf", { raw: true });

// ---------------- Documents ----------------
export const DOCUMENT_KINDS = [
  { value: "MEDICAL_RECORD", label: "Medical record" },
  { value: "LAB_RESULT", label: "Lab result" },
  { value: "IMAGING", label: "Imaging" },
  { value: "EXTERNAL_PRESCRIPTION", label: "Prescription from another provider" },
  { value: "OTHER", label: "Other" },
];
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const STATUS = {
  PENDING_UPLOAD: { label: "Upload incomplete", tone: "bad" },
  PENDING_SCAN: { label: "Security scan in progress", tone: "pending" },
  CLEAN: { label: "Available", tone: "good" },
  PENDING_CLINICAL_REVIEW: { label: "Awaiting clinical review", tone: "pending" },
  INFECTED: { label: "Blocked — failed security scan", tone: "bad" },
  REJECTED: { label: "Rejected", tone: "bad" },
};

export const toDocument = (d) => ({
  id: d.id,
  filename: d.originalFilename,
  kind: d.kind,
  kindLabel: DOCUMENT_KINDS.find((k) => k.value === d.kind)?.label || "Document",
  status: d.status,
  statusLabel: STATUS[d.status]?.label || d.status,
  tone: STATUS[d.status]?.tone || "neutral",
  downloadable: d.status === "CLEAN",
  byteSize: d.byteSize,
  medicalRecordId: d.medicalRecordId,
  createdAt: d.createdAt,
});

export async function listDocuments() {
  const result = await get("/api/v1/medical-documents", { limit: 50 });
  return result.items.map(toDocument);
}

/**
 * Three-step upload: reserve the document, PUT the bytes straight to private storage with the
 * short-lived signed URL, then ask the API to verify the stored object and queue the scan.
 */
export async function uploadDocument(file, { kind, medicalRecordId } = {}) {
  if (!DOCUMENT_TYPES.includes(file.type)) throw new Error("Only PDF, JPEG or PNG files can be uploaded.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Files must be 10 MB or smaller.");
  const reserved = await send("POST", "/api/v1/medical-documents/uploads", {
    filename: file.name,
    contentType: file.type,
    byteSize: file.size,
    kind,
    ...(medicalRecordId ? { medicalRecordId } : {}),
  });
  const { document, upload } = reserved;
  const put = await fetch(upload.url, { method: upload.method || "PUT", headers: upload.headers, body: file }).catch(() => null);
  if (!put?.ok) {
    await deleteDocument(document.id).catch(() => {});
    throw new Error("The file could not be sent to secure storage. Please try again.");
  }
  return send("POST", `/api/v1/medical-documents/${document.id}/complete-upload`);
}

/** Returns a short-lived signed URL; open it straight away. */
export const documentDownloadUrl = (id) => send("POST", `/api/v1/medical-documents/${id}/download`).then((r) => r.url);

export const deleteDocument = (id) => authorizedRequest(`/api/v1/medical-documents/${id}`, { method: "DELETE" });
