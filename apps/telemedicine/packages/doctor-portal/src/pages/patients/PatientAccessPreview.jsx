import React, { useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAccessRequests, subscribeToAccess, decidePreviewAccess, LIVE_RECORDS } from '../../store/recordAccessStore';
import { getCurrentDoctor } from '../../store/doctorSession';
import { useRecordPermission } from '../../components/PatientRecord';
import '../../components/PatientRecord.css';
function Decision({request}) {
  const [allowAI,setAI]=useState(false),[error,setError]=useState('');
  const decide=status=>{try{decidePreviewAccess(request.id,request.patientId,status,allowAI);}catch(e){setError(e.message);}};
  const expired=request.expiresAt <= Date.now();
  return <article><h3>{request.doctorName} requests your medical record</h3><p>For your current consultation: medical history, recorded allergies, sent prescriptions, reports and lab orders.</p><p>Access ends when the consultation finishes or at {new Date(request.expiresAt).toLocaleTimeString()}.</p><p role="status">Status: {expired ? 'Expired' : request.status}</p>{!expired && request.status==='pending' && <><label><input type="checkbox" checked={allowAI} onChange={e=>setAI(e.target.checked)}/> Also allow AI-assisted summaries and searches of my shared record during this consultation.</label><div className="consent-actions"><button className="dp-btn dp-btn-primary" onClick={()=>decide('granted')}>Grant record access</button><button className="dp-btn dp-btn-outline" onClick={()=>decide('denied')}>Decline</button></div></>}{!expired && request.status==='granted' && <><p>AI summaries: {request.allowAI?'Allowed':'Not allowed'}</p><button className="dp-btn dp-btn-outline" onClick={()=>decide('revoked')}>Revoke access</button></>}{error&&<p role="alert">{error}</p>}</article>;
}
export default function PatientAccessPreview() {
  const rows=useSyncExternalStore(subscribeToAccess,getAccessRequests,getAccessRequests);
  useRecordPermission(null);
  const [params]=useSearchParams();
  const [selected,setSelected]=useState(params.get('patient') || rows[0]?.patientId || '');
  if(LIVE_RECORDS || !getCurrentDoctor()?.isDemo) return <main className="consent-page"><h1>Patient consent preview unavailable</h1><Link to="/dashboard">Back to portal</Link></main>;
  const patients=[...new Map(rows.map(r=>[r.patientId,r.patientName])).entries()];
  return <main className="consent-page"><Link to="/consultations">Back to doctor consultations</Link><h1>Patient access requests</h1><p><strong>Patient-side demo preview</strong> — this simulates a separate patient account. It does not authenticate a patient or send notifications.</p><label>Preview patient <select aria-label="Preview patient" value={selected} onChange={e=>setSelected(e.target.value)}>{patients.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>{rows.filter(r=>r.patientId===selected).map(r=><Decision key={r.id} request={r}/>)}{!rows.some(r=>r.patientId===selected)&&<p>No access requests.</p>}</main>;
}
