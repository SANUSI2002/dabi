import React from 'react';
import {Link} from 'react-router-dom';
import {User, Stethoscope, HeartHandshake, Building2, ArrowUpRight} from 'lucide-react';
import PatientAccountLayout from '../../../../shared-portal/PatientAccountLayout';
import {HOSPITAL_ONBOARDING_URL, DOCTOR_PORTAL_URL} from '../../ecosystemLinks';

const choices=[
  {title:'Patient',description:'Find care, manage appointments and keep your health in view.',to:'/signup/patient',icon:User},
  {title:'Healthcare professional',description:'Choose your discipline and complete the shared professional registration.',href:DOCTOR_PORTAL_URL+'/register',icon:Stethoscope},
  {title:'Personal caregiver',description:'Support someone you care for through the family-care onboarding.',to:'/signup/caregiver',icon:HeartHandshake},
  {title:'Healthcare organisation',description:'Register a hospital through Sabi’s shared organisation onboarding.',href:HOSPITAL_ONBOARDING_URL,icon:Building2},
];
export default function AccountTypeSelection() {
  return <PatientAccountLayout><section className="sabi-account-selector">
    <span className="sabi-care-eyebrow">WELCOME TO SABI HEALTH</span><h1>Care that fits your world.</h1><p>Choose how you’ll use Sabi. Professional qualifications are reviewed before practice access is enabled.</p>
    <div className="sabi-account-choices">{choices.map(({title,description,to,href,icon:Icon}) => {
      const content=<><span className="sabi-account-choice-icon"><Icon size={22}/></span><span><strong>{title}</strong>{' '}<small>{description}</small></span><ArrowUpRight size={18}/></>;
      return to ? <Link key={title} to={to}>{content}</Link> : <a key={title} href={href}>{content}</a>;
    })}</div>
    <p className="sabi-account-signin">Already registered? <Link to="/login">Sign in</Link></p>
  </section></PatientAccountLayout>;
}
