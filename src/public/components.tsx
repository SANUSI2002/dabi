import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BedDouble, Check, FlaskConical, HeartPulse, Pill, Sparkles, Stethoscope } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Status({ children, tone = "available" }: { children: ReactNode; tone?: "available" | "pilot" | "soon" }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.13em]", tone === "available" ? "bg-emerald-100 text-emerald-800" : tone === "pilot" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800")}>{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">{children}</p>;
}

export function SectionHeading({ eyebrow, title, copy, centered = false }: { eyebrow: string; title: string; copy?: string; centered?: boolean }) {
  return <div className={cn("max-w-3xl", centered && "mx-auto text-center")}><Eyebrow>{eyebrow}</Eyebrow><h2 className="text-balance font-display text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>{copy && <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">{copy}</p>}</div>;
}

export function PublicCta({ to, children, secondary = false }: { to: string; children: ReactNode; secondary?: boolean }) {
  return <Link to={to} className={secondary ? "public-button-secondary" : "public-button-primary"}>{children}<ArrowRight size={16} /></Link>;
}

const views = ["Clinical Dashboard", "Patient Timeline", "Laboratory", "Pharmacy", "Operations", "Analytics"] as const;

export function ProductWindow() {
  const [view, setView] = useState<(typeof views)[number]>(views[0]);
  const reduceMotion = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-[26px] border border-white/15 bg-[#08261c] shadow-[0_40px_100px_-35px_rgba(0,0,0,.8)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/45">Sabi OS · Connected workspace</span></div>
      <div className="grid min-h-[420px] grid-cols-[82px_1fr] sm:grid-cols-[150px_1fr]">
        <div className="border-r border-white/10 p-3"><div className="mb-7 flex items-center gap-2 text-white"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500"><HeartPulse size={14} /></span><b className="hidden text-xs sm:block">Sabi OS</b></div><div className="space-y-1">{views.map((item) => <button key={item} onClick={() => setView(item)} className={cn("w-full rounded-lg px-2 py-2 text-left text-[10px] font-semibold transition", view === item ? "bg-brand-500 text-white" : "text-white/45 hover:bg-white/5 hover:text-white")}><span className="hidden sm:inline">{item}</span><span className="sm:hidden">{item.split(" ")[0]}</span></button>)}</div></div>
        <div className="min-w-0 bg-[#f5faf7] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sabi Health Post</p><h3 className="mt-1 font-display text-lg font-extrabold text-slate-950 sm:text-2xl">{view}</h3></div><span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700"><Sparkles size={10} /> AI assist</span></div>
          <motion.div key={view} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5"><MockView view={view} /></motion.div>
        </div>
      </div>
    </div>
  );
}

function MockView({ view }: { view: (typeof views)[number] }) {
  const config = {
    "Clinical Dashboard": { stats: [["Waiting", "18"], ["Appointments", "42"], ["Admissions", "11"]], rows: ["Amina Yusuf · Triage", "Ifeoma Okeke · Consultation", "Tunde Bello · Laboratory"] },
    "Patient Timeline": { stats: [["Encounters", "12"], ["Results", "8"], ["Medicines", "3"]], rows: ["Today · Follow-up consultation", "12 Sep · Laboratory result approved", "28 Aug · Prescription dispensed"] },
    Laboratory: { stats: [["Pending", "24"], ["Collected", "17"], ["Critical", "2"]], rows: ["Full blood count · Processing", "HbA1c · Awaiting approval", "Malaria RDT · Resulted"] },
    Pharmacy: { stats: [["Orders", "36"], ["Ready", "14"], ["Low stock", "5"]], rows: ["Amoxicillin · Safety check", "Metformin · Ready to dispense", "Artemether · Stock review"] },
    Operations: { stats: [["Beds", "72%"], ["Assets", "148"], ["Tasks", "9"]], rows: ["Ward capacity · Within target", "Oxygen plant · Operational", "Generator B · Service due"] },
    Analytics: { stats: [["Visits", "+8%"], ["Turnaround", "42m"], ["Claims", "91%"]], rows: ["Outpatient demand · Rising", "Lab turnaround · Improving", "Revenue capture · Stable"] },
  }[view];
  return <><div className="grid grid-cols-3 gap-2 sm:gap-3">{config.stats.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-4"><p className="truncate text-[9px] font-semibold text-slate-400 sm:text-[11px]">{label}</p><p className="mt-1 font-display text-lg font-extrabold text-slate-950 sm:text-2xl">{value}</p></div>)}</div><div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><div className="mb-4 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live workflow</p><Activity size={14} className="text-brand-600" /></div><div className="space-y-2.5">{config.rows.map((row, i) => <div key={row} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5"><span className={cn("h-2 w-2 rounded-full", i === 0 ? "bg-brand-500" : i === 1 ? "bg-amber-400" : "bg-blue-400")} /><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700 sm:text-xs">{row}</span><span className="hidden text-[9px] font-bold text-slate-400 sm:block">Just now</span></div>)}</div></div><div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-[10px] leading-5 text-violet-800"><b>Assistance:</b> Workflow summary prepared for review. Clinical decisions remain with qualified healthcare professionals.</div></>;
}

export function JourneyMap() {
  const nodes = [{ label: "Doctor", icon: Stethoscope }, { label: "Hospital", icon: BedDouble }, { label: "Pharmacy", icon: Pill }, { label: "Diagnostics", icon: FlaskConical }];
  return <div className="relative mx-auto max-w-4xl rounded-[30px] border border-emerald-900/10 bg-white p-6 shadow-[0_30px_90px_-50px_rgba(2,44,28,.5)] sm:p-10"><div className="absolute left-1/2 top-20 h-[calc(100%-10rem)] w-px -translate-x-1/2 bg-gradient-to-b from-brand-300 via-brand-500 to-brand-200" /><div className="relative mx-auto grid w-fit place-items-center rounded-2xl bg-slate-950 px-7 py-4 text-center text-white"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-300">One identity</span><b className="mt-1 font-display">Patient · Sabi Health</b></div><div className="relative my-10 grid grid-cols-2 gap-3 sm:grid-cols-4">{nodes.map(({ label, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-200 bg-[#f8fbf9] p-4 text-center"><Icon className="mx-auto text-brand-700" size={20} /><b className="mt-2 block text-sm">{label}</b></div>)}</div><div className="relative mx-auto w-fit rounded-2xl bg-brand-gradient px-8 py-4 text-center text-white shadow-glow"><span className="text-[10px] font-bold uppercase tracking-widest text-white/65">Organization workspace</span><b className="mt-1 block font-display">Sabi OS</b></div><p className="relative mt-7 text-center text-xs text-slate-500">An architectural direction for connected care. Roadmap services are labelled separately and are not presented as live integrations.</p></div>;
}

export function CheckList({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Check size={12} strokeWidth={3} /></span>{item}</li>)}</ul>;
}
