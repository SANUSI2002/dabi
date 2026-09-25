// Patient-facing Sabi Health API. Every call goes through authorizedRequest, which owns the
// access token and single-flight refresh. Server envelopes are { status, data }.
import { authorizedRequest } from "../utils/sabiIdentity";

const data = async (promise) => (await promise).data;
const get = (path, query) => data(authorizedRequest(path, { query }));
const post = (path, body = {}) => data(authorizedRequest(path, { method: "POST", body }));

// ---------------- Hospitals ----------------
const HOSPITAL_TYPE_LABELS = { HOSPITAL: "Hospital", CLINIC: "Clinic", LABORATORY: "Laboratory", DIAGNOSTIC_CENTRE: "Diagnostic Centre", OTHER: "Healthcare Facility" };

/** The directory only publishes verified facilities, so every result is one a patient can use. */
export const toHospital = (org) => ({
  id: org.id,
  name: org.name,
  typeLabel: HOSPITAL_TYPE_LABELS[org.type] || "Healthcare Facility",
  area: [org.city, org.state].filter(Boolean).join(", "),
  address: [org.address, org.city, org.state, org.country].filter(Boolean).join(", "),
  phone: org.contactPhone || null,
  email: org.contactEmail || null,
});

export const toPlan = (plan) => ({ id: plan.id, name: plan.name, description: plan.description, fee: (plan.feeMinor ?? 0) / 100 });

export async function listHospitals({ search, page = 1, limit = 24 } = {}) {
  const result = await get("/api/v1/organisations", { type: "hospital", search, page, limit });
  return { items: result.items.map(toHospital), total: result.total };
}

export async function getHospital(id) {
  return toHospital(await get(`/api/v1/organisations/${encodeURIComponent(id)}`));
}

export async function listHospitalPlans(hospitalId) {
  const result = await get(`/api/v1/hospitals/${encodeURIComponent(hospitalId)}/plans`, { limit: 100 });
  return result.items.map(toPlan);
}

// ---------------- Enrollments ----------------
export const ENROLLMENT_STATUS_LABELS = { PENDING: "Pending Approval", ACTIVE: "Enrolled", REJECTED: "Rejected" };

export const toEnrollment = (e) => ({
  id: e.id,
  hospitalId: e.hospitalId,
  hospitalName: e.hospital?.name,
  planId: e.planId,
  planName: e.plan?.name,
  fee: (e.plan?.feeMinor ?? 0) / 100,
  dependentId: e.dependentId || null,
  memberName: e.dependent?.fullName || null,
  status: e.status,
  statusLabel: ENROLLMENT_STATUS_LABELS[e.status] || e.status,
  decisionReason: e.decisionReason || null,
  createdAt: e.createdAt,
});

export async function listMyEnrollments({ status } = {}) {
  const result = await get("/api/v1/hospital-enrollments/mine", { status, limit: 100 });
  return result.items.map(toEnrollment);
}

export const createEnrollment = async ({ hospitalId, planId, dependentId, patientNote }) =>
  toEnrollment(await post("/api/v1/hospital-enrollments", { hospitalId, planId, ...(dependentId ? { dependentId } : {}), ...(patientNote ? { patientNote } : {}) }));

// ---------------- Hospital appointments ----------------
export const APPOINTMENT_STATUS_LABELS = { PENDING: "Awaiting hospital confirmation", SCHEDULED: "Confirmed", REJECTED: "Declined by hospital", CHECKED_IN: "Checked in", CANCELLED: "Cancelled" };

export const toHospitalAppointment = (a) => ({
  id: a.id,
  hospitalId: a.hospitalId,
  hospitalName: a.hospital?.name,
  dependentId: a.dependentId || null,
  memberName: a.dependent?.fullName || null,
  requestedAt: a.requestedAt,
  appointmentType: a.appointmentType || "Hospital appointment",
  reason: a.reason || null,
  status: a.status,
  statusLabel: APPOINTMENT_STATUS_LABELS[a.status] || a.status,
  decisionReason: a.decisionReason || null,
  checkedInAt: a.checkedInAt || null,
});

export async function listMyHospitalAppointments({ status } = {}) {
  const result = await get("/api/v1/hospital-appointments/mine", { status, limit: 100 });
  return result.items.map(toHospitalAppointment);
}

export const getHospitalAppointment = async (id) => toHospitalAppointment(await get(`/api/v1/hospital-appointments/${encodeURIComponent(id)}`));

export const createHospitalAppointment = async ({ hospitalId, dependentId, requestedAt, appointmentType, reason }) =>
  toHospitalAppointment(await post("/api/v1/hospital-appointments", {
    hospitalId, requestedAt, ...(dependentId ? { dependentId } : {}), ...(appointmentType ? { appointmentType } : {}), ...(reason ? { reason } : {}),
  }));

export const checkInHospitalAppointment = (id) => post(`/api/v1/hospital-appointments/${encodeURIComponent(id)}/check-in`);

// ---------------- Family circle (only what hospital care needs this round) ----------------
export async function listDependents() {
  const circle = await get("/api/v1/family-care/circle");
  return (circle.dependents || []).map((d) => ({ id: d.id, name: d.fullName, nickname: d.nickname || null }));
}

// ---------------- Wellness ----------------
export const WELLNESS_BOOKING_STATUS_LABELS = { PENDING: "Awaiting provider confirmation", CONFIRMED: "Confirmed", REJECTED: "Declined", CANCELLED: "Cancelled" };

export const listWellnessOfferings = (query = {}) => get("/api/v1/wellness", { limit: 100, ...query });
export const getWellnessOffering = (id) => get(`/api/v1/wellness/${encodeURIComponent(id)}`);
export const listMyWellnessBookings = (query = {}) => get("/api/v1/wellness/bookings/mine", { limit: 100, ...query });
export const getWellnessBooking = (id) => get(`/api/v1/wellness/bookings/${encodeURIComponent(id)}`);
export const bookWellness = ({ offeringId, requestedAt, context }) => post("/api/v1/wellness/bookings", { offeringId, requestedAt, ...(context ? { context } : {}) });

// ---------------- Vitals ----------------
export const listVitals = (query = {}) => get("/api/v1/vitals", { limit: 100, ...query });
export const recordVital = (reading) => post("/api/v1/vitals", reading);
