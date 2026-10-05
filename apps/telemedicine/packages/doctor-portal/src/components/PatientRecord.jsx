import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { accessFor, canReadRecord, requestRecordAccess, subscribeToAccess, getAccessRequests, LIVE_RECORDS } from '../store/recordAccessStore';
import { readPatientRecord } from '../services/patientRecord';
import { subscribeToDiagnoses } from '../store/diagnosisStore';
import { subscribeToPrescriptions } from '../store/prescriptionStore';
import { subscribeToReports } from '../store/reportStore';
import './PatientRecord.css';
export function useRecordPermission(scope) {
  useSyncExternalStore(subscribeToAccess, getAccessRequests, getAccessRequests);
  const [,tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x+1), 1000); return () => clearInterval(t); }, []);
  return { request: accessFor(scope), allowed: canReadRecord(scope), aiAllowed: canReadRecord(scope,true) };
}
export default function PatientRecord({ scope, canRequest = false }) {
  const {request,allowed} = useRecordPermission(scope);
  const [error,setError] = useState('');
  const [,update] = useState(0);
  useEffect(() => { const off = [subscribeToDiagnoses,subscribeToPrescriptions,subscribeToReports].map(sub => sub(() => update(n=>n+1))); return () => off.forEach(fn => fn()); }, []);
  if (!allowed) return <section className="record-lock"><LockKeyhole size={30}/><h3>Patient Record</h3><p>The patient must grant access before their medical history can be viewed.</p><p role="status">{LIVE_RECORDS ? 'Secure patient consent service is not connected.' : request?.status === 'pending' ? 'Waiting for the patient’s decision.' : request?.status === 'denied' ? 'The patient declined this request.' : request?.status === 'revoked' ? 'The patient withdrew access.' : 'Medical record locked'}</p>{canRequest && !LIVE_RECORDS && request?.status !== 'pending' && <button className="dp-btn dp-btn-primary" onClick={() => { try { requestRecordAccess(scope); setError(''); } catch(e) {setError(e.message);} }}>Request record access</button>}{!canRequest && <Link to={'/consultations?patient='+encodeURIComponent(scope?.patientName || '')}>Open a consultation to request access</Link>}{!LIVE_RECORDS && request?.status === 'pending' && <Link className="record-preview-link" to={'/patient-access-preview?patient='+encodeURIComponent(scope.patientId)}>Open patient consent preview</Link>}<small>Access lasts up to one hour and ends when the consultation is completed. AI summaries need separate patient permission.</small>{error && <p role="alert">{error}</p>}</section>;
  const data = readPatientRecord(scope);
  return <section className="patient-record"><div className="record-granted"><ShieldCheck size={18}/> Patient granted access · expires {new Date(request.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><h3>Patient Record</h3><p className="record-muted">Available shared history. Use the portal assistant to summarize or search this record when AI permission is granted.</p><h4>Allergies</h4><p>{data.allergies.join(', ') || 'No entries available. Confirm with the patient.'}</p><h4>Medical history</h4>{!data.diagnoses.length && <p>No clinical history available.</p>}{data.diagnoses.map(d => <article key={d.id}><small>{d.date} · {d.doctorName} · {d.id}</small><strong>{d.label}</strong><p>{d.notes}</p></article>)}<h4>Prescriptions shared with patient</h4>{!data.prescriptions.length && <p>No sent prescriptions available.</p>}{data.prescriptions.map(r=><article key={r.id}><small>{String(r.sentAt || r.issuedAt).slice(0,10)} · {r.rxId}</small><strong>{r.diagnosisLabel || 'Prescription'}</strong><p>{r.notes}</p>{r.medications.map((m,i)=><p key={i}>{m.drug} {m.dosage} · {m.frequency} · {m.duration}</p>)}{r.labOrders.map((o,i)=><p key={i}>Lab order: {o.test} · {o.instructions}</p>)}</article>)}<h4>Consultation reports</h4>{!data.reports.length && <p>No sent reports available.</p>}{data.reports.map(r=><article key={r.id}><small>{r.consultationDate} · {r.id}</small><strong>{r.diagnosisSummary}</strong><p>{r.subjective}</p><p>{r.objective}</p><p>{r.treatmentPlan}</p>{r.labOrders.map((o,i)=><p key={i}>Lab order: {o.test}</p>)}</article>)}</section>;
}
