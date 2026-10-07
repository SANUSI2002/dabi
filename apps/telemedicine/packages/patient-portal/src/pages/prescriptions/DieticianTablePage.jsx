import React,{useEffect,useState} from 'react';
import {ClipboardList,ExternalLink,RefreshCw,ShieldCheck} from 'lucide-react';
import {authorizedRequest} from '../../utils/sabiIdentity';
import {PageShell} from '../hospitals/hospitalShared';
import {MealPlanTable} from '../../../../shared-care/MealPlanTable';
import {EmptyState,LoadingState,Notice,PageHeader,StatusBadge} from '../../../../shared-portal/design-system/ui.jsx';
import '../../styles/share.css';
const request=(path,method='GET',body)=>authorizedRequest(`/api/v1/professional-care${path}`,{method,...(body?{body}:{})}).then(r=>r.data);
const PROGRESS={ON_TRACK:['success','On track'],NEEDS_HELP:['warning','Need help'],NOT_STARTED:['neutral','Not started']};
const dateLabel=(iso)=>iso?new Date(`${iso}T12:00:00`).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'}):'';

/**
 * Plans professionals have published for this patient. /prescriptions/dietician-table shows nutrition
 * plans (Dietician Table); /care-plans shows support plans (My Care Plans). Both include the
 * permissions that let professionals write plans. Drafts are never shown.
 */
