import React,{useEffect,useRef,useState} from 'react';
import {ClipboardList,Lock,Plus,RefreshCw} from 'lucide-react';
import {doctorRequest} from '../services/doctorAuth';
import {MealPlanTable} from '../../../shared-care/MealPlanTable';
import {EmptyState,ErrorState,LoadingState,Notice,PageHeader,StatusBadge} from '../../../shared-portal/design-system/ui.jsx';
const ROOT='/professional-care';
const request=(path,method='GET',body)=>doctorRequest(`${ROOT}${path}`,{method,...(body?{body:JSON.stringify(body)}:{})}).then(r=>r.data);
const blank=()=>({title:'',startsOn:new Date().toISOString().slice(0,10),endsOn:new Date().toISOString().slice(0,10),goals:'',preferences:'',allergies:'',restrictions:'',history:'',budget:'',instructions:'',activities:'',followUpOn:null,meals:[],targets:[]});
const TITLES={PSYCHOLOGIST:'Psychology care workspace',COUNSELLOR:'Counselling workspace',CAREGIVER:'Caregiver support plans',FITNESS_COACH:'Fitness plans',HEALTH_EDUCATOR:'Health education plans',NUTRITIONIST_DIETITIAN:'Nutrition support plans'};
const LONG=new Set(['history','activities','instructions']);
const planStatus=(plan)=>plan.archivedAt?'ARCHIVED':plan.publishedVersion?'PUBLISHED':'DRAFT';
export default function ProfessionalCareWorkspace(){
  const [workspace,setWorkspace]=useState(null),[selected,setSelected]=useState(null),[content,setContent]=useState(null),[patientId,setPatientId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[note,setNote]=useState(''),[followUp,setFollowUp]=useState(''),[templateName,setTemplateName]=useState('');
  const nutrition=workspace?.kind==='NUTRITION';
  const actionLock=useRef(false);
  const editorRef=useRef(null);
  async function load(){setWorkspace(await request('/workspace'));}
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function action(work){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError('');setNotice('');try{await work();await load();}catch(e){setError(e.message);}finally{actionLock.current=false;setBusy(false);}}
  async function open(id){const plan=await request(`/plans/${id}`);setSelected(plan);setContent(plan.draft);setPatientId(plan.patientId);setNote('');setFollowUp('');}
  // Bring the editor into view when a plan is opened or started, so the next step is obvious.
  useEffect(()=>{if(content)editorRef.current?.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[selected?.id,!!content]); // eslint-disable-line react-hooks/exhaustive-deps
  const update=(key,value)=>setContent(c=>({...c,[key]:value}));
  const field=(key,label,type='textarea',hint)=><div className="sx-field" key={key}><label htmlFor={`care-${key}`}>{label}</label>{type==='textarea'
    ?<textarea id={`care-${key}`} className="sx-textarea" value={content[key]} maxLength={LONG.has(key)?4000:key==='budget'?300:2000} onChange={e=>update(key,e.target.value)}/>
    :<input id={`care-${key}`} className="sx-input" type={type} value={content[key]||''} required={key!=='followUpOn'} onChange={e=>update(key,e.target.value||null)}/>}{hint&&<span className="sx-hint">{hint}</span>}</div>;
  const patientName=(id)=>workspace?.patients.find(p=>p.id===id)?.name;
  const title=nutrition?'Dietician Table':TITLES[workspace?.professionType]||'Care workspace';
  return <div className="dl-page sx-page care-workspace">
    <PageHeader eyebrow="Patients & care" title={title} description={nutrition?'Nutrition assessments, meal schedules and follow-up reviews. Meal plans are separate from medication prescriptions.':'Intake, goals, supportive activities and private session notes within your reviewed discipline.'}
      actions={<><button type="button" className="sx-btn sx-btn-primary" disabled={busy||!workspace?.patients.length} onClick={()=>{setSelected(null);setContent(blank());setPatientId('');setNotice('');}}><Plus size={16} aria-hidden="true"/> New {nutrition?'nutrition':'support'} plan</button><button type="button" className="sx-btn sx-btn-secondary" disabled={busy} onClick={()=>action(load)}><RefreshCw size={16} aria-hidden="true"/> Refresh</button></>}/>
    {error&&<Notice tone="danger">{error}</Notice>}{notice&&<Notice tone="success">{notice}</Notice>}
    {!workspace?(error?<ErrorState title="We couldn't load your care workspace" message={error} onRetry={()=>action(load)}/>:<LoadingState label="Loading your authorised care workspace…"/>):<>
      {!workspace.patients.length&&<Notice tone="info" title="No patients have given permission yet">A patient first needs a confirmed appointment with you, then grants care-plan permission from their Care &amp; meal plans screen. This never grants access to their general medical records.</Notice>}
      <section className="sx-card" aria-labelledby="plans-heading">
        <div className="sx-card-header"><div><h2 id="plans-heading" className="sx-card-title">Your plans</h2><p className="sx-card-subtitle">{workspace.patients.length} {workspace.patients.length===1?'patient has':'patients have'} given care-plan permission</p></div></div>
        {!workspace.plans.length?<EmptyState icon={ClipboardList} title="No plans yet">{workspace.patients.length?'Start a plan for a patient who has given permission.':'Plans appear here once a patient gives permission and you create one.'}</EmptyState>
          :<div className="care-plan-list">{workspace.plans.map(plan=><button type="button" className={`sx-row${selected?.id===plan.id?' is-selected':''}`} aria-current={selected?.id===plan.id||undefined} disabled={busy} key={plan.id} onClick={()=>action(()=>open(plan.id))}>
            <div className="sx-row-main"><p className="sx-row-title">{plan.title}</p><p className="sx-row-meta">{patientName(plan.patientId)||'Patient'}{plan.publishedVersion?` · published v${plan.publishedVersion}`:''} · draft revision {plan.revision}</p></div>
            <StatusBadge status={planStatus(plan)}/></button>)}</div>}
      </section>
      {content&&<section className="sx-card care-editor" ref={editorRef} aria-labelledby="editor-heading">
        <div className="sx-card-header"><div><h2 id="editor-heading" className="sx-card-title">{selected?'Review and revise plan':'New plan'}</h2><p className="sx-card-subtitle">Edits stay private until you publish a new version. Earlier published versions are kept.</p></div>{selected&&<StatusBadge status={planStatus(selected)}/>}</div>
        {selected?.archivedAt&&<Notice tone="info">This plan is archived. The patient keeps their published copy, marked archived.</Notice>}
        <fieldset disabled={busy||!!selected?.archivedAt} className="care-fieldset">
          <div className="care-section"><h3>Plan details</h3><div className="care-fields care-fields-3">
            <div className="sx-field"><label htmlFor="care-patient">Authorised patient</label><select id="care-patient" className="sx-select" required disabled={!!selected} value={patientId} onChange={e=>setPatientId(e.target.value)}><option value="">Select patient</option>{workspace.patients.map(p=><option key={p.id} value={p.id}>{p.name} · {p.reference}</option>)}</select></div>
            <div className="sx-field"><label htmlFor="care-template">Reusable template</label><select id="care-template" className="sx-select" value="" onChange={e=>{const t=workspace.templates.find(t=>t.id===e.target.value);if(t)setContent({...t.content,title:content.title||t.name,startsOn:content.startsOn,endsOn:content.endsOn,history:'',allergies:'',preferences:'',restrictions:'',budget:''});}}><option value="">{workspace.templates.length?'Apply a template (review for this patient)':'No templates saved yet'}</option>{workspace.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><span className="sx-hint">Review every field for this patient afterwards.</span></div>
            {field('title','Plan name','text')}{field('startsOn','Plan starts','date')}{field('endsOn','Plan ends','date')}{field('followUpOn','Next follow-up','date')}
          </div></div>
          <div className="care-section"><h3><Lock size={15} aria-hidden="true"/> Private assessment</h3><div className="care-fields">{field('history','Relevant intake / history (not shown to patient)','textarea','Never shown to the patient.')}</div></div>
          <div className="care-section"><h3>What the patient sees</h3><div className="care-fields">
            {field('goals','Patient goals')}{field('instructions','Patient instructions')}{field('preferences',nutrition?'Food preferences':'Patient preferences')}{field('allergies','Allergies / relevant precautions')}{field('restrictions','Restrictions / safety considerations')}{field('budget','Budget considerations')}{!nutrition&&field('activities','Activities / care goals and agreed next steps')}
          </div></div>
          {nutrition&&<div className="care-section"><h3>Meal schedule</h3><MealPlanTable meals={content.meals} onChange={meals=>update('meals',meals)}/></div>}
          {nutrition&&<div className="care-section"><h3>Nutritional targets</h3><p className="care-muted">Add only reviewed, individual targets with a reliable source. Nothing is calculated automatically, and food quantities are not nutrient values.</p>
            {content.targets.map((target,i)=><div className="care-fields care-fields-3 care-target" key={i}>
              <div className="sx-field"><label htmlFor={`target-name-${i}`}>Target</label><input id={`target-name-${i}`} className="sx-input" value={target.name} maxLength={100} onChange={e=>update('targets',content.targets.map((t,n)=>n===i?{...t,name:e.target.value}:t))}/></div>
              <div className="sx-field"><label htmlFor={`target-value-${i}`}>Value and unit</label><input id={`target-value-${i}`} className="sx-input" value={target.value} maxLength={100} onChange={e=>update('targets',content.targets.map((t,n)=>n===i?{...t,value:e.target.value}:t))}/></div>
              <div className="sx-field"><label htmlFor={`target-source-${i}`}>Source (HTTPS URL)</label><input id={`target-source-${i}`} className="sx-input" type="url" value={target.source} onChange={e=>update('targets',content.targets.map((t,n)=>n===i?{...t,source:e.target.value}:t))}/></div>
              <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={()=>update('targets',content.targets.filter((_,n)=>n!==i))}>Remove target</button></div>)}
            <button type="button" className="sx-btn sx-btn-secondary" disabled={content.targets.length>=20} onClick={()=>update('targets',[...content.targets,{name:'',value:'',source:''}])}><Plus size={15} aria-hidden="true"/> Add sourced target</button></div>}
          <div className="care-actionbar">
            <button type="button" className="sx-btn sx-btn-primary" aria-busy={busy} onClick={()=>action(async()=>{if(!patientId)throw new Error('Select a patient.');const saved=await request(selected?`/plans/${selected.id}`:'/plans',selected?'PUT':'POST',{...(selected?{revision:selected.revision}:{patientId}),content});await open(saved.id);setNotice('Draft saved. The patient still sees only the last published version.');})}>Save draft</button>
            {selected&&<><button type="button" className="sx-btn sx-btn-secondary" onClick={()=>action(async()=>{if(JSON.stringify(content)!==JSON.stringify(selected.draft))throw new Error('Save your draft changes before publishing.');await request(`/plans/${selected.id}/publish`,'POST',{revision:selected.revision});await open(selected.id);setNotice('Plan published. The patient has been notified.');})}>Publish version</button>
              <button type="button" className="sx-btn sx-btn-danger" onClick={()=>action(async()=>{if(!window.confirm('Archive this plan? The patient will retain their published copy, marked archived.'))return;await request(`/plans/${selected.id}/archive`,'POST',{revision:selected.revision});await open(selected.id);setNotice('Plan archived.');})}>Archive</button></>}
          </div>
          <details className="care-template" open><summary>Reusable template</summary><div className="care-fields care-fields-inline"><div className="sx-field"><label htmlFor="care-template-name">Template name</label><input id="care-template-name" className="sx-input" value={templateName} maxLength={160} onChange={e=>setTemplateName(e.target.value)}/></div><button type="button" className="sx-btn sx-btn-secondary" onClick={()=>action(async()=>{await request('/templates','POST',{name:templateName,content:{...content,history:'',allergies:'',preferences:'',restrictions:'',budget:''}});setTemplateName('');setNotice('Template saved. Personal intake fields were excluded; review the remaining text before reusing.');})}>Save reusable template</button></div><p className="care-muted">Personal intake fields (history, allergies, preferences, restrictions, budget) are left out.</p></details>
        </fieldset>
      </section>}
      {content&&selected&&<div className="sx-grid sx-grid-2 care-history">
        <section className="sx-card" aria-labelledby="versions-heading"><h2 id="versions-heading" className="sx-card-title">Published version history</h2>{selected.versions?.length?selected.versions.map(v=><details key={v.id}><summary>Version {v.number} · {new Date(v.publishedAt).toLocaleString()}</summary><p>{v.content.goals}</p><p>{v.content.instructions}</p>{nutrition&&<MealPlanTable meals={v.content.meals}/>}</details>):<p className="care-muted">No published versions.</p>}
          <h3 className="care-subheading">Patient feedback / progress</h3>{selected.feedback?.length?selected.feedback.map(f=><div className="care-feedback" key={f.id}><StatusBadge status={f.progress} /><span className="sx-hint">v{f.version} · {new Date(f.createdAt).toLocaleString()}</span><p>{f.message}</p></div>):<p className="care-muted">No patient feedback yet.</p>}</section>
        <section className="sx-card" aria-labelledby="notes-heading"><h2 id="notes-heading" className="sx-card-title">Private session notes and follow-up</h2><p className="care-muted">Append-only and visible only to you — never to the patient. Record corrections as a new note.</p>
          {selected.notes?.map(n=><div className="care-note" key={n.id}><span className="sx-hint">{new Date(n.createdAt).toLocaleString()}</span><p>{n.text}</p>{n.followUpAt&&<span className="sx-badge sx-badge-info">Follow-up {new Date(n.followUpAt).toLocaleString()}</span>}</div>)}
          {!selected.archivedAt&&<div className="care-fields"><div className="sx-field"><label htmlFor="care-note">Session / follow-up review</label><textarea id="care-note" className="sx-textarea" maxLength={10000} value={note} onChange={e=>setNote(e.target.value)}/></div><div className="sx-field"><label htmlFor="care-followup">Follow-up date/time</label><input id="care-followup" className="sx-input" type="datetime-local" value={followUp} onChange={e=>setFollowUp(e.target.value)}/></div><button type="button" disabled={busy||note.trim().length<2} className="sx-btn sx-btn-primary" onClick={()=>action(async()=>{await request(`/plans/${selected.id}/notes`,'POST',{text:note,...(followUp?{followUpAt:new Date(followUp).toISOString()}:{})});await open(selected.id);setNotice('Private review note saved.');})}>Save private note</button></div>}</section>
      </div>}
    </>}
  </div>;
}
