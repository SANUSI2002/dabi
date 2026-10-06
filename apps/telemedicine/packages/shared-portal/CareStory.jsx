import React from 'react';
import {HeartPulse, ShieldCheck} from 'lucide-react';
import artwork from './assets/care-conversation-v1.png';

/** Decorative commissioned artwork, never a real clinician or patient record. */
export default function CareStory({audience='patient',className=''}) {
  const professional=audience==='professional';
  return <aside className={`sabi-care-story ${className}`}>
    <picture><source media="(min-width:901px)" srcSet={artwork}/><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E" alt="" className="sabi-care-story-image" decoding="async" width="1024" height="1536"/></picture>
    <div className="sabi-care-story-shade" aria-hidden="true"/>
    <div className="sabi-care-story-brand"><HeartPulse size={25}/><span>Sabi Health<small>{professional?'FOR HEALTHCARE PROFESSIONALS':'YOUR PERSONAL CARE SPACE'}</small></span></div>
    <div className="sabi-care-story-copy"><span className="sabi-care-eyebrow">{professional?'YOUR PRACTICE, CONNECTED':'CARE, CLOSER TO YOU'}</span><h2>{professional?<>More time for<br/>what matters.</>:<>Your health.<br/>A little more human.</>}</h2><p>{professional?'A thoughtful workspace for appointments, patient care and the discipline you practise.':'Connect with healthcare professionals, manage your appointments and keep your care in one place.'}</p></div>
    <div className="sabi-care-story-caption"><ShieldCheck size={19}/><span>{professional?'Credentials reviewed. Professional scope respected.':'Your account. Your choices. Your care.'}</span></div>
  </aside>;
}
