import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import "./AuthPages.css";
import { PORTAL_BASE } from "../../services/runtime";
const patientSignIn = import.meta.env.DEV ? "http://127.0.0.1:5174/login" : `${PORTAL_BASE.replace(/doctor-portal\/$/, "")}login`;

export default function AuthLayout({ children, compact = false }) {
  return <div className={`sh-auth${compact ? " sh-auth-compact" : ""}`}>
    <aside className="sh-auth-story">
      <Link className="sh-auth-brand" to="/register"><span><HeartPulse size={25} /></span><div>Sabi Health<small>FOR HEALTHCARE PROFESSIONALS</small></div></Link>
      <div className="sh-auth-story-content"><span className="sh-auth-eyebrow"><Stethoscope size={15} /> YOUR PRACTICE, CONNECTED</span><h1>More time for<br />the care that matters.</h1><p>A dedicated workspace for your appointments, consultations and patient care.</p>
        <div className="sh-auth-benefits">{["Manage virtual and in-person visits", "Use care tools for your reviewed discipline", "Support patient goals and follow-up reviews"].map((text) => <div key={text}><span><Check size={15} /></span>{text}</div>)}</div>
        <div className="sh-auth-trust"><ShieldCheck size={25} /><div><strong>Built around verified practitioners</strong><p>Professional credentials are reviewed before practice access is approved.</p></div></div>
      </div>
      <div className="sh-auth-story-footer"><span>Care with confidence.</span><a href="https://www.mdcn.gov.ng/page/about-us/mdcn-act-other-regulation" target="_blank" rel="noreferrer">Doctor-only MDCN guidance <ArrowUpRight size={14} /></a></div>
    </aside>
    <main className="sh-auth-main"><div className="sh-auth-mobile-brand"><HeartPulse size={22} /> Sabi Health</div>{children}<footer className="sh-auth-footer">Sabi Health · Professional Portal · <a href={patientSignIn}>Patient sign-in</a></footer></main>
  </div>;
}
