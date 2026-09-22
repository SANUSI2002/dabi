import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, ChevronRight, LockKeyhole, Pill, ShieldCheck } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { DEMO_PASSWORD } from "@/identity/seed";
import { developmentFixturesEnabled } from "@/config/runtime";
import { hasPharmacyPortalAccess } from "./access";

const DEMO_PHARMACY_EMAIL = "admin@haven-pharmacy.health";

export default function PharmacyLoginPage() {
  const navigate = useNavigate();
  const { authed, activeMembership, signIn, signOut } = useAuth();
  const [email, setEmail] = useState(developmentFixturesEnabled ? DEMO_PHARMACY_EMAIL : "");
  const [password, setPassword] = useState(developmentFixturesEnabled ? DEMO_PASSWORD : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (authed && hasPharmacyPortalAccess(activeMembership)) return <Navigate to="/pharmacy-portal" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn({ email, password, rememberMe });
    setBusy(false);
    if (result.status === "ERROR") return setError(result.message);
    if (result.status === "MFA") return navigate("/mfa?context=pharmacy");
    const membership = useAuth.getState().activeMembership;
    if (!hasPharmacyPortalAccess(membership)) {
      useAuth.getState().signOut();
      return setError("This account is not connected to a pharmacy organization. Use your pharmacy administrator account.");
    }
    navigate("/pharmacy-portal", { replace: true });
  }

  return <div className="min-h-screen bg-[#071d16] text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(245,165,36,.18),transparent_28%),radial-gradient(circle_at_90%_80%,rgba(18,128,91,.25),transparent_34%)]" /><div className="relative mx-auto grid min-h-screen max-w-[1180px] items-center gap-12 px-5 py-10 lg:grid-cols-[1fr_460px] lg:px-10">
    <section className="hidden lg:block"><Link to="/" className="inline-flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f5a524] text-[#13231e]"><Pill size={22} /></span><span className="font-display text-xl font-extrabold">Sabi <span className="text-[#f5b94e]">Pharmacy</span></span></Link><p className="mt-16 text-xs font-extrabold uppercase tracking-[.2em] text-[#f5b94e]">Independent pharmacy workspace</p><h1 className="mt-5 max-w-xl font-display text-6xl font-extrabold leading-[.98] tracking-[-.06em]">Your pharmacy.<br/><span className="text-[#f5b94e]">Your operations.</span></h1><p className="mt-7 max-w-lg text-lg leading-8 text-white/55">A dedicated workspace for pharmacy organizations to review prescriptions, manage quotes, dispense safely and reconcile fulfilment.</p><div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">{[[Building2, "Own organization context"], [ShieldCheck, "Role-aware access"], [LockKeyhole, "Auditable operations"]].map(([Icon, label]) => { const C = Icon as typeof Building2; return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><C size={18} className="text-[#f5b94e]"/><p className="mt-3 text-xs font-bold leading-5 text-white/70">{String(label)}</p></div>; })}</div></section>
    <section className="rounded-[30px] border border-white/10 bg-white p-6 text-[#17342a] shadow-[0_30px_90px_-45px_rgba(0,0,0,.8)] sm:p-9"><div className="flex items-center gap-3 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f5a524] text-[#13231e]"><Pill size={22}/></span><span className="font-display text-xl font-extrabold">Sabi <span className="text-[#b06d10]">Pharmacy</span></span></div><p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#b06d10]">Pharmacy organization access</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em]">Sign in to your pharmacy portal</h2><p className="mt-3 text-sm leading-6 text-[#70877d]">This is separate from the hospital EMR, patient portal and telemedicine experience.</p>{authed && activeMembership && activeMembership.organizationId !== "org-haven" && <div className="mt-5 rounded-2xl border border-[#f0d3a0] bg-[#fff7e8] p-4 text-sm leading-6 text-[#805215]">You are currently signed in to another organization. Sign out below, then sign in with your pharmacy organization account.</div>}<form className="mt-7 space-y-4" onSubmit={submit}><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Work email</span><input className="w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-4 py-3 text-sm outline-none focus:border-[#0b8a63]" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Password</span><input className="w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-4 py-3 text-sm outline-none focus:border-[#0b8a63]" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="flex items-center gap-2 text-sm text-[#5b766a]"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-[#0b8a63]"/> Keep me signed in</label>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#174a3a] disabled:opacity-60" type="submit">{busy ? "Checking access…" : "Enter pharmacy portal"}<ArrowRight size={16}/></button></form>{developmentFixturesEnabled && <button type="button" onClick={() => { setEmail(DEMO_PHARMACY_EMAIL); setPassword(DEMO_PASSWORD); setError(""); }} className="mt-5 flex w-full items-center gap-3 rounded-xl border border-[#dbe9e2] bg-[#f5fbf7] p-3 text-left hover:border-[#f5b94e]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#0b8a63] ring-1 ring-[#dbe9e2]"><Pill size={17}/></span><span className="min-w-0 flex-1"><b className="block text-sm text-[#17342a]">Use development pharmacy account</b><span className="block text-xs text-[#82958c]">Haven Pharmacy Network · local fixture only</span></span><ChevronRight size={15} className="text-[#a4b7ae]"/></button>}<div className="mt-7 flex items-center justify-between border-t border-[#edf3ef] pt-5"><Link to="/" className="text-xs font-bold text-[#70877d] hover:text-[#0b8a63]">Back to Sabi Health</Link>{authed && activeMembership && activeMembership.organizationId !== "org-haven" ? <button type="button" onClick={() => { signOut(); setError(""); }} className="text-xs font-bold text-red-700">Sign out current account</button> : <Link to="/login" className="text-xs font-bold text-[#70877d] hover:text-[#0b8a63]">Use Sabi ID sign in</Link>}</div></section>
  </div></div>;
}
