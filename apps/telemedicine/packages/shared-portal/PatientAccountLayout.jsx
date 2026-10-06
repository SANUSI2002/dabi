import React from 'react';
import CareStory from './CareStory';
import {HeartPulse} from 'lucide-react';

export default function PatientAccountLayout({children}) {
  return <div className="sabi-account-layout"><CareStory/><main className="sabi-account-content"><div className="sabi-signup-mobile-brand"><HeartPulse size={22}/> Sabi Health</div>{children}</main></div>;
}
