export const statusLabel = (status) => ({ REQUESTED: "Needs response", CONFIRMED: "Confirmed", COMPLETED: "Completed", DECLINED: "Declined", CANCELLED: "Cancelled" }[status] || status);
export function localDay(instant) {
  const date = new Date(instant);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function safeMeetingUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function groupPatients(appointments) {
  const patients = new Map();
  for (const appointment of appointments) {
    const ownerId = appointment.patient?.userId;
    const id = appointment.dependentId ? `dependent:${appointment.dependentId}` : ownerId ? `patient:${ownerId}` : `appointment:${appointment.id}`;
    const patient = patients.get(id) || { id, userId: ownerId, patientId: appointment.patient?.patientId, name: appointment.dependent?.name || appointment.patient?.name || "Patient", dependent: Boolean(appointment.dependentId), appointments: [] };
    patient.appointments.push(appointment);
    patients.set(id, patient);
  }
  return [...patients.values()];
}
