import React, { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sparkles, X, Send } from 'lucide-react';
import { useRecordPermission } from './PatientRecord';
import { askAssistant, ASSISTANT_CONFIGURED } from '../services/portalAssistant';
import { canReadRecord } from '../store/recordAccessStore';
import { getDoctorId } from '../store/doctorSession';
import './PortalAssistant.css';
export default function PortalAssistant({scope}) {
  const location=useLocation();
  const {aiAllowed}=useRecordPermission(scope);
  const [open,setOpen]=useState(false),[prompt,setPrompt]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false);
  const controller=useRef(null), input=useRef(null),trigger=useRef(null),log=useRef(null);
  const recordKey=scope ? `${scope.patientId}:${scope.consultationId}` : '';
  useEffect(()=>{controller.current?.abort();setMessages([]);setBusy(false);setPrompt('');return()=>controller.current?.abort();},[location.pathname,recordKey,aiAllowed]);
  useEffect(()=>{if(open) input.current?.focus();},[open]);
  useEffect(()=>{if(log.current) log.current.scrollTop=log.current.scrollHeight;},[messages,busy]);
  function close(){setOpen(false);trigger.current?.focus();}
  async function submit(e,text=prompt){e?.preventDefault();if(busy||!text.trim())return;setPrompt('');const owner=getDoctorId();controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);setMessages(m=>[...m,{role:'doctor',text}]);
    try{const answer=await askAssistant(text,location.pathname,scope,current.signal);if(current.signal.aborted || owner!==getDoctorId())return;if(aiAllowed&&!canReadRecord(scope,true))return;setMessages(m=>[...m,{role:'assistant',text:answer}]);}catch(error){if(!current.signal.aborted)setMessages(m=>[...m,{role:'assistant',text:error.message}]);}finally{if(!current.signal.aborted)setBusy(false);}
  }
  const suggestions=scope ? ['Summarize this patient’s medical record','Is there any record of hypertension?'] : location.pathname==='/dashboard'||location.pathname==='/calendar'||location.pathname==='/appointments'||location.pathname==='/consultations' ? ['What is my schedule today?','What is my schedule this week?'] : ['/prescriptions','/reports'].includes(location.pathname) ? ['How many drafts need review?','What is pending?'] : ['Help me with this page','Give me my workspace overview'];
  return <><button ref={trigger} className="portal-assistant-trigger" aria-expanded={open} aria-controls="portal-assistant" onClick={()=>open?close():setOpen(true)}><Sparkles size={18}/> Ask assistant</button>{open&&<aside id="portal-assistant" className="portal-assistant" aria-label="Portal assistant" onKeyDown={e=>{if(e.key==='Escape')close();}}><header><div><strong>Sabi assistant</strong><small>{ASSISTANT_CONFIGURED?'Connected AI · record extracts stay local':'Guided preview · AI service not connected'}</small></div><button className="dp-icon-btn" aria-label="Close assistant" onClick={close}><X size={18}/></button></header><div className="assistant-context">{scope ? `${scope.patientName} · ${aiAllowed?'AI record permission granted':'AI record access locked'}` : `${location.pathname.slice(1).replaceAll('-',' ')} · your doctor workspace`}</div><div ref={log} className="assistant-log" role="log" aria-live="polite">{!messages.length&&<p>Ask about this page or your schedule. Record answers include source dates and entries.</p>}{messages.map((m,i)=><div key={i} className={'assistant-message '+m.role}><small>{m.role==='doctor'?'You':'Assistant'}</small><p>{m.text}</p></div>)}{busy&&<p role="status">Checking your workspace…</p>}</div>{!messages.length && <div className="assistant-suggestions">{suggestions.map(s=><button key={s} disabled={busy} onClick={()=>submit(null,s)}>{s}</button>)}</div>}<form onSubmit={submit}><label className="assistant-input-label" htmlFor="assistant-prompt">Your question</label><div><textarea ref={input} id="assistant-prompt" value={prompt} maxLength={2000} rows={2} onChange={e=>setPrompt(e.target.value)} placeholder="Ask about your schedule or this page…"/><button type="submit" className="dp-btn dp-btn-primary" aria-label="Send question" disabled={busy||!prompt.trim()}><Send size={16}/></button></div></form><footer>Read-only assistance. Review record extracts before clinical use. <Link to="/consultations">Consultations</Link></footer></aside>}</>;
}
