import { test } from 'node:test';
import assert from 'node:assert/strict';
const local = new Map(), session = new Map(), events = new Map();
globalThis.window = { localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) }, sessionStorage: { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) }, addEventListener: (type, fn) => { const list = events.get(type) || []; events.set(type, [...list, fn]); } };
const identity = await import('../src/store/doctorSession.js');
const scoped = await import('../src/store/scopedStore.js');
const rx = await import('../src/store/prescriptionStore.js');
const reports = await import('../src/store/reportStore.js');
const appointments = await import('../src/store/doctorAppointmentStore.js');
const availability = await import('../src/store/doctorAvailabilityStore.js');
const messages = await import('../src/store/messageStore.js');
const queue = await import('../src/store/hospitalQueueStore.js');
const profile = await import('../src/store/profileStore.js');
const diagnoses = await import('../src/store/diagnosisStore.js');
test('switching doctors separates records, messages, profiles, drafts and cache snapshots', () => {
 identity.selectDemoDoctor('doctor-verma');
 const a = rx.addPrescription({ patientName: 'Demo Patient', notes: 'Doctor A only' });
 const report = reports.addReportDraft({ patientName: 'Demo Patient', diagnosisSummary: 'Doctor A report' });
 scoped.writeDoctorStorage('draft-visit', 'doctor A notes');
 const snapshotA = appointments.getDoctorAppointments();
 assert.equal(appointments.getDoctorAppointments(), snapshotA);
 assert.equal(profile.getProfile().identity.name, 'Dr. Amara Verma');
 identity.selectDemoDoctor('doctor-jenkins');
 assert.deepEqual(rx.getPrescriptions(), []);
 assert.deepEqual(reports.getReports(), []);
 assert.deepEqual(messages.getThreads(), []);
 assert.deepEqual(appointments.getDoctorAppointments(), []);
 assert.equal(scoped.readDoctorStorage('draft-visit'), null);
 assert.equal(profile.getProfile().identity.name, 'Dr. Sarah Jenkins');
 assert.equal(rx.updatePrescription(a.id, { notes: 'Wrong doctor edit' }), null);
 assert.equal(reports.updateReport(report.id, { status: 'sent' }), null);
 const b = rx.addPrescription({ patientName: 'Demo Patient', notes: 'Doctor B only' });
 assert.equal(b.doctorId, 'doctor-jenkins');
 assert.equal(b.doctorName, 'Dr. Sarah Jenkins');
 const dx = diagnoses.addDiagnosis({ patientName: 'Demo Patient', diagnosis: 'Demo diagnosis' });
 assert.equal(dx.authorDoctorId, 'doctor-jenkins');
 identity.selectDemoDoctor('doctor-verma');
 assert.equal(rx.getPrescriptions()[0].id, a.id);
 assert.equal(rx.getPrescriptions()[0].notes, 'Doctor A only');
 assert.equal(scoped.readDoctorStorage('draft-visit'), 'doctor A notes');
 assert.equal(appointments.getDoctorAppointments(), snapshotA);
});
test('availability returns a new snapshot without mutating the previous one', () => {
 identity.selectDemoDoctor('doctor-verma');
 const before = availability.getAvailability();
 const enabled = before.weeklyHours.Monday.enabled;
 availability.toggleDay('Monday');
 const after = availability.getAvailability();
 assert.notEqual(before, after);
 assert.equal(before.weeklyHours.Monday.enabled, enabled);
 assert.equal(after.weeklyHours.Monday.enabled, !enabled);
});
test('shared hospital claims belong to a doctor and cannot be claimed twice', () => {
 identity.selectDemoDoctor('doctor-verma');
 const row = queue.getQueue()[0];
 assert.equal(queue.claimPatient(row.id).assignedDoctorId, 'doctor-verma');
 identity.selectDemoDoctor('doctor-jenkins');
 assert.equal(queue.getQueue()[0].assignedDoctorId, 'doctor-verma');
 assert.equal(queue.claimPatient(row.id), null);
});
test('malformed storage falls back safely and storage events invalidate cached snapshots', () => {
 identity.selectDemoDoctor('doctor-verma');
 local.set(scoped.doctorStorageKey('test-invalid'), '{bad json');
 const invalid = scoped.createScopedStore({ key: 'test-invalid' });
 assert.deepEqual(invalid.get(), []);
 const store = scoped.createScopedStore({ key: 'test-events' });
 const before = store.get();
 let notifications = 0; store.subscribe(() => notifications++);
 const key = scoped.doctorStorageKey('test-events');
 local.set(key, JSON.stringify([{ id: 'fresh' }]));
 for (const handler of events.get('storage')) handler({ key });
 assert.equal(notifications, 1);
 assert.notEqual(store.get(), before);
 assert.equal(store.get()[0].id, 'fresh');
});
test('legacy prototype data is visible only to the original demo doctor', () => {
 local.set('legacy-test', JSON.stringify([{ id: 'legacy' }]));
 const store = scoped.createScopedStore({ key: 'legacy-test' });
 identity.selectDemoDoctor('doctor-jenkins'); assert.deepEqual(store.get(), []);
 identity.selectDemoDoctor('doctor-verma'); assert.equal(store.get()[0].id, 'legacy');
});
test('sent documents are immutable and signed-out sessions cannot save', () => {
 identity.selectDemoDoctor('doctor-verma');
 const doc = rx.addPrescription({ patientName: 'Demo Patient', notes: 'Approved' });
 rx.updatePrescription(doc.id, { status: 'finalized', doctorId: 'doctor-jenkins' });
 assert.equal(rx.getPrescriptions().find((r) => r.id === doc.id).doctorId, 'doctor-verma');
 rx.sendToPatient(doc.id);
 assert.equal(rx.updatePrescription(doc.id, { notes: 'Changed after send' }), null);
 identity.signOutDoctor(); assert.equal(identity.getCurrentDoctor(), null);
 assert.throws(() => scoped.writeDoctorStorage('test', 'value'), /Select a doctor/);
 identity.selectDemoDoctor('doctor-verma');
});

test('new doctor defaults do not inherit credentials or patient statistics', () => {
 identity.selectDemoDoctor('doctor-jenkins');
 assert.equal(profile.getProfile().statistics.patientsTreated, '0');
 assert.deepEqual(profile.getProfile().credentials, []);
 identity.selectDemoDoctor('doctor-verma');
});

test('failed persistence does not replace a saved snapshot with an unsaved one', () => {
 identity.selectDemoDoctor('doctor-verma');
 const store = scoped.createScopedStore({ key: 'failed-save' });
 store.write([{ id: 'saved' }]);
 const before = store.get();
 const original = window.localStorage.setItem;
 window.localStorage.setItem = () => { throw new Error('Storage full'); };
 try { assert.throws(() => store.write([{ id: 'unsaved' }]), /Storage full/); } finally { window.localStorage.setItem = original; }
 assert.equal(store.get(), before);
 assert.equal(store.get()[0].id, 'saved');
});
