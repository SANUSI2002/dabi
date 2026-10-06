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
 * Care & meal plans: every plan a professional has published for this patient (nutrition plans with
 * their meal schedule, and support plans), plus the permissions that let professionals write them.
 * Served at /care-plans and /prescriptions/dietician-table. Drafts are never shown here.
 */
export function DieticianTablePage(){
  const [plans,setPlans]=useState([]),[providers,setProviders]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[feedback,setFeedback]=useState({});
  async function load(){const [p,c]=await Promise.all([request('/patient/plans'),request('/patient/providers')]);setPlans(p);setProviders(c);}
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function action(work){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const ordered=[...plans].sort((a,b)=>Boolean(a.archivedAt)-Boolean(b.archivedAt));
  return <PageShell mainClassName="sabi-main"><div className="care-workspace sx-page">
    <PageHeader title="Care & meal plans" description="Plans your professionals have published for you — meal schedules, goals and next steps. These are not medication prescriptions."
      actions={<button type="button" className="sx-btn sx-btn-secondary" disabled={busy||loading} onClick={()=>action(load)}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>}/>
    {error&&<Notice tone="danger">{error}</Notice>}{notice&&<Notice tone="success">{notice}</Notice>}
    {loading?<LoadingState label="Loading your plans…"/>:<>
      {ordered.length===0&&<EmptyState icon={ClipboardList} title="No published plans yet">Plans appear here once a professional you've given permission to publishes one. Their unpublished drafts are never shown.</EmptyState>}
      {ordered.map(plan=>{const fb=feedback[plan.id]||{};return <article className="sx-card care-plan" key={plan.id} aria-labelledby={`plan-${plan.id}`}>
        <header className="sx-card-header care-plan-head"><div><span className="sx-eyebrow">{plan.kind==='NUTRITION'?'Meal plan':'Support plan'}</span><h2 id={`plan-${plan.id}`} className="sx-card-title">{plan.content.title}</h2><p className="sx-card-subtitle">From {plan.professional} · version {plan.publishedVersion} · {dateLabel(plan.content.startsOn)} – {dateLabel(plan.content.endsOn)}</p></div><StatusBadge status={plan.archivedAt?'ARCHIVED':'PUBLISHED'} labels={{PUBLISHED:'Current plan'}}/></header>
        {plan.content.followUpOn&&<Notice tone="info">Next follow-up: <strong style={{display:'inline'}}>{dateLabel(plan.content.followUpOn)}</strong></Notice>}
        <div className="care-plan-body">
          <section><h3>Your goals</h3><p>{plan.content.goals}</p></section>
          {plan.content.instructions&&<section><h3>What to do</h3><p>{plan.content.instructions}</p></section>}
          {plan.content.activities&&<section><h3>Activities and next steps</h3><p>{plan.content.activities}</p></section>}
          {(plan.content.allergies||plan.content.restrictions||plan.content.preferences||plan.content.budget)&&<section><h3>Keep in mind</h3><dl className="sx-facts">
            {plan.content.allergies&&<><dt>Allergies and precautions</dt><dd>{plan.content.allergies}</dd></>}
            {plan.content.restrictions&&<><dt>Restrictions</dt><dd>{plan.content.restrictions}</dd></>}
            {plan.content.preferences&&<><dt>Preferences</dt><dd>{plan.content.preferences}</dd></>}
            {plan.content.budget&&<><dt>Budget</dt><dd>{plan.content.budget}</dd></>}
          </dl></section>}
          {plan.kind==='NUTRITION'&&<section><h3>Your meal schedule</h3><MealPlanTable meals={plan.content.meals}/></section>}
          {!!plan.content.targets?.length&&<section><h3>Targets</h3><ul className="care-targets">{plan.content.targets.map((t,i)=><li key={i}><strong>{t.name}</strong> {t.value} <a className="sx-link" href={t.source} target="_blank" rel="noreferrer">Source<ExternalLink size={13} aria-hidden="true"/><span className="sx-sr-only"> (opens in a new tab)</span></a></li>)}</ul></section>}
        </div>
        <details className="care-plan-updates"><summary>Published updates ({plan.versions.length})</summary><ul>{plan.versions.map(v=><li key={v.number}>Version {v.number} · {new Date(v.publishedAt).toLocaleString()}</li>)}</ul></details>
        <section className="care-plan-feedback" aria-labelledby={`fb-${plan.id}`}><h3 id={`fb-${plan.id}`}>Your progress</h3>
          {plan.feedback.length?<ul className="care-feedback-list">{plan.feedback.map(f=>{const [tone,label]=PROGRESS[f.progress]||['neutral',f.progress.replaceAll('_',' ').toLowerCase()];return <li key={f.id}><span className={`sx-badge sx-badge-${tone}`}>{label}</span><span className="sx-hint">v{f.version}</span><p>{f.message}</p></li>;})}</ul>:<p className="care-muted">You haven't sent an update yet.</p>}
          {!plan.archivedAt&&<form className="care-feedback-form" onSubmit={e=>{e.preventDefault();action(async()=>{await request(`/patient/plans/${plan.id}/feedback`,'POST',{version:plan.publishedVersion,message:fb.message||'',progress:fb.progress||'ON_TRACK'});setFeedback(f=>({...f,[plan.id]:{}}));setNotice('Your update was sent to your professional.');});}}>
            <fieldset className="care-progress-choice"><legend className="sx-label">How is your plan going?</legend><div className="sx-chips">{Object.entries(PROGRESS).map(([value,[,label]])=><button type="button" key={value} className="sx-chip" aria-pressed={(fb.progress||'ON_TRACK')===value} onClick={()=>setFeedback(f=>({...f,[plan.id]:{...f[plan.id],progress:value}}))}>{label}</button>)}</div></fieldset>
            <div className="sx-field"><label htmlFor={`fb-msg-${plan.id}`}>Progress or questions</label><textarea id={`fb-msg-${plan.id}`} className="sx-textarea" required minLength={2} maxLength={2000} value={fb.message||''} onChange={e=>setFeedback(f=>({...f,[plan.id]:{...f[plan.id],message:e.target.value}}))}/></div>
            <div className="sx-actions"><button className="sx-btn sx-btn-primary" disabled={busy}>Send update</button></div>
          </form>}
        </section>
      </article>;})}
      <section className="sx-card" aria-labelledby="perm-heading"><div className="sx-card-header"><div><h2 id="perm-heading" className="sx-card-title"><ShieldCheck size={18} aria-hidden="true" style={{verticalAlign:'-3px',marginRight:6}}/>Who can write plans for you</h2><p className="sx-card-subtitle">After a confirmed appointment you can let a professional create plans and keep intake and follow-up notes. It never shares your other medical records, and you can revoke it at any time — published plans stay available to you.</p></div></div>
        {providers.length?<div className="sx-list">{providers.map(p=><div className="sx-row" key={p.id}><span className="sx-avatar" aria-hidden="true">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div className="sx-row-main"><p className="sx-row-title">{p.name}</p><p className="sx-row-meta">{p.specialty||p.professionType}</p></div><StatusBadge status={p.active?'ACTIVE':'DRAFT'} labels={{ACTIVE:'Permission granted',DRAFT:'Not granted'}}/><button type="button" className={`sx-btn sx-btn-sm ${p.active?'sx-btn-danger':'sx-btn-primary'}`} disabled={busy} onClick={()=>action(async()=>{await request(`/patient/consents/${p.id}`,'PUT',{active:!p.active,consentVersion:'professional-care-v1'});setNotice(p.active?'Care-plan access revoked.':'Care-plan access granted.');})}>{p.active?'Revoke':'Allow'}</button></div>)}</div>
          :<EmptyState title="No professionals to approve yet">Book and complete a consultation with a dietitian or other wellness professional first.</EmptyState>}
      </section>
    </>}
  </div></PageShell>;
}
