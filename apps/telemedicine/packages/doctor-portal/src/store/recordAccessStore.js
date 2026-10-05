import { getCurrentDoctor, getDoctorId } from './doctorSession.js';
import { getDoctorAppointments } from './doctorAppointmentStore.js';
import { patientId } from '../utils/patientInfo.js';
export const LIVE_RECORDS = !!import.meta.env?.VITE_AUTH_API_BASE_URL;
const key = 'sabi-demo-record-consents-v1';
const listeners = new Set();
let rows;
export function recordPatientId(appt) { return appt.patientId || patientId(appt.patientName, appt.initials); }
export function getAccessRequests() {
  if (!rows) {
    try { const parsed = JSON.parse(localStorage.getItem(key)); rows = Array.isArray(parsed) ? parsed.filter(r => r && typeof r.id === 'string' && typeof r.patientId === 'string' && typeof r.doctorId === 'string' && Number.isFinite(r.expiresAt)) : []; } catch { rows = []; }
  }
  return rows;
}
export const subscribeToAccess = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function emit() { listeners.forEach(fn => fn()); }
function save(next) { localStorage.setItem(key, JSON.stringify(next)); rows = next; emit(); }
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === key || e.key === null) { rows = undefined; emit(); } });
export function accessFor(scope, now = Date.now()) {
  if (LIVE_RECORDS || !scope || !getCurrentDoctor()?.isDemo) return null;
  return getAccessRequests().find(r => r.doctorId === getDoctorId() && r.patientId === scope.patientId && r.consultationId === scope.consultationId && r.expiresAt > now) || null;
}
export function canReadRecord(scope, ai = false, now = Date.now()) {
  const r = accessFor(scope, now);
  const appt = getDoctorAppointments().find(a => a.id === scope?.consultationId && recordPatientId(a) === scope.patientId);
  return !!(appt && !['past','cancelled','declined','needs-response'].includes(appt.status) && r?.status === 'granted' && (!ai || r.allowAI));
}
export function requestRecordAccess(scope) {
  if (LIVE_RECORDS || !getCurrentDoctor()?.isDemo) throw new Error('Secure patient consent is not connected yet.');
  const appt = getDoctorAppointments().find(a => a.id === scope?.consultationId && recordPatientId(a) === scope.patientId);
  if (!appt || ['past','cancelled','declined','needs-response'].includes(appt.status)) throw new Error('Start an accepted consultation to request access.');
  const existing = accessFor(scope);
  if (existing && ['pending','granted'].includes(existing.status)) return existing;
  const r = { id: crypto.randomUUID(), doctorId: getDoctorId(), doctorName: getCurrentDoctor().name, patientId: scope.patientId, patientName: appt.patientName, consultationId: appt.id, status: 'pending', allowAI: false, requestedAt: new Date().toISOString(), expiresAt: Date.now() + 60 * 60 * 1000 };
  save([r, ...getAccessRequests().filter(x => !(x.doctorId === r.doctorId && x.patientId === r.patientId && x.consultationId === r.consultationId))]);
  return r;
}
// Preview only. In production the patient identity and decision must come from a patient-authenticated API.
export function decidePreviewAccess(id, patientIdentity, decision, allowAI = false) {
  if (LIVE_RECORDS || !getCurrentDoctor()?.isDemo) throw new Error('Patient preview is disabled for live accounts.');
  const r = getAccessRequests().find(x => x.id === id);
  if (!r || r.patientId !== patientIdentity || r.expiresAt <= Date.now()) throw new Error('This request is unavailable.');
  if (!((r.status === 'pending' && ['granted','denied'].includes(decision)) || (r.status === 'granted' && decision === 'revoked'))) throw new Error('Invalid consent decision.');
  save(getAccessRequests().map(x => x.id === id ? { ...x, status: decision, allowAI: decision === 'granted' && !!allowAI, decidedAt: new Date().toISOString() } : x));
}
export function endRecordAccess(consultationId) {
  if (LIVE_RECORDS) return;
  save(getAccessRequests().map(r => r.doctorId === getDoctorId() && r.consultationId === consultationId ? { ...r, status: 'revoked', allowAI: false } : r));
}
