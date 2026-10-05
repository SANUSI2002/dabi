import { getDoctorAppointments } from '../store/doctorAppointmentStore.js';
import { canReadRecord } from '../store/recordAccessStore.js';
import { getDiagnoses } from '../store/diagnosisStore.js';
import { getPrescriptions } from '../store/prescriptionStore.js';
import { getReports } from '../store/reportStore.js';
import { allergiesFor } from '../utils/patientInfo.js';
export function readPatientRecord(scope, ai = false) {
  if (!canReadRecord(scope, ai)) throw new Error(ai ? 'Patient permission for AI record summaries is required.' : 'Patient record access has not been granted.');
  // Name matching is limited to the seeded preview; live patient IDs must be resolved server-side.
  const patientName = getDoctorAppointments().find(a => a.id === scope.consultationId).patientName;
  const match = r => r.patientName === patientName;
  return { patientName, allergies: allergiesFor(scope.patientName), diagnoses: getDiagnoses().filter(match), prescriptions: getPrescriptions().filter(r => match(r) && r.status === 'sent'), reports: getReports().filter(r => match(r) && r.status === 'sent') };
}
export function summarizeRecord(record, prompt) {
  const entries = [
    ...record.diagnoses.map(d => ({ id: d.id, date: d.date, title: d.label, text: d.notes || '', author: d.doctorName })),
    ...record.prescriptions.map(r => ({ id: r.rxId, date: r.sentAt || r.issuedAt, title: 'Prescription', text: [r.diagnosisLabel, r.notes, ...r.medications.map(m => [m.drug,m.dosage,m.frequency,m.duration].filter(Boolean).join(' ')), ...r.labOrders.map(o => 'Lab order: ' + o.test)].filter(Boolean).join('; '), author: r.doctorName })),
    ...record.reports.map(r => ({ id: r.id, date: r.consultationDate, title: 'Consultation report', text: [r.diagnosisSummary,r.subjective,r.objective,r.treatmentPlan,...r.labOrders.map(o => 'Lab order: '+o.test)].filter(Boolean).join('; '), author: r.doctorName }))
  ].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const condition = /hypertension|high blood pressure|\bi10\b/i.test(prompt) ? 'hypertension' : /(?:record of|history of|mentions? of|any|about)\s+([a-z][a-z -]{2,45}?)(?:\?|\.| in |$)/i.exec(prompt)?.[1]?.trim();
  const found = condition ? entries.filter(e => condition === 'hypertension' ? /hypertension|high blood pressure|\bi10\b/i.test(e.title+' '+e.text) : (e.title+' '+e.text).toLowerCase().includes(condition.toLowerCase())) : entries;
  return `${record.patientName} — ${condition ? 'Search for '+condition : 'Available medical history'}\n\n` + (found.length ? found.map(e => `${String(e.date).slice(0,10)} · ${e.title}\n${e.text}\nSource: ${e.id}${e.author ? ' · '+e.author : ''}`).join('\n\n') : `No ${condition ? 'matching entry' : 'history'} found in the shared records. This does not establish absence of a condition.`) + (!condition ? '\n\nAllergies recorded: '+(record.allergies.join(', ') || 'No entries available (not confirmation of no allergies).') : '') + '\n\nThis is a record extract for clinician review, not a new diagnosis. Only available shared records are included.';
}
