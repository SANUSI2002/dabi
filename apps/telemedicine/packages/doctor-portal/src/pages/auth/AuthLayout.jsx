import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import CareStory from "../../../../shared-portal/CareStory";
import "./AuthPages.css";
import { PORTAL_BASE } from "../../services/runtime";
const patientSignIn = import.meta.env.DEV ? "http://127.0.0.1:5174/login" : `${PORTAL_BASE.replace(/doctor-portal\/$/, "")}login`;

export default function AuthLayout({ children, compact = false }) {
  return <div className={`sh-auth${compact ? " sh-auth-compact" : ""}`}>
    <CareStory audience="professional" />
    <main className="sh-auth-main"><div className="sh-auth-mobile-brand"><HeartPulse size={22} /> Sabi Health</div>{children}<footer className="sh-auth-footer">Sabi Health · Professional Portal · <a href={patientSignIn}>Patient sign-in</a></footer></main>
  </div>;
}
