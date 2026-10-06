import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DoctorRegistrationPage, {LegalNotice} from './DoctorRegistrationPage';
import AuthLayout from './AuthLayout';
import { getRegistrationConfig, registerProfessional } from '../../services/doctorAuth';
import './AuthPages.css';

const label = value => value?.replaceAll('_',' ').toLowerCase().replace(/^./, c => c.toUpperCase());
export default function ProfessionalRegistrationPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]), [config, setConfig] = useState(null), [type, setType] = useState(''), [form, setForm] = useState({country:'NG',consentVersion:'professional-registration-v1'}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { getRegistrationConfig().then(r => { const c = r.data || r; setConfig(c); setCatalog(c.professions || []); }).catch(e => setError(e.message)); }, []);
  const profession = catalog.find(p => p.type === type);
  const [legal,setLegal]=useState(null);
  function choose(value) { setType(value); setForm(f => ({...f,professionType:value,discipline:catalog.find(p => p.type === value)?.disciplines[0],registrationNumber:'',licenceType:undefined,licenceExpiry:undefined})); setError(''); }
  async function submit(event) { event.preventDefault(); if (busy || !config?.enabled) return; setBusy(true); setError(''); try { const data = await registerProfessional(form); setForm({country:'NG',consentVersion:'professional-registration-v1'}); navigate('/registration/status', {state:data}); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  if (type === 'DOCTOR') return <><div className="sh-form-notice" style={{margin:12}}><button onClick={() => choose('')}>← Choose another profession</button></div><DoctorRegistrationPage /></>;
  const licensed = ['REGISTERED_NURSE','COMMUNITY_HEALTH_PRACTITIONER'].includes(form.discipline);
  const field = (name, title, kind='text', required=true) => <div className="sh-auth-field" key={name}><label htmlFor={name}>{title}</label><input id={name} type={kind} required={required} value={form[name] ?? ''} maxLength={name === 'services' ? 1000 : name === 'password' ? 128 : 200} min={kind === 'number' ? name === 'graduationYear' ? 1940 : 0 : undefined} max={kind === 'number' ? name === 'graduationYear' ? new Date().getFullYear() : 70 : undefined} minLength={name === 'password' ? 15 : undefined} autoComplete={name === 'password' ? 'new-password' : undefined} onChange={e => setForm(f => ({...f,[name]:e.target.value}))} /></div>;
  return <AuthLayout><div className="sh-login-content"><span className="sh-auth-kicker">SABI HEALTH PROFESSIONALS</span><h1>Create your professional account</h1><p>Select your actual discipline. Approval grants only tools within the reviewed scope, not unrestricted patient records or prescribing.</p>
    {error && <p className="sh-form-notice" role="alert">{error}</p>}
    <label className="sh-auth-field">Profession<select aria-label="Profession" value={type} onChange={e => choose(e.target.value)}><option value="">Choose profession</option>{catalog.map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</select></label>
    {!config && !error && <p role="status">Loading professional registration…</p>}
    {config && !config.enabled && <p role="status">Registration is temporarily unavailable. Please try again later.</p>}
    {profession && <form className="sh-register-form" onSubmit={submit}>
      <label className="sh-auth-field">Discipline<select aria-label="Discipline" value={form.discipline} onChange={e => setForm(f => ({...f,discipline:e.target.value,licenceType:undefined,licenceExpiry:undefined}))}>{profession.disciplines.map(d => <option key={d} value={d}>{label(d)}</option>)}</select></label>
      <p>{profession.regulator}. {profession.regulated ? 'Statutory registration applies.' : 'Documents are reviewed against your discipline; platform evidence requirements are not a claim that all roles share a statutory licence.'}</p>
      {field('firstName','First name')}{field('lastName','Last name')}{field('email','Email address','email')}{field('phone','Phone (+234…)','tel')}{field('password','Password (at least 15 characters)','password')}
      {field('qualification','Relevant qualification')}{field('university','Training institution')}{field('graduationYear','Qualification year','number')}{field('yearsOfExperience','Years of experience','number')}{field('specialty','Specialisation')}{field('services','Services you provide')}{field('registrationNumber',licensed ? 'Regulator registration number' : 'Professional registration / membership number (if applicable)','text',licensed)}
      {licensed && <><label className="sh-auth-field">Licence type<select required value={form.licenceType || ''} onChange={e => setForm(f => ({...f,licenceType:e.target.value}))}><option value="">Select</option><option value="annual">Current dated licence</option></select></label>{form.licenceType === 'annual' && field('licenceExpiry','Current licence expiry','date')}</>}
      {field('practiceState','Practice state')}{field('city','City')}{field('hospital','Practice / organisation (optional)','text',false)}
      <p>You will verify your email, sign in and upload the required evidence. Files stay private in Supabase and are sent to Cloudmersive for malware screening; Resend sends account emails. Do not upload patient records. Sabi staff independently review qualifications before services are enabled.</p>
      <label><input type="checkbox" required checked={!!form.declaration} onChange={e => setForm(f => ({...f,declaration:e.target.checked}))} /> I confirm my details and qualifications are accurate.</label>
      <label><input type="checkbox" required checked={!!form.termsAccepted} onChange={e => setForm(f => ({...f,termsAccepted:e.target.checked}))} /> I accept the registration conditions and privacy information, including credential review and screening.</label><div><button type="button" className="sh-inline-link" onClick={()=>setLegal('terms')}>Read registration conditions</button> · <button type="button" className="sh-inline-link" onClick={()=>setLegal('privacy')}>Read privacy information</button></div>
      <button className="sh-primary-button" disabled={busy || !config?.enabled}>{busy ? 'Creating account…' : 'Create account'}</button>
    </form>}<p><Link to="/login">Already registered? Sign in</Link></p>
    {legal&&<LegalNotice kind={legal} profession="PROFESSIONAL" onClose={()=>setLegal(null)}/>}
  </div></AuthLayout>;
}
