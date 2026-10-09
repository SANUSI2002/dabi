import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import SabiHealthLogin from '../pages/Onboarding/login';
import { restoreSession, signOut } from '../utils/sabiIdentity';
import { getEmergencyResponder, lookupEmergencySummary } from '../api/emergencyCardApi';
import './EmergencyCard.css';

const SOURCE = { PATIENT_REPORTED: 'Patient-reported · not clinician-verified', CLINICIAN_RECORDED: 'Clinician-recorded prescription', CLINICIAN_VERIFIED: 'Clinician-verified', UNKNOWN: 'Unknown / unavailable' };
const date = (value) => value ? new Date(value).toLocaleString() : 'Unavailable';
const Meta = ({ item }) => <small>{SOURCE[item.verification] || 'Unknown / unavailable'}{item.source ? ` · ${item.source}` : ''}{item.updatedAt ? ` · ${date(item.updatedAt)}` : ''}</small>;
export function EmergencySummary({ summary, access }) {
  const { identification, allergies, medications, conditions, bloodGroup, contacts } = summary;
  return <div className="ec-summary" role="region" aria-label="Read-only emergency summary">
    <section className="sx-card"><span className="sx-badge">Read-only emergency access</span><h2>{identification.name || identification.displayName || 'Name unavailable'}</h2>
      <p>Sabi reference: {identification.patientReference || 'Unavailable'} · Date of birth: {identification.dateOfBirth ? new Date(identification.dateOfBirth).toLocaleDateString() : 'Unavailable'}</p>
      <p>Last updated: {date(summary.lastUpdatedAt)} · Retrieved: {date(access.at)}</p><p>{summary.notice}</p>
    </section>
    <div className="ec-summary-grid">
      <section className="sx-card"><h2>Allergies</h2>
        {allergies.state === 'NO_KNOWN_RECORDED' ? <p>No known allergies explicitly recorded.<small>{SOURCE[allergies.verification]}</small></p>
          : !allergies.items.length ? <p>Allergy information is unknown. This does not mean no known allergies.</p>
            : <ul>{allergies.items.map((a, i) => <li key={i}>{a.value}<span> · Reaction: {a.reaction || 'not recorded'}</span><Meta item={a} /></li>)}</ul>}
      </section>
      <section className="sx-card"><h2>Blood group</h2><p>{bloodGroup.value || 'Unknown / unavailable'}</p><Meta item={bloodGroup} /><p>Confirm with clinical testing before treatment. A recorded blood group is not a substitute for testing.</p></section>
      <section className="sx-card"><h2>Current medicines</h2>
        {medications.state === 'UNKNOWN' && <p>No current medicine information has been recorded. Do not assume the patient takes no medicines.</p>}
        {medications.items.map((m, i) => <div key={i}><h3>{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</h3><p>{m.instructions || 'Instructions not recorded'}{m.status === 'PAUSED' ? ' · Schedule paused' : ''}</p><Meta item={m} /></div>)}
        {medications.patientReported.map((m, i) => <p key={i}>{m.value}<Meta item={m} /></p>)}
      </section>
      <section className="sx-card"><h2>Recorded conditions</h2>{!conditions.items.length ? <p>Conditions are unknown / unavailable.</p> : <ul>{conditions.items.map((c, i) => <li key={i}>{c.value}<Meta item={c} /></li>)}</ul>}</section>
      <section className="sx-card"><h2>Emergency contacts</h2>{!contacts.length ? <p>No emergency contact recorded.</p> : contacts.map((c, i) => <div key={i}><p>{c.name || 'Name unavailable'}{c.relationship ? ` · ${c.relationship}` : ''}</p>
        {c.phone ? <a className="sx-link" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> : <p>Phone unavailable.</p>}<Meta item={c} /></div>)}</section>
    </div>
  </div>;
}

export default function EmergencyAccessPage() {
  const [user, setUser] = useState(undefined); const [sessionError, setSessionError] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('code') || '');
  const [hospitals, setHospitals] = useState([]); const [contextReady, setContextReady] = useState(false);
  const [contextAttempt, setContextAttempt] = useState(0);
  const [hospitalId, setHospitalId] = useState(''); const [reason, setReason] = useState('');
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const epoch = useRef(0); const controller = useRef(null);
  const clear = () => { epoch.current += 1; controller.current?.abort(); setResult(null); setError(''); setBusy(false); };
  useEffect(() => {
    // Remove the identifier from browser history after reading it; never send it in a query string.
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    let live = true;
    restoreSession().then((who) => { if (live) setUser(who); }).catch((e) => { if (live) setSessionError(e.message); });
    return () => { live = false; epoch.current += 1; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!user) return undefined;
    let live = true; setContextReady(false);
    getEmergencyResponder().then((data) => { if (live) { setHospitals(data.hospitals); setContextReady(true); } }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [user, contextAttempt]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') clear(); };
    const leave = () => clear();
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); };
  }, []);
  const retrieve = async (event) => {
    event.preventDefault(); clear(); const request = ++epoch.current;
    controller.current = new AbortController(); setBusy(true);
    try { const data = await lookupEmergencySummary({ code, ...(hospitalId ? { hospitalId, reason } : {}) }, controller.current.signal); if (epoch.current === request) setResult(data); }
    catch (e) { if (epoch.current === request && e.name !== 'AbortError') { setError(e.message); if (e.status === 401) setUser(null); } }
    finally { if (epoch.current === request) setBusy(false); }
  };
  if (user === undefined) return <main className="ec-access"><p role="status">{sessionError || 'Checking your Sabi session…'}</p>{sessionError && <button className="sx-btn" onClick={() => window.location.reload()}>Try again</button>}</main>;
  if (!user) return <SabiHealthLogin responder onSignedIn={setUser} />;
  return <main className="ec-access"><div className="ec-access-inner">
    <header className="ec-access-head"><div><span className="sx-eyebrow"><ShieldCheck size={18} aria-hidden="true" /> Sabi Health</span><h1>Emergency access</h1><p>Only eligible Care Circle members and authorised clinical staff of verified Sabi hospitals can access a summary.</p></div>
      <button className="sx-btn sx-btn-secondary" onClick={async () => { clear(); await signOut(); setUser(null); }}>Sign out</button></header>
    <form className="sx-card ec-access-form" onSubmit={retrieve}>
      <p>Signed in as {user.fullName || user.email || 'Sabi user'}. A code identifies the patient; it does not grant access.</p>
      <label>Patient emergency code<input className="sx-input ec-readable-code" autoComplete="off" spellCheck="false" autoCapitalize="characters" required maxLength={80} value={code} onChange={(e) => { clear(); setCode(e.target.value); }} /></label>
      <label>Access as<select className="sx-input" value={hospitalId} disabled={!contextReady || busy} onChange={(e) => { clear(); setHospitalId(e.target.value); }}>
        <option value="">Care Circle member</option>{hospitals.map((h) => <option key={h.id} value={h.id}>Clinical staff · {h.name}</option>)}</select></label>
      {hospitalId && <label>Brief reason for emergency access<textarea className="sx-input" required minLength={5} maxLength={300} value={reason} onChange={(e) => { clear(); setReason(e.target.value); }} placeholder="For example: emergency assessment of an unresponsive patient" /><small>Do not include unnecessary medical details. This access is audited and the patient is notified.</small></label>}
      {!contextReady && !error && <p role="status">Checking your access roles…</p>}
      {error && <p className="sx-error-text" role="alert">{error}</p>}
      {!contextReady && error && <button type="button" className="sx-btn sx-btn-secondary" onClick={() => { clear(); setContextAttempt((n) => n + 1); }}>Retry access check</button>}
      <div className="sx-actions"><button type="submit" className="sx-btn sx-btn-primary" disabled={busy || !contextReady || !code.trim() || (hospitalId && reason.trim().length < 5)}>{busy ? 'Checking permission…' : 'View emergency summary'}</button>
        {result && <button className="sx-btn sx-btn-secondary" type="button" onClick={clear}>Clear summary</button>}</div>
    </form>
    {result && <EmergencySummary {...result} />}
    <p className="sx-hint">No approval from an unconscious patient is required. Their previously saved sharing consent and your current permissions are checked for each lookup.</p>
    {user.roles?.some((r) => ['PATIENT', 'CAREGIVER'].includes(r)) && <Link className="sx-link" to="/dashboard">Back to Sabi</Link>}
  </div></main>;
}
