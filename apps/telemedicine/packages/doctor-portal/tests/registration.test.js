import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_REGISTRATION, DRAFT_KEY, canonicalEmail, draftValues, loadRegistrationDraft, validateRegistrationStep, documentError, passwordError, registrationPayload } from '../src/pages/auth/registrationModel.js';
const values = { ...EMPTY_REGISTRATION, firstName: 'Demo', lastName: 'Practitioner', email: 'Demo.Doctor@EXAMPLE.COM', phone: '+234 801 234 5678', password: 'a memorable test passphrase', confirmPassword: 'a memorable test passphrase', specialty: 'General Practice', qualification: 'MBBS', university: 'Demo University', graduationYear: '2015', registrationNumber: 'TEST-1234', practiceState: 'Lagos', city: 'Lagos', licenceExpiry: '2026-12-31', declaration: true, termsAccepted: true };
const docs = { licence: { type: 'application/pdf', size: 200 }, registrationCertificate: { type: 'image/png', size: 100 } };
const today = new Date(2026, 9, 5);
test('valid registration passes every step', () => { for(let step = 0; step < 4; step++) assert.deepEqual(validateRegistrationStep(step, values, docs, today), {}); });
test('account details require contact information, matching passwords and a long passphrase', () => {
 const errors = validateRegistrationStep(0, { ...values, email: 'invalid', phone: '08012345678', password: 'short', confirmPassword: 'different' }, docs, today);
 for(const key of ['email', 'phone', 'password', 'confirmPassword']) assert.ok(errors[key]);
 assert.equal(passwordError('a long phrase with spaces'), '');
 assert.ok(passwordError('x'.repeat(129)));
});
test('profession and annual licence checks reject future graduation and expired licences', () => {
 assert.ok(validateRegistrationStep(1, { ...values, graduationYear: '2027' }, docs, today).graduationYear);
 assert.ok(validateRegistrationStep(1, { ...values, specialty: 'Unknown' }, docs, today).specialty);
 assert.ok(validateRegistrationStep(2, { ...values, licenceExpiry: '2025-12-31' }, docs, today).licenceExpiry);
 assert.deepEqual(validateRegistrationStep(2, { ...values, licenceType: 'life', licenceExpiry: '' }, docs, today), {});
});
test('documents are required and constrained by file type, size and nonempty content', () => {
 assert.ok(documentError(null)); assert.ok(documentError({ type: 'application/javascript', size: 100 })); assert.ok(documentError({ type: 'application/pdf', size: 0 })); assert.ok(documentError({ type: 'application/pdf', size: 6 * 1024 * 1024 })); assert.equal(documentError(docs.licence), '');
 assert.ok(validateRegistrationStep(2, values, {}, today).registrationCertificate);
});
test('optional marketing consent does not block registration; mandatory attestations do', () => {
 assert.deepEqual(validateRegistrationStep(3, { ...values, updatesOptIn: false }, docs, today), {});
 const errors = validateRegistrationStep(3, { ...values, declaration: false, termsAccepted: false }, docs, today); assert.ok(errors.declaration); assert.ok(errors.termsAccepted);
});
test('saved registration drafts never include passwords, uploads or mandatory consent', () => {
 const draft = draftValues(values); assert.equal(draft.password, undefined); assert.equal(draft.confirmPassword, undefined); assert.equal(draft.termsAccepted, undefined);
 globalThis.sessionStorage = { getItem: () => JSON.stringify({ ...draft, password: 'injected secret', licence: 'file data', termsAccepted: true }) };
 const loaded = loadRegistrationDraft(); assert.equal(loaded.password, ''); assert.equal(loaded.termsAccepted, false); assert.equal(loaded.licence, undefined); assert.equal(loaded.email, values.email);
 sessionStorage.getItem = () => '{broken'; assert.equal(loadRegistrationDraft().firstName, '');
});
test('email canonicalization preserves local identity and payload omits confirmation password', () => {
 assert.equal(canonicalEmail(' Demo.Doctor@EXAMPLE.COM '), 'Demo.Doctor@example.com');
 const payload = registrationPayload(values); assert.equal(payload.confirmPassword, undefined); assert.equal(payload.phone, '+2348012345678'); assert.equal(payload.country, 'NG'); assert.equal(payload.regulator, 'MDCN');
});
test('unverified and unapproved doctors cannot activate a clinical session', async () => {
 const { activateDoctorSession } = await import('../src/store/doctorSession.js');
 assert.throws(() => activateDoctorSession({ id: 'new-doctor', name: 'Demo Doctor', accountStatus: 'review_pending', emailVerified: true, licenceVerified: false }), /verified and approved/);
 assert.throws(() => activateDoctorSession({ id: 'new-doctor', name: 'Demo Doctor', accountStatus: 'active', emailVerified: false, licenceVerified: true }), /verified and approved/);
});