export function DieticianTablePage({support=false}){
  const [plans,setPlans]=useState([]),[providers,setProviders]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[feedback,setFeedback]=useState({});
  async function load(){const [p,c]=await Promise.all([request('/patient/plans'),request('/patient/providers')]);setPlans(p);setProviders(c);}
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function action(work){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const shown=plans.filter(p=>p.kind===(support?'SUPPORT':'NUTRITION'));
  return <PageShell mainClassName="sabi-main"><div className="care-workspace sx-page">
    <PageHeader title={support?'My Care Plans':'Dietician Table'} description={support?'Support plans and goals agreed with your professional.':'Your published nutrition plans and meal schedules. These are not medication prescriptions.'}
      actions={<button type="button" className="sx-btn sx-btn-secondary" disabled={busy||loading} onClick={()=>action(load)}><RefreshCw size={16} aria-hidden="true"/> Refresh plans</button>}/>
    {error&&<Notice tone="danger">{error}</Notice>}{notice&&<Notice tone="success">{notice}</Notice>}
    {loading?<LoadingState label="Loading your plans…"/>:<>
      <section className="sx-card" aria-labelledby="perm-heading"><div className="sx-card-header"><div><h2 id="perm-heading" className="sx-card-title"><ShieldCheck size={18} aria-hidden="true" style={{verticalAlign:'-3px',marginRight:6}}/>Care-plan permissions</h2><p className="sx-card-subtitle">After a confirmed appointment, you can allow your professional to create plans and record intake and follow-up notes. This does not share your other medical records. Revoke permission at any time; previously published plans remain available to you.</p></div></div>
        {providers.length?<div className="sx-list">{providers.map(p=><div className="sx-row" key={p.id}><span className="sx-avatar" aria-hidden="true">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div className="sx-row-main"><p className="sx-row-title">{p.name}</p><p className="sx-row-meta">{p.specialty||p.professionType}</p></div><StatusBadge status={p.active?'ACTIVE':'DRAFT'} labels={{ACTIVE:'Permission granted',DRAFT:'Permission not granted'}}/><button type="button" className={`sx-btn sx-btn-sm ${p.active?'sx-btn-danger':'sx-btn-primary'}`} disabled={busy} onClick={()=>action(async()=>{await request(`/patient/consents/${p.id}`,'PUT',{active:!p.active,consentVersion:'professional-care-v1'});setNotice(p.active?'Care-plan access revoked.':'Care-plan access granted.');})}>{p.active?'Revoke permission':'Allow care plans'}</button></div>)}</div>
          :<p className="care-muted">No eligible professional appointments yet.</p>}
      </section>
      {shown.length===0&&<EmptyState icon={ClipboardList} title="No published plans yet">Plans appear here after your authorised professional publishes them. Their draft changes are never shown.</EmptyState>}
      {shown.map(plan=>{const fb=feedback[plan.id]||{};return <article className="sx-card care-plan" key={plan.id} aria-labelledby={`plan-${plan.id}`}>
        <header className="sx-card-header care-plan-head"><div><h2 id={`plan-${plan.id}`} className="sx-card-title">{plan.content.title}</h2><p className="sx-card-subtitle">{plan.professional} · Version {plan.publishedVersion} · {dateLabel(plan.content.startsOn)} – {dateLabel(plan.content.endsOn)}</p></div><StatusBadge status={plan.archivedAt?'ARCHIVED':'PUBLISHED'} labels={{ARCHIVED:'Archived',PUBLISHED:'Published'}}/></header>
        {plan.content.followUpOn&&<Notice tone="info">Next follow-up: <strong style={{display:'inline'}}>{dateLabel(plan.content.followUpOn)}</strong></Notice>}
        <div className="care-plan-body">
          <section><h3>Your goals</h3><p>{plan.content.goals}</p>{plan.content.instructions&&<p>{plan.content.instructions}</p>}{plan.content.activities&&<p>{plan.content.activities}</p>}</section>
          {(plan.content.allergies||plan.content.restrictions||plan.content.preferences||plan.content.budget)&&<section><dl className="sx-facts">
            {plan.content.allergies&&<><dt>Allergies / precautions</dt><dd>{plan.content.allergies}</dd></>}
            {plan.content.restrictions&&<><dt>Restrictions</dt><dd>{plan.content.restrictions}</dd></>}
            {plan.content.preferences&&<><dt>Preferences</dt><dd>{plan.content.preferences}</dd></>}
            {plan.content.budget&&<><dt>Budget</dt><dd>{plan.content.budget}</dd></>}
          </dl></section>}
          {!support&&<section><MealPlanTable meals={plan.content.meals}/></section>}
          {!!plan.content.targets?.length&&<section><ul className="care-targets">{plan.content.targets.map((t,i)=><li key={i}><strong>{t.name}:</strong> {t.value} <a className="sx-link" href={t.source} target="_blank" rel="noreferrer">Reviewed source<ExternalLink size={13} aria-hidden="true"/><span className="sx-sr-only"> (opens in a new tab)</span></a></li>)}</ul></section>}
        </div>
        <details className="care-plan-updates"><summary>Published updates</summary><ul>{plan.versions.map(v=><li key={v.number}>Version {v.number} · {new Date(v.publishedAt).toLocaleString()}</li>)}</ul></details>
        <section className="care-plan-feedback" aria-labelledby={`fb-${plan.id}`}><h3 id={`fb-${plan.id}`}>Your progress and feedback</h3>
          {!!plan.feedback.length&&<ul className="care-feedback-list">{plan.feedback.map(f=>{const [tone,label]=PROGRESS[f.progress]||['neutral',f.progress.replaceAll('_',' ').toLowerCase()];return <li key={f.id}><span className={`sx-badge sx-badge-${tone}`}>{label}</span><span className="sx-hint">v{f.version}</span><p>{f.message}</p></li>;})}</ul>}
          {!plan.archivedAt&&<form className="care-feedback-form" onSubmit={e=>{e.preventDefault();action(async()=>{await request(`/patient/plans/${plan.id}/feedback`,'POST',{version:plan.publishedVersion,message:fb.message||'',progress:fb.progress||'ON_TRACK'});setFeedback(f=>({...f,[plan.id]:{}}));setNotice('Your feedback was sent to your professional.');});}}>
            <div className="sx-field"><label htmlFor={`fb-progress-${plan.id}`}>How is your plan going?</label><select id={`fb-progress-${plan.id}`} className="sx-select" value={fb.progress||'ON_TRACK'} onChange={e=>setFeedback(f=>({...f,[plan.id]:{...f[plan.id],progress:e.target.value}}))}>{Object.entries(PROGRESS).map(([value,[,label]])=><option key={value} value={value}>{label}</option>)}</select></div>
            <div className="sx-field"><label htmlFor={`fb-msg-${plan.id}`}>Progress / questions</label><textarea id={`fb-msg-${plan.id}`} className="sx-textarea" required minLength={2} maxLength={2000} value={fb.message||''} onChange={e=>setFeedback(f=>({...f,[plan.id]:{...f[plan.id],message:e.target.value}}))}/></div>
            <div className="sx-actions"><button className="sx-btn sx-btn-primary" disabled={busy}>Send feedback</button></div>
          </form>}
        </section>
      </article>;})}
    </>}
  </div></PageShell>;
}
