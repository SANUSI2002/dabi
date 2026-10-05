import { test } from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
globalThis.window = { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
const identity = await import('../src/store/doctorSession.js');
identity.selectDemoDoctor('doctor-verma');
const rxStore = await import('../src/store/prescriptionStore.js');
const reportStore = await import('../src/store/reportStore.js');
test('prescription drafts persist lab orders and require finalization before patient delivery', () => {
 const rx = rxStore.addPrescription({ patientName: 'Demo Patient', notes: 'Demo instructions', consultationId: 'demo-visit', labOrders: [{ test: 'Demo test', instructions: 'Demo preparation', urgency: 'Routine' }] });
 assert.equal(rx.status, 'draft');
 assert.equal(rxStore.sendToPatient(rx.id), null);
 rxStore.updatePrescription(rx.id, { notes: 'Reviewed instructions', status: 'finalized' });
 const sent = rxStore.sendToPatient(rx.id);
 assert.equal(sent.patientStatus, 'sent');
 assert.equal(sent.recipient, 'Demo Patient');
 assert.equal(sent.patientTab, 'prescriptions');
 assert.equal(sent.labOrders[0].test, 'Demo test');
 assert.equal(JSON.parse(storage.get('sabi-doctor-prescriptions:doctor-verma'))[0].notes, 'Reviewed instructions');
});
test('consultation reports require finalization and share patient prescription destination', () => {
 const report = reportStore.addReportDraft({ patientName: 'Demo Patient', consultationId: 'demo-visit', subjective: 'Demo complaint', objective: 'Demo findings', diagnosisSummary: 'Demo summary', labOrders: [{ test: 'Demo test' }] });
 assert.equal(reportStore.sendReport(report.id, 'Draft message'), null);
 reportStore.updateReport(report.id, { status: 'finalized' });
 const sent = reportStore.sendReport(report.id, 'Final message');
 assert.equal(sent.status, 'sent');
 assert.equal(sent.recipient, 'Demo Patient');
 assert.equal(sent.patientTab, 'prescriptions');
 assert.equal(sent.subjective, 'Demo complaint');
 assert.equal(JSON.parse(storage.get('sabi-doctor-reports:doctor-verma'))[0].patientMessage, 'Final message');
});

test('appointments persist cancellation and rescheduling history', async () => {
 const store = await import('../src/store/doctorAppointmentStore.js');
 const appt = store.getDoctorAppointments().find((a) => a.type !== 'blocked');
 const moved = store.rescheduleAppointment(appt.id, { date: '2026-10-20', startTime: '10:00 AM', endTime: '10:30 AM' });
 assert.equal(moved.status, 'active');
 assert.ok(moved.rescheduledAt);
 assert.equal(moved.endTime, '10:30 AM');
 assert.equal(store.cancelAppointment(appt.id).status, 'cancelled');
});
