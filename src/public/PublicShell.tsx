import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Menu, ShieldPlus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

const nav = [
  ["Products", "/products/sabi-os"],
  ["Solutions", "/solutions/hospitals"],
  ["AI", "/ai"],
  ["Roadmap", "/roadmap"],
  ["For Patients", "/products/sabi-health"],
  ["For Healthcare Organizations", "/solutions/hospital-groups"],
  ["Security", "/security"],
  ["About", "/about"],
  ["Resources", "/resources"],
  ["Pricing", "/pricing"],
] as const;

const meta: Record<string, [string, string]> = {
  "/": ["Sabi Health — AI-Powered Healthcare & Hospital Management Platform", "Sabi Health is building connected digital healthcare infrastructure for healthcare organizations and patients, including Sabi OS, an AI-powered healthcare operating system."],
  "/products/sabi-os": ["Sabi OS — Healthcare Operating System | Sabi Health", "Explore connected clinical, operational, workforce and finance workflows for modern healthcare organizations."],
  "/products/sabi-health": ["Sabi Health for Patients", "Discover the patient-facing direction for connected records, prescriptions, pharmacy and virtual care."],
  "/ai": ["Sabi Intelligence — Responsible AI Assistance", "Explore how Sabi supports healthcare professionals with documentation, workflow and operational intelligence."],
  "/roadmap": ["Product Roadmap | Sabi Health", "See selected Sabi Health and Sabi OS product improvements that are planned, in progress, in beta or released."],
  "/security": ["Security & Privacy | Sabi Health", "Learn about Sabi Health's security architecture, tenant isolation, access controls and privacy-by-design principles."],
  "/about": ["About Sabi Health", "Meet the team and mission behind connected healthcare infrastructure for Africa."],
  "/pricing": ["Sabi OS Pricing", "Review current Sabi OS packages sourced from the Sabi Command Center catalog."],
};

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Sabi Health home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><ShieldPlus size={18} /></span>
      <span className={cn("font-display text-lg font-extrabold tracking-[-0.03em]", inverse ? "text-white" : "text-slate-950")}>Sabi <span className="text-brand-600">Health</span></span>
    </Link>
  );
}

export default function PublicShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    const pageMeta = meta[location.pathname] ?? ["Sabi Health — Intelligent Healthcare. Connected.", "Connected digital healthcare infrastructure for healthcare organizations and patients."];
    document.title = pageMeta[0];
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }
    description.setAttribute("content", pageMeta[1]);
  }, [location.pathname, reduceMotion]);

  return (
    <div className="min-h-full bg-[#f8fbf9] text-slate-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-xl focus:translate-y-0">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-[#f8fbf9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-6 px-5 lg:px-8">
          <Brand />
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary navigation">
            {nav.map(([label, to]) => <NavLink key={label} to={to} className={({ isActive }) => cn("rounded-full px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950", isActive && "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200")}>{label}</NavLink>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:text-brand-700">Sign In</Link>
            <Link to="/book-demo" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-brand-300">Book a Demo</Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800">Get Started <ArrowRight size={15} /></Link>
          </div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white xl:hidden" aria-expanded={open} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-slate-200 bg-white xl:hidden">
              <nav className="mx-auto grid max-w-[1500px] gap-1 px-5 py-5" aria-label="Mobile navigation">
                {nav.map(([label, to]) => <NavLink key={label} to={to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-brand-50">{label}</NavLink>)}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  <Link to="/login" className="public-button-secondary">Sign In</Link>
                  <Link to="/book-demo" className="public-button-secondary">Book a Demo</Link>
                  <Link to="/register" className="public-button-primary col-span-2 sm:col-span-1">Get Started</Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content"><Outlet /></main>

      <footer className="bg-[#061d15] text-white">
        <div className="mx-auto max-w-[1450px] px-5 py-16 lg:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div><Brand inverse /><p className="mt-5 max-w-xs text-sm leading-6 text-emerald-50/60">Building connected healthcare infrastructure for organizations, professionals and patients.</p><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Intelligent Healthcare. Connected.</p></div>
            <FooterGroup title="Products" links={[["Sabi OS", "/products/sabi-os"], ["Sabi Health", "/products/sabi-health"], ["AI", "/ai"], ["Roadmap", "/roadmap"]]} />
            <FooterGroup title="Solutions" links={[["Hospitals", "/solutions/hospitals"], ["Clinics", "/solutions/clinics"], ["Laboratories", "/solutions/laboratories"], ["Hospital Groups", "/solutions/hospital-groups"]]} />
            <FooterGroup title="Company" links={[["About", "/about"], ["Team", "/about#team"], ["Careers", "/resources#careers"], ["Contact", "/book-demo"]]} />
            <FooterGroup title="Resources" links={[["Resources", "/resources"], ["Documentation", "/resources#documentation"], ["Help Centre", "/resources#help"], ["System Status", "/resources#status"]]} />
          </div>
          <div className="flex flex-col gap-4 pt-7 text-xs text-emerald-50/50 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Sabi Health. Product prototype.</p><div className="flex flex-wrap gap-5"><Link to="/resources#privacy">Privacy</Link><Link to="/resources#terms">Terms</Link><Link to="/resources#cookies">Cookies</Link><Link to="/register">Register Organization</Link></div></div>
        </div>
      </footer>
    </div>
  );
}

function FooterGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">{title}</h2><ul className="mt-4 space-y-3">{links.map(([label, to]) => <li key={label}><Link className="text-sm text-emerald-50/60 transition hover:text-white" to={to}>{label}</Link></li>)}</ul></div>;
}
