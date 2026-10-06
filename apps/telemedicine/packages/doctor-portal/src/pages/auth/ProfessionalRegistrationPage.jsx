import React, {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import DoctorRegistrationPage, {LegalNotice} from './DoctorRegistrationPage';
import AuthLayout from './AuthLayout';
import {getRegistrationConfig, registerProfessional} from '../../services/doctorAuth';
import './AuthPages.css';

import RegistrationProgress, {REGISTRATION_STEPS as STEPS} from "./RegistrationProgress";
const label=v => v?.replaceAll('_',' ').toLowerCase().replace(/^./,c => c.toUpperCase());
const freshForm=() => ({country:'NG',consentVersion:'professional-registration-v1'});
const limits={firstName:80,lastName:80,email:254,phone:16,password:128,confirmPassword:128,qualification:100,university:200,specialty:100,services:1000,registrationNumber:100,practiceState:100,city:100,hospital:160};

export default function ProfessionalRegistrationPage() {
  const navigate=useNavigate(), heading=useRef(null), submitting=useRef(false);
  const [catalog,setCatalog]=useState([]), [config,setConfig]=useState(null), [type,setType]=useState('');
  const [form,setForm]=useState(freshForm), [step,setStep]=useState(0), [error,setError]=useState(''), [busy,setBusy]=useState(false), [legal,setLegal]=useState(null);
  useEffect(() => {let active=true; getRegistrationConfig().then(r => {if (!active) return; const c=r.data || r; setConfig(c); setCatalog(c.professions || []);}).catch(e => active && setError(e.message)); return () => {active=false;};},[]);
  const profession=catalog.find(p => p.type===type);
  const licensed=['REGISTERED_NURSE','COMMUNITY_HEALTH_PRACTITIONER'].includes(form.discipline);
  const update=(name,value) => setForm(f => ({...f,[name]:value}));
  function choose(value) {setType(value); setStep(0); setError(''); setForm({...freshForm(),professionType:value,discipline:catalog.find(p => p.type===value)?.disciplines[0]});}
  function go(next) {setStep(next); setError(''); requestAnimationFrame(() => heading.current?.focus());}
  function validate(index) {
    const required=index===0 ? ['firstName','lastName','email','phone','password','confirmPassword'] : index===1 ? ['qualification','university','graduationYear','yearsOfExperience','specialty','services'] : index===2 ? ['practiceState','city',...(licensed ? ['registrationNumber','licenceType','licenceExpiry'] : [])] : [];
    if (required.some(key => !String(form[key] ?? '').trim())) return 'Please complete all required fields in this step.';
    if (index===0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
      if (!/^\+[1-9]\d{7,14}$/.test(form.phone)) return 'Use international phone format, for example +2348012345678, with no spaces.';
      if (form.password.length<15) return 'Use a password with at least 15 characters.';
      if (form.password!==form.confirmPassword) return 'Your passwords do not match.';
    }
    if (index===1) {
      const year=Number(form.graduationYear), experience=Number(form.yearsOfExperience);
      if (!Number.isInteger(year) || year<1940 || year>new Date().getFullYear()) return 'Enter a valid qualification year.';
      if (!Number.isInteger(experience) || experience<0 || experience>70) return 'Experience must be between 0 and 70 years.';
    }
    if (index===2 && licensed && form.licenceExpiry<new Date().toISOString().slice(0,10)) return 'Your licence must be current. Enter its expiry date.';
    if (index===3 && (!form.declaration || !form.termsAccepted)) return 'Please confirm your declaration and accept the registration conditions.';
    return '';
  }
  async function submit(event) {
    event.preventDefault(); if (submitting.current || !config?.enabled) return;
    const issue=validate(step); if (issue) {setError(issue); return;}
    if (step<3) {go(step+1); return;}
    for (let index=0;index<4;index++) {const problem=validate(index); if (problem) {go(index); setError(problem); return;}}
    submitting.current=true; setBusy(true); setError('');
    try {const {confirmPassword,...payload}=form; const data=await registerProfessional(payload); setForm(freshForm()); navigate('/registration/status',{state:data});}
    catch(e) {setError(e.message || 'We could not create your account. Please try again.');}
    finally {submitting.current=false; setBusy(false);}
  }
  if (type==='DOCTOR') return <DoctorRegistrationPage onChooseProfession={() => choose('')}/>;
  const field=(name,title,kind='text',required=true) => <div className="sh-auth-field" key={name}><label htmlFor={'professional-'+name}>{title}{!required && <span> · Optional</span>}</label><input id={'professional-'+name} type={kind} required={required} value={form[name] ?? ''} maxLength={limits[name]} min={kind==='number' ? name==='graduationYear' ? 1940 : 0 : undefined} max={kind==='number' ? name==='graduationYear' ? new Date().getFullYear() : 70 : undefined} autoComplete={name.includes('Password') || name==='password' ? 'new-password' : name==='email' ? 'email' : name==='phone' ? 'tel' : name==='firstName' ? 'given-name' : name==='lastName' ? 'family-name' : undefined} onChange={e => update(name,e.target.value)}/></div>;
  return <AuthLayout><div className="sh-login-content sh-register-content">
    <div className="sh-auth-topline"><span className="sh-auth-kicker">PROFESSIONAL REGISTRATION</span><Link to="/login">Already registered? Sign in</Link></div>
    <h1>Make room for better care.</h1><p>Create your account, tell us about your practice, then complete credential review.</p>
    {!config && !error && <p role="status">Loading professional registration…</p>}
    {config && !config.enabled && <p className="sh-form-notice" role="status">Registration is temporarily unavailable. Please try again later.</p>}
    <div className="sh-profession-picker"><label className="sh-auth-field">Profession<select aria-label="Profession" disabled={busy} value={type} onChange={e => choose(e.target.value)}><option value="">Choose your profession</option>{catalog.map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</select></label>
    {profession && <label className="sh-auth-field">Discipline<select aria-label="Discipline" disabled={busy} value={form.discipline} onChange={e => {setForm(f => ({...f,discipline:e.target.value,registrationNumber:'',licenceType:undefined,licenceExpiry:undefined,termsAccepted:false,declaration:false})); go(0);}}>{profession.disciplines.map(d => <option key={d} value={d}>{label(d)}</option>)}</select></label>}</div>
    {profession && <><RegistrationProgress step={step}/>
    <form className="sh-register-form" onSubmit={submit} noValidate>
      <h2 ref={heading} tabIndex={-1}>{STEPS[step]}</h2><p>Step {step+1} of 4 · {profession.label}</p>
      {error && <p className="sh-form-notice" role="alert">{error}</p>}
      {step===0 && <><div className="sh-auth-grid">{field('firstName','First name')}{field('lastName','Last name')}</div>{field('email','Email address','email')}{field('phone','Phone (+234…)','tel')}{field('password','Password (at least 15 characters)','password')}{field('confirmPassword','Confirm password','password')}<p className="sh-field-help">Choose a long, unique passphrase. Your password is never saved in a browser draft.</p></>}
      {step===1 && <>{field('qualification','Relevant qualification')}{field('university','Training institution')}<div className="sh-auth-grid">{field('graduationYear','Qualification year','number')}{field('yearsOfExperience','Years of experience','number')}</div>{field('specialty','Specialisation')}{field('services','Services you provide')}</>}
      {step===2 && <><p className="sh-form-notice">{profession.regulator}. {profession.regulated ? 'Statutory registration applies to this profession.' : 'Evidence is reviewed against your discipline, not a shared medical licence.'}</p>{field('registrationNumber',licensed ? 'Regulator registration number' : 'Professional registration / membership number','text',licensed)}
      {licensed && <><label className="sh-auth-field">Licence type<select aria-label="Licence type" required value={form.licenceType || ''} onChange={e => update('licenceType',e.target.value)}><option value="">Select licence type</option><option value="annual">Current dated licence</option></select></label>{field('licenceExpiry','Current licence expiry','date')}</>}
      <div className="sh-auth-grid">{field('practiceState','Practice state')}{field('city','City')}</div>{field('hospital','Practice / organisation','text',false)}<p className="sh-field-help">After account creation, verify your email and upload the required credentials. Upload and security screening run in the background; staff review qualifications before practice access is enabled. Do not upload patient records.</p></>}
      {step===3 && <><div className="sh-review-card"><h3>Review your application</h3><dl><dt>Account</dt><dd>{form.firstName} {form.lastName}<br/>{form.email}<br/>{form.phone}</dd><dt>Practice</dt><dd>{label(form.discipline)} · {form.specialty}<br/>{form.qualification}, {form.university} ({form.graduationYear})<br/>{form.yearsOfExperience} years of experience</dd><dt>Location</dt><dd>{form.city}, {form.practiceState}{form.hospital && <><br/>{form.hospital}</>}</dd>{form.registrationNumber && <><dt>Registration</dt><dd>{form.registrationNumber}{licensed && <> · Expires {form.licenceExpiry}</>}</dd></>}</dl><div className="sh-review-actions">{STEPS.slice(0,3).map((title,index) => <button type="button" key={title} onClick={() => go(index)}>Edit {title.toLowerCase()}</button>)}</div></div>
      <label className="sh-checkbox-row"><input type="checkbox" checked={!!form.declaration} onChange={e => update('declaration',e.target.checked)}/><span>I confirm my details and qualifications are accurate.</span></label><label className="sh-checkbox-row"><input type="checkbox" checked={!!form.termsAccepted} onChange={e => update('termsAccepted',e.target.checked)}/><span>I accept the registration conditions and privacy information, including credential review and screening.</span></label><div><button type="button" className="sh-inline-link" onClick={() => setLegal('terms')}>Registration conditions</button> · <button type="button" className="sh-inline-link" onClick={() => setLegal('privacy')}>Privacy information</button></div></>}
      <div className="sh-register-actions">{step>0 && <button type="button" className="sh-secondary-button" disabled={busy} onClick={() => go(step-1)}><ArrowLeft size={16}/> Back</button>}<button type="submit" className="sh-primary-button" disabled={busy || !config?.enabled}>{busy ? 'Creating your account…' : step===3 ? 'Create professional account' : <>Continue <ArrowRight size={16}/></>}</button></div>
    </form></>}
    {!profession && error && <p className="sh-form-notice" role="alert">{error}</p>}
    {legal && <LegalNotice kind={legal} profession="PROFESSIONAL" onClose={() => setLegal(null)}/>}
  </div></AuthLayout>;
}
