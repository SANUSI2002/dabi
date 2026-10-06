import React from 'react';
import {Check} from 'lucide-react';

export const REGISTRATION_STEPS=['Your account','Professional details','Verification','Review & submit'];
export default function RegistrationProgress({step}) {
  return <ol className="sh-register-steps" aria-label="Registration progress">{REGISTRATION_STEPS.map((title,index) => <li key={title} className={index===step ? 'is-current' : index<step ? 'is-complete' : ''} aria-current={index===step ? 'step' : undefined}><span>{index<step ? <Check size={15}/> : index+1}</span><small>{title}</small></li>)}</ol>;
}
