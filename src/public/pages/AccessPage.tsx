import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HeartPulse, Hospital, Pill, ShieldCheck } from "lucide-react";
import { COMMAND_CENTER_SIGN_IN_URL, EMR_SIGN_IN_URL, PHARMACY_SIGN_IN_URL, TELEMEDICINE_SIGN_IN_URL } from "@/public/ecosystemLinks";

const portals = [
  { title: "Telemedicine", audience: "Patients and virtual care", description: "Use the existing Sabi Health patient sign-in to manage your care.", icon: HeartPulse, href: TELEMEDICINE_SIGN_IN_URL },
  { title: "Sabi EMR", audience: "Hospitals and care teams", description: "Open your organization's clinical and operational workspace.", icon: Hospital, href: EMR_SIGN_IN_URL },
  { title: "Sabi Pharmacy", audience: "Pharmacy organizations", description: "Manage your own pharmacy's inventory, prescriptions and orders.", icon: Pill, href: PHARMACY_SIGN_IN_URL },
  { title: "Command Center", audience: "Sabi platform staff", description: "Administrative access for authorized internal operators only.", icon: ShieldCheck, href: COMMAND_CENTER_SIGN_IN_URL },
];

export default function AccessPage() {
  useEffect(() => { document.title = "Choose your sign-in | Sabi Health"; }, []);
  return <main className="min-h-screen bg-[#f5faf7] px-5 py-10 text-slate-900 sm:py-16">
    <div className="mx-auto max-w-5xl">
      <Link to="/" className="text-sm font-bold text-emerald-800 hover:underline">← Back to Sabi Health</Link>
      <div className="mt-12 max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">Sabi ecosystem access</p><h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Where would you like to sign in?</h1><p className="mt-5 text-base leading-7 text-slate-600">Choose the service that belongs to your account. Each workspace has its own address and access requirements.</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">{portals.map(({ title, audience, description, icon: Icon, href }) => <a key={title} href={href} className="group flex min-h-56 flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-950 text-emerald-200"><Icon size={23}/></span><span className="mt-6 text-xs font-extrabold uppercase tracking-widest text-emerald-700">{audience}</span><span className="mt-2 font-display text-2xl font-extrabold">{title}</span><span className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</span><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-800">Open sign-in <ArrowRight size={16} className="transition group-hover:translate-x-1"/></span></a>)}</div>
      <p className="mt-8 text-sm text-slate-500">New organization? <Link to="/register/organization" className="font-bold text-emerald-800 hover:underline">Start onboarding</Link>.</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">EMR, Pharmacy and Command Center production authentication is awaiting the secure identity backend. These links are sign-in entry points, not live account provisioning.</p>
    </div>
  </main>;
}
