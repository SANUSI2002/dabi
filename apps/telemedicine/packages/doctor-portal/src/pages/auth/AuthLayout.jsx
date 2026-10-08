import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import CareStory from "../../../../shared-portal/CareStory";
import "./AuthPages.css";
import { PATIENT_SIGN_IN_URL } from "../../services/runtime";

export default function AuthLayout({ children, compact = false }) {
  return <div className={`sh-auth${compact ? " sh-auth-compact" : ""}`}>
    <CareStory audience="professional" />
    <main className="sh-auth-main"><div className="sh-auth-mobile-brand"><HeartPulse size={22} /> Sabi Health</div>{children}<footer className="sh-auth-footer">Sabi Health · Professional Portal · <a href={PATIENT_SIGN_IN_URL}>Patient sign-in</a></footer></main>
  </div>;
}
