import React,{useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {authorizedRequest} from '../../utils/sabiIdentity';
import {PageShell} from '../hospitals/hospitalShared';
import {CATEGORIES} from './wellnessStore';
import '../../../../shared-care/care.css';
import '../../styles/share.css';
const request=(path,method='GET',body)=>authorizedRequest(`/api/v1${path}`,{method,...(body?{body}:{})}).then(r=>r.data);
const category={caregiver:['CAREGIVER'],nutritionist:['NUTRITIONIST_DIETITIAN'],fitness_coach:['FITNESS_COACH'],therapist:['PSYCHOLOGIST','COUNSELLOR'],health_educator:['HEALTH_EDUCATOR']};
export default function ProfessionalBookingPage(){
  const {id}=useParams();
  const [providers,setProviders]=useState([]),[slots,setSlots]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[filter,setFilter]=useState(''),[selected,setSelected]=useState(''),[mode,setMode]=useState('VIRTUAL'),[reason,setReason]=useState('');
  async function load(){const p=await request('/professional-care/directory');setProviders(p);if(id){const data=await request(`/doctor-appointments/doctors/${id}/slots`);setSlots(data.items);}}
  useEffect(()=>{setLoading(true);setError('');setSelected('');load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
  const professional=providers.find(p=>p.id===id);
  return <PageShell mainClassName="sabi-main"><div className="care-workspace"><h1>{professional?`Book ${professional.name}`:'Healthcare professionals'}</h1><p>Choose an approved professional and an actual published appointment slot. Psychologists and counsellors have separate disciplines.</p>{error&&<p className="care-alert care-error" role="alert">{error}</p>}{notice&&<p className="care-alert" role="status">{notice}</p>}{loading?<p role="status">Loading available professionals…</p>:id?<>
    <Link to="/wellness-hub/professionals">← All professionals</Link>{professional&&<section className="care-card"><h2>{professional.name}</h2><p>{professional.discipline?.replaceAll('_',' ')} · {professional.specialty}</p><p>{professional.bio}</p><p>Consultation fee: {professional.consultationFeeMinor==null?'Not set':new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(professional.consultationFeeMinor/100)}. Requesting an appointment here does not charge a payment.</p></section>}
    <form className="care-card care-grid" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{await request('/doctor-appointments','POST',{slotId:selected,consultationType:mode,reason});setNotice('Appointment requested successfully. The professional will confirm it. View it in My Appointments.');setSelected('');await load();}catch(e){setError(e.message);await load().catch(()=>{});}finally{setBusy(false);}}}>
      <label>Available time (Africa/Lagos)<select required value={selected} onChange={e=>{setSelected(e.target.value);setMode(slots.find(s=>s.id===e.target.value)?.consultationTypes[0]||'VIRTUAL');}}><option value="">Choose a published slot</option>{slots.map(s=><option key={s.id} value={s.id}>{new Date(s.startsAt).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})} – {new Date(s.endsAt).toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'})}</option>)}</select></label>
      <label>Consultation type<select value={mode} onChange={e=>setMode(e.target.value)}>{(slots.find(s=>s.id===selected)?.consultationTypes||['VIRTUAL']).map(t=><option key={t} value={t}>{t==='VIRTUAL'?'Virtual':'In person'}</option>)}</select></label><label>Reason / request<textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy||!selected}>{busy?'Requesting…':'Request appointment'}</button>{!slots.length&&<p>No published slots in the next 14 days. This provider must publish their schedule first.</p>}
    </form><Link to="/appointments">My Appointments</Link>
    </>:<><label>Category<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All professions</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>{providers.filter(p=>!filter||category[filter].includes(p.professionType)).map(p=><section key={p.id} className="care-card"><h2>{p.name}</h2><p>{p.discipline?.replaceAll('_',' ')} · {p.specialty}</p><p>{p.bio}</p><Link to={`/wellness-hub/professionals/${p.id}`}>See availability and book</Link></section>)}{!providers.length&&<section className="care-card"><p>No approved professionals yet. Applications must complete credential review before appearing here.</p></section>}</>}
  </div></PageShell>;
}
