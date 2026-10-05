import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { selectDemoDoctor, PRIMARY_DOCTOR_ID } from "../../store/doctorSession";
export default function PortalPreviewPage() {
  const navigate = useNavigate();
  return <AuthLayout compact><div className="sh-login-content"><span className="sh-auth-kicker">PORTAL PREVIEW</span><h1>Explore the doctor workspace</h1><p>Open the existing sample workspace to review appointments, consultations, prescriptions and reports. This preview does not sign you in to a real account.</p><button className="sh-primary-button" onClick={() => { selectDemoDoctor(PRIMARY_DOCTOR_ID); navigate("/dashboard"); }}>Open portal preview</button><p><Link to="/register">Register as a doctor</Link> · <Link to="/login">Sign in</Link></p></div></AuthLayout>;
}
