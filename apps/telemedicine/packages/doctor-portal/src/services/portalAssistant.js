import { getThreads } from '../store/messageStore.js';
import { getReviews } from '../store/reviewStore.js';
import { getActivity } from '../store/activityStore.js';
import { getQueue } from '../store/hospitalQueueStore.js';
import { getDoctorAppointments } from '../store/doctorAppointmentStore.js';
import { getPrescriptions } from '../store/prescriptionStore.js';
import { getReports } from '../store/reportStore.js';
import { getCurrentDoctor } from '../store/doctorSession.js';
import { readPatientRecord, summarizeRecord } from './patientRecord.js';
export const ASSISTANT_CONFIGURED = !!import.meta.env?.VITE_ASSISTANT_API_BASE_URL;
const localDate = () => { const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function assistantContext(path,scope) {
  const appointments=getDoctorAppointments().filter(a=>a.type!=='blocked');
  const today=localDate();
  const schedule=appointments.filter(a=>!['past','cancelled','declined','needs-response'].includes(a.status)&&a.date>=today).map(a=>({id:a.id,date:a.date,startTime:a.startTime,endTime:a.endTime,type:a.type}));
  const counts={unreadMessages:getThreads().filter(t=>t.unread).length,reviews:getReviews().length,unansweredReviews:getReviews().filter(r=>!r.reply).length,queue:getQueue().length,activity:getActivity().length,appointmentRequests:appointments.filter(a=>a.status==='needs-response').length,prescriptionDrafts:getPrescriptions().filter(r=>r.status==='draft').length,reportDrafts:getReports().filter(r=>r.status==='draft').length};
  return {page:path,doctorName:getCurrentDoctor()?.name,today,schedule,counts};
}
export function localAssistantReply(prompt,context,record=null) {
  if(record) return summarizeRecord(record,prompt);
  if(/patient|medical|hypertension|blood pressure|history|record|asthma|diabet/i.test(prompt)) return 'Open a patient’s record during an accepted consultation and request access. The patient must also allow AI summaries before I can search or summarize their medical history.';
  if(/schedule|calendar|appointment|consultation|today|tomorrow|week/i.test(prompt)) {
    let schedule=context.schedule;
    if(/today/i.test(prompt)) schedule=schedule.filter(a=>a.date===context.today);
    if(/tomorrow/i.test(prompt)){const d=new Date(context.today+'T12:00:00');d.setDate(d.getDate()+1);const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;schedule=schedule.filter(a=>a.date===date);}
    if(/week/i.test(prompt)){const d=new Date(context.today+'T12:00:00');d.setDate(d.getDate()+7);const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;schedule=schedule.filter(a=>a.date<end);}
    schedule.sort((a,b)=>new Date(a.date+' '+a.startTime)-new Date(b.date+' '+b.startTime));
    return `${schedule.length} scheduled consultation${schedule.length===1?'':'s'} in this view.\n\n`+(schedule.length?schedule.slice(0,20).map(a=>`${a.date} · ${a.startTime}–${a.endTime} · ${a.type}\nSource: appointment ${a.id}`).join('\n\n'):'No scheduled consultations found.')+`\n\n${context.counts.appointmentRequests} appointment requests await a response. Open Appointments for details.`;
  }
  if(/draft|prescription|report|pending|overview/i.test(prompt)) return `You have ${context.counts.prescriptionDrafts} prescription drafts and ${context.counts.reportDrafts} report drafts. Review each draft, finalize it, then send it to the patient.\n\n${context.counts.appointmentRequests} appointment requests need a response.\nSource: your current doctor workspace.`;
  if(context.page==='/messages' || /unread|messages/i.test(prompt)) return 'You have '+context.counts.unreadMessages+' unread conversations. Open Messages to review and reply. Message contents are not sent to the assistant.\nSource: your message inbox.';
  if(context.page==='/reviews') return 'You have '+context.counts.reviews+' reviews, including '+context.counts.unansweredReviews+' without a reply. Open each review to respond.\nSource: your reviews.';
  if(context.page==='/hospital-workspace') return 'There are '+context.counts.queue+' patients in your hospital queue. Open Hospital Workspace to see assignments and available actions.\nSource: hospital queue.';
  if(context.page==='/notifications') return 'You have '+context.counts.activity+' recent activity entries and '+context.counts.appointmentRequests+' appointment requests. Review Notifications and Appointments for details.\nSource: your workspace activity.';
  const guides={ '/messages':'Review your conversations and reply to the patient from Messages.', '/availability':'Set your working hours and blocked slots in Availability.', '/hospital-workspace':'Review the shared queue and assign a patient to yourself before consultation.', '/earnings':'This page shows estimated consultation earnings. Confirm settled amounts with your billing service.', '/reviews':'Review feedback shown on this page.', '/notifications':'Review your notifications and follow the relevant appointment or document.', '/profile':'Update your professional profile details here.', '/settings':'Manage your portal preferences here.', '/patients':'Choose a patient and open an accepted consultation to request medical record access.' };
  return (guides[context.page] || 'I can show your schedule, list pending appointment requests, and count prescription or report drafts.')+'\n\nPreview mode supports these guided queries. Connect the assistant service for open-ended AI conversations.';
}
export async function askAssistant(prompt,path,scope,signal) {
  if(!prompt.trim()||prompt.length>2000) throw new Error('Enter a question of up to 2,000 characters.');
  const recordQuestion=/patient|medical|hypertension|blood pressure|history|record|asthma|diabet|breakdown|summary|summarize|record of/i.test(prompt) && scope;
  const record=recordQuestion ? readPatientRecord(scope,true) : null;
  const context=assistantContext(path,scope);
  if(!ASSISTANT_CONFIGURED) return localAssistantReply(prompt,context,record);
  // Clinical data stays local until a server-authorized consent/record endpoint is integrated.
  if(record) return summarizeRecord(record,prompt);
  const response=await fetch(import.meta.env.VITE_ASSISTANT_API_BASE_URL.replace(/\/$/,'')+'/assistant/chat',{method:'POST',credentials:'include',signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,context})});
  if(!response.ok) throw new Error('The assistant is unavailable. Please try again.');
  const data=await response.json();
  if(typeof data.answer!=='string'||!data.answer.trim()) throw new Error('The assistant returned no answer.');
  return data.answer;
}
