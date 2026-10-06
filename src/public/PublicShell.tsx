import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Menu, ShieldPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { TELEMEDICINE_SIGN_IN_URL } from "@/public/ecosystemLinks";
import { ContactLines, FloatingWhatsApp } from "@/public/ui";

const nav = [
  ["EMR", "/products/emr"],
  ["Telemedicine", "/products/telemedicine"],
  ["Solutions", "/solutions"],
  ["Pricing", "/pricing"],
  ["Security", "/security"],
  ["About", "/about"],
] as const;

const meta: Record<string, [string, string]> = {
  "/": ["Sabi Health — AI-Powered Healthcare & Hospital Management Platform", "Sabi Health is building connected digital healthcare infrastructure for healthcare organizations and patients, including Sabi OS, an AI-powered healthcare operating system."],
  "/products/emr": ["Sabi EMR — Hospital & Clinic Management | Sabi Health", "Run registration, consultation, laboratory, pharmacy, wards and billing from one patient chart with Sabi EMR."],
  "/products/telemedicine": ["Sabi Health Telemedicine — See a Verified Doctor Online", "Video visits with verified professionals, prescriptions with partner pharmacies and family accounts."],
  "/solutions": ["Solutions — Sabi EMR and Sabi Health", "Find the right Sabi product for your hospital, clinic, practice, pharmacy or family."],
  "/ai": ["Sabi Intelligence — Responsible AI Assistance", "Explore how Sabi supports healthcare professionals with documentation, workflow and operational intelligence."],
  "/roadmap": ["Product Roadmap | Sabi Health", "See selected Sabi Health and Sabi OS product improvements that are planned, in progress or released."],
  "/security": ["Security & Privacy | Sabi Health", "Learn about Sabi Health's security architecture, tenant isolation, access controls and privacy-by-design principles."],
  "/about": ["About Sabi Health", "Meet the team and mission behind connected healthcare infrastructure for Africa."],
  "/pricing": ["Pricing — Coming Soon | Sabi Health", "Published Sabi pricing is coming soon. Call or WhatsApp us for a quote today."],
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

  useEffect(() => {
    // Read the preference here rather than subscribing: re-running this effect when it resolves
    // would yank the page back to the top after a page has scrolled itself (e.g. /solutions/:type).
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    const pageMeta = meta[location.pathname] ?? (location.pathname.startsWith("/solutions/") ? meta["/solutions"] : undefined) ?? ["Sabi Health — Intelligent Healthcare. Connected.", "Connected digital healthcare infrastructure for healthcare organizations and patients."];
    document.title = pageMeta[0];
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }
    description.setAttribute("content", pageMeta[1]);
  }, [location.pathname]);

  return (
    <div className="min-h-full bg-[#f8fbf9] text-slate-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-xl focus:translate-y-0">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-[#f8fbf9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-6 px-5 lg:px-8">
          <Brand />
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary navigation">
            {nav.map(([label, to]) => <NavLink key={label} to={to} className={({ isActive }) => cn("rounded-full px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950", isActive && "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200")}>{label}</NavLink>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 xl:flex">
            <Link to="/access" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:text-brand-700">Sign In</Link>
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
                  <Link to="/access" onClick={() => setOpen(false)} className="public-button-secondary">Sign In</Link>
                  <a href={TELEMEDICINE_SIGN_IN_URL} className="public-button-secondary">Patient sign in</a>
                  <Link to="/register" className="public-button-primary col-span-2 sm:col-span-1">Get Started</Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content"><Outlet /></main>
      <FloatingWhatsApp />

      <footer className="bg-[#061d15] text-white">
        <div className="mx-auto max-w-[1450px] px-5 py-16 lg:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div><Brand inverse /><p className="mt-5 max-w-xs text-sm leading-6 text-emerald-50/60">Building connected healthcare infrastructure for organizations, professionals and patients.</p><div className="mt-6"><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Call or WhatsApp</p><ContactLines light /></div></div>
            <FooterGroup title="Products" links={[["Sabi EMR", "/products/emr"], ["Sabi Health telemedicine", "/products/telemedicine"], ["Pricing", "/pricing"], ["Roadmap", "/roadmap"]]} />
            <FooterGroup title="Solutions" links={[["Hospitals", "/solutions/hospitals"], ["Clinics", "/solutions/clinics"], ["Hospital groups", "/solutions/hospital-groups"], ["Professionals", "/solutions/professionals"]]} />
            <FooterGroup title="Company" links={[["About", "/about"], ["Team", "/about#team"], ["Careers", "/resources#careers"], ["Contact", "/book-demo"]]} />
            <FooterGroup title="Resources" links={[["Resources", "/resources"], ["Documentation", "/resources#documentation"], ["Help Centre", "/resources#help-centre"], ["System Status", "/resources#system-status"]]} />
          </div>
          <div className="flex flex-col gap-4 pt-7 text-xs text-emerald-50/50 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Sabi Health.</p><div className="flex flex-wrap gap-5"><Link to="/resources#privacy">Privacy</Link><Link to="/resources#terms">Terms</Link><Link to="/resources#cookies">Cookies</Link><Link to="/register/organization">Register Organization</Link></div></div>
        </div>
      </footer>
    </div>
  );
}

function FooterGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">{title}</h2><ul className="mt-4 space-y-3">{links.map(([label, to]) => <li key={label}><Link className="text-sm text-emerald-50/60 transition hover:text-white" to={to}>{label}</Link></li>)}</ul></div>;
}
