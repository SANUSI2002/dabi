import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Building2, HeartHandshake, Minus, Plus, Sparkles, Stethoscope } from "lucide-react";
import GatewayFlow from "@/components/ui/gateway-flow";
import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";
import { cn } from "@/lib/cn";
import { Reveal } from "@/public/ui";
import { WhatsAppGlyph } from "@/public/ui";
import { HeroConversation, InteractionDemo } from "./ConversationPreview";
import { WaitlistForm } from "./WaitlistForm";
import storyUnwell from "@/assets/landing/story-unwell.webp";
import storyDoctor from "@/assets/landing/story-doctor.webp";
import storyMedication from "@/assets/landing/story-medication.webp";
import teamNutrition from "@/assets/landing/team-nutrition.webp";
import teamFamily from "@/assets/landing/team-family.webp";
import ctaWellness from "@/assets/landing/cta-wellness.webp";

// Sabi AI — AI built for healthcare. Not open yet: every call to action is "Join the waitlist",
// and every conversation on the page is a labelled, scripted sample with fictional details.

const PAPER = "bg-[#f7f4ee]";
const INK = "text-[#0b2b20]";
const SOFT = "text-[#55685f]";
const WAITLIST = "#waitlist";

const SUBNAV = [["For professionals", "#professionals"], ["For everyday health", "#everyday-health"], ["How it works", "#how-it-works"], ["FAQs", "#faqs"]] as const;

function Kicker({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={cn("mb-5 text-[12px] font-semibold uppercase tracking-[0.2em]", light ? "text-[#a9d9bf]" : "text-[#1f5c45]")}>{children}</p>;
}
function Headline({ id, children, light = false, className }: { id?: string; children: ReactNode; light?: boolean; className?: string }) {
  return <h2 id={id} className={cn("text-balance font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.045em]", light ? "text-[#f7f4ee]" : INK, className)}>{children}</h2>;
}
function Pill({ to, href, children, variant = "dark" }: { to?: string; href?: string; children: ReactNode; variant?: "dark" | "light" | "outline" | "outline-light" }) {
  const cls = cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    variant === "dark" && "bg-[#0b2b20] text-white hover:bg-[#123d2e] focus-visible:ring-[#0b2b20]",
    variant === "light" && "bg-[#f3efe6] text-[#0b2b20] hover:bg-white focus-visible:ring-white focus-visible:ring-offset-[#0b2b20]",
    variant === "outline" && "border border-[#0b2b20]/20 text-[#0b2b20] hover:border-[#0b2b20]/50 focus-visible:ring-[#0b2b20]",
    variant === "outline-light" && "border border-white/25 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-[#0b2b20]");
  const arrow = variant === "dark" || variant === "light" ? <ArrowRight size={16} aria-hidden /> : null;
  return to ? <Link to={to} className={cls}>{children}{arrow}</Link> : <a href={href} className={cls}>{children}{arrow}</a>;
}

export default function SabiAIPage() {
  // Links such as /ai#waitlist arrive after the site's scroll-to-top on navigation: scroll to the
  // section once that has happened.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return undefined;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 400);
    return () => window.clearTimeout(timer);
  }, [hash]);
  return <div className={cn(PAPER, INK)}>
    <SubNav />
    <Hero />
    <Professionals />
    <EverydayHealth />
    <HowItWorks />
    <Ecosystem />
    <Trust />
    <Faqs />
    <Waitlist />
    <FinalCta />
  </div>;
}

function SubNav() {
  return <nav aria-label="Sabi AI" className="sticky top-[72px] z-40 border-b border-[#0b2b20]/[0.07] bg-[#f7f4ee]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-5 sm:px-8">
      <a href="#top" className="inline-flex shrink-0 items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[#0b2b20] text-[#f3efe6]"><Sparkles size={13} /></span>Sabi AI</a>
      <div className="-mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SUBNAV.map(([label, href]) => <a key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#3d5a4d] transition hover:bg-[#0b2b20]/[0.05] hover:text-[#0b2b20]">{label}</a>)}
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <Link to="/access" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#3d5a4d] hover:text-[#0b2b20]">Sign in</Link>
        <a href={WAITLIST} className="rounded-full bg-[#0b2b20] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#123d2e]">Join the waitlist</a>
      </div>
    </div>
  </nav>;
}

function Hero() {
  const reduce = useReducedMotion();
  return <section id="top" aria-labelledby="ai-hero-heading" className="relative isolate scroll-mt-40 overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,#e3ede4_0%,transparent_65%)]" />
    <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20">
      <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}>
        <Kicker>Sabi AI · Built for healthcare</Kicker>
        <h1 id="ai-hero-heading" className="text-balance font-display text-[clamp(2.9rem,7vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.055em]">Made for the way you care.</h1>
        <p className={cn("mt-7 max-w-[540px] text-[17px] leading-[1.75] sm:text-lg", SOFT)}>Explore medical knowledge, make sense of complex reports, and work through healthcare questions with Sabi — your AI companion for clearer understanding and more informed care.</p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Pill href={WAITLIST}>Join the waitlist</Pill>
          <Pill href="#professionals" variant="outline">Explore Sabi</Pill>
        </div>
        <p className={cn("mt-6 text-sm", SOFT)}>For healthcare professionals first — and for patients and caregivers who want to understand their health.</p>
      </motion.div>
      <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .15, ease: [0.22, 1, 0.36, 1] }}>
        <HeroConversation />
      </motion.div>
    </div>
  </section>;
}

// ---------------------------------------------------------------- professionals
const WORKFLOWS: { title: string; copy: string; preview: ReactNode }[] = [
  {
    title: "Explore medical knowledge",
    copy: "Work through concepts and focused clinical questions, and get clear, structured explanations you can examine and follow up.",
    preview: <PreviewCard label="Sample question">
      <p className="rounded-xl bg-[#0b2b20] px-3.5 py-2.5 text-[13px] text-white">How do HFrEF and HFpEF differ?</p>
      <div className="mt-3 space-y-2 text-[13px] leading-6"><Row k="Ejection fraction" v="Reduced (≤40%) vs preserved (≥50%)" /><Row k="Main problem" v="Pumping vs filling" /><Row k="Worth exploring" v="Typical causes, how each is assessed" /></div>
    </PreviewCard>,
  },
  {
    title: "Review information",
    copy: "Organise lengthy patient histories and reports you provide into concise summaries, so the details you need are easier to find.",
    preview: <PreviewCard label="Sample · from a 38-page referral">
      <div className="space-y-2.5 text-[13px] leading-6">
        {[["Background", "T2 diabetes, hypertension, CKD stage 3a"], ["Recent events", "Admission for chest infection, May"], ["Medicines", "6 listed; 1 dose change in June"], ["To review", "Renal function trend; no repeat eGFR since May"]].map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </div>
    </PreviewCard>,
  },
  {
    title: "Support documentation",
    copy: "Turn the notes you supply into structured drafts. You stay the author: review, edit and decide what is recorded.",
    preview: <PreviewCard label="Sample · your shorthand → a draft">
      <p className="rounded-xl border border-dashed border-[#d9d3c5] px-3.5 py-2.5 font-mono text-[12px] text-[#55685f]">58M, SOB 3/7, ankle swelling, orthopnoea x2 pillows…</p>
      <div className="mt-3 space-y-1.5 text-[13px] leading-6"><p><b>Presenting complaint:</b> breathlessness for 3 days.</p><p><b>History:</b> ankle swelling; needs two pillows to sleep.</p><p className="text-[#1f5c45]"><b>Draft — review before saving.</b></p></div>
    </PreviewCard>,
  },
  {
    title: "Communicate clearly",
    copy: "Explain complex medical information in language patients and families can understand, in a tone that fits the conversation.",
    preview: <PreviewCard label="Sample · clinical to plain language">
      <p className="text-[13px] leading-6 text-[#55685f]">"Echo shows reduced LV systolic function, EF 35%."</p>
      <p className="mt-3 rounded-xl bg-[#eef4ef] px-3.5 py-3 text-[13px] leading-6">"The scan shows the main pumping chamber of your heart isn't squeezing as strongly as usual. Your team will talk you through what this means and the next steps."</p>
    </PreviewCard>,
  },
];

function Row({ k, v }: { k: string; v: string }) {
  return <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-[#efe9dd] pb-2 last:border-0 last:pb-0"><span className="font-semibold text-[#2b4a3d]">{k}</span><span>{v}</span></div>;
}
function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-[24px] border border-[#e6e0d3] bg-white p-5 shadow-[0_30px_60px_-44px_rgba(11,43,32,.45)] sm:p-6">
    <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a8a82]"><Sparkles size={12} className="text-[#1f5c45]" aria-hidden />{label}</p>
    {children}
  </div>;
}

function Professionals() {
  return <section id="professionals" aria-labelledby="pro-heading" className="scroll-mt-36 border-t border-[#0b2b20]/[0.06] bg-[#fbf9f4] px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto max-w-[1180px]">
      <Reveal className="max-w-[760px]"><Kicker>For healthcare professionals</Kicker><Headline id="pro-heading">More clarity for the work that matters.</Headline>
        <p className={cn("mt-6 max-w-[600px] text-[17px] leading-[1.75]", SOFT)}>Sabi helps with the reading, organising and explaining that surrounds clinical work — so your attention stays on the patient. It supports your professional judgment; it doesn't diagnose, prescribe or make decisions for you.</p></Reveal>
      <div className="mt-16 space-y-16 lg:mt-24 lg:space-y-28">
        {WORKFLOWS.map((w, i) => <Reveal key={w.title}><article className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-20", i % 2 && "lg:[&>*:first-child]:order-2")}>
          <div className="max-w-[460px]"><p className="font-display text-sm font-semibold text-[#1f5c45]">0{i + 1}</p><h3 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">{w.title}</h3><p className={cn("mt-4 text-base leading-[1.75]", SOFT)}>{w.copy}</p></div>
          <div>{w.preview}</div>
        </article></Reveal>)}
      </div>
    </div>
  </section>;
}

// ---------------------------------------------------------------- everyday health
const EVERYDAY: (WorksWheelItem & { copy: string })[] = [
  { title: "Medical terms", image: storyUnwell, copy: "Ask what a word on a letter or label means." },
  { title: "Reports", image: ctaWellness, copy: "Go through a report line by line, at your own pace." },
  { title: "Care instructions", image: storyMedication, copy: "Understand how and when to follow the plan you were given." },
  { title: "Body composition", image: teamNutrition, copy: "Learn what each measure describes and what to ask about." },
  { title: "Appointment prep", image: storyDoctor, copy: "Arrive with the questions that matter to you." },
  { title: "First aid", image: teamFamily, copy: "Clear first-aid steps — and when to get help immediately." },
];

function EverydayHealth() {
  return <section id="everyday-health" aria-labelledby="everyday-heading" className="scroll-mt-36 px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto max-w-[1180px]">
      <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-end">
        <Reveal><Kicker>For patients and caregivers</Kicker><Headline id="everyday-heading">Understand more. Feel better prepared.</Headline></Reveal>
        <Reveal delay={.05}><p className={cn("text-[17px] leading-[1.75]", SOFT)}>Sabi helps you make sense of medical terms, reports, care instructions and body-composition results, prepare questions for your appointments, and find first-aid information. It's there to help you understand — your care team remains the place for diagnosis and treatment.</p></Reveal>
      </div>
      <Reveal delay={.05} className="mt-12">
        <div className="hidden h-[600px] overflow-hidden rounded-[32px] border border-[#e6e0d3] md:block">
          <WorksWheel items={EVERYDAY} label="Everyday health" className="font-display" />
        </div>
        <p className={cn("mt-3 hidden text-center text-xs md:block", SOFT)}>Scroll, drag or use the arrow keys to turn the wheel.</p>
        <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="What Sabi can help you understand">
          {EVERYDAY.map((item) => <li key={item.title} className="w-[78%] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#e6e0d3] bg-white">
            <img src={item.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="p-4"><h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{item.title}</h3><p className={cn("mt-1 text-sm leading-6", SOFT)}>{item.copy}</p></div>
          </li>)}
        </ul>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[["Explanations, not verdicts", "Sabi explains what a report says. It won't diagnose a condition from it."], ["Ready for your appointment", "Turn what you've read into clear questions for your clinician."], ["In an emergency", "Call your local emergency number or go to the nearest emergency department."]].map(([t, c], i) => <Reveal key={t} delay={i * .05}><div className="h-full rounded-2xl border border-[#e6e0d3] bg-white/70 p-5"><h3 className="font-semibold">{t}</h3><p className={cn("mt-1.5 text-sm leading-6", SOFT)}>{c}</p></div></Reveal>)}
      </div>
    </div>
  </section>;
}

// ---------------------------------------------------------------- how it works
function HowItWorks() {
  const steps = [
    ["Ask", "Ask a healthcare question the way you'd ask a knowledgeable colleague or friend."],
    ["Share", "Add a document or report where uploads are supported, and Sabi works from what you provide."],
    ["Explore", "Follow up, go deeper or ask for a simpler version until it makes sense."],
  ];
  return <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-36 border-y border-[#0b2b20]/[0.06] bg-[#fbf9f4] px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:gap-20">
      <Reveal>
        <Kicker>How it works</Kicker><Headline id="how-heading">Ask. Share. Explore.</Headline>
        <ol className="mt-10 space-y-7">
          {steps.map(([title, copy], i) => <li key={title} className="flex gap-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#0b2b20]/15 font-display text-sm font-semibold">{i + 1}</span><div><h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h3><p className={cn("mt-1.5 text-[15px] leading-7", SOFT)}>{copy}</p></div></li>)}
        </ol>
      </Reveal>
      <Reveal delay={.08}><InteractionDemo waitlistHref={WAITLIST} /></Reveal>
    </div>
  </section>;
}

// ---------------------------------------------------------------- ecosystem
function Ecosystem() {
  const places: { icon: ReactNode; name: string; who: string; status: string; note: string; link?: { label: string; to?: string; href?: string } }[] = [
    { icon: <HeartHandshake size={20} />, name: "Sabi Health", who: "For patients and caregivers", status: "Planned", note: "Sabi AI inside your Sabi Health account, beside your visits, medicines and records.", link: { label: "About Sabi Health", to: "/products/telemedicine" } },
    { icon: <Stethoscope size={20} />, name: "Sabi EMR", who: "For professional workflows", status: "Planned", note: "Sabi AI in the clinical workspace hospitals and clinics already use.", link: { label: "About Sabi EMR", to: "/products/emr" } },
    { icon: <WhatsAppGlyph className="h-5 w-5" />, name: "WhatsApp", who: "For convenient conversations", status: "Planned", note: "Conversations with Sabi on WhatsApp are planned. Today, Sabi Health already sends medicine reminders there." },
  ];
  return <section aria-labelledby="eco-heading" className="px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto max-w-[1180px]">
      <Reveal className="max-w-[720px]"><Kicker>Availability</Kicker><Headline id="eco-heading">Meet Sabi where you need it.</Headline>
        <p className={cn("mt-6 text-[17px] leading-[1.75]", SOFT)}>Sabi AI is opening in stages. Each place keeps its own conversations — your health information doesn't move between them automatically.</p></Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {places.map((p, i) => <Reveal key={p.name} delay={i * .06} className="h-full"><article className="flex h-full flex-col rounded-[24px] border border-[#e6e0d3] bg-white p-7">
          <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef4ef] text-[#1f5c45]">{p.icon}</span><span className="rounded-full border border-[#e0d9cb] px-2.5 py-1 text-[11px] font-semibold text-[#55685f]">{p.status}</span></div>
          <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-0.03em]">{p.name}</h3><p className="mt-1 text-sm font-medium text-[#1f5c45]">{p.who}</p>
          <p className={cn("mt-4 flex-1 text-[15px] leading-7", SOFT)}>{p.note}</p>
          {p.link && <Link to={p.link.to!} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-[#1f5c45]">{p.link.label} <ArrowUpRight size={15} aria-hidden /></Link>}
        </article></Reveal>)}
      </div>
      <Reveal className="mt-4"><div className="flex flex-col gap-4 rounded-[24px] border border-[#e6e0d3] bg-[#fbf9f4] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#1f5c45]"><Building2 size={20} /></span><div><h3 className="font-semibold">Running a hospital or clinic?</h3><p className={cn("mt-1 text-sm leading-6", SOFT)}>Sabi Intelligence pilots cover documentation support, operational insight and data quality, with human review.</p></div></div>
        <div className="flex shrink-0 flex-wrap gap-2"><Pill to="/ai/organisations" variant="outline">See pilot areas</Pill><Pill to="/book-demo">Discuss an AI pilot</Pill></div>
      </div></Reveal>
    </div>
  </section>;
}

// ---------------------------------------------------------------- trust
function Trust() {
  return <section aria-labelledby="trust-heading" className="px-5 pb-20 sm:px-8 lg:pb-28">
    <Reveal className="mx-auto max-w-[1180px]"><div className="grid gap-8 rounded-[32px] bg-[#e9efe8] px-7 py-10 sm:px-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-14">
      <div><Kicker>Professional boundaries</Kicker><h2 id="trust-heading" className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.035em]">Sabi supports understanding and clinical work. It does not replace professional judgment or emergency services.</h2></div>
      <ul className="space-y-4 text-[15px] leading-7">
        {[["Clear explanations", "Answers aim to be readable and to say when something needs a professional's view."], ["Professionals stay in charge", "Summaries and drafts are starting points for your review, never final records."], ["Careful with sensitive information", "Share only what a question needs. We'll publish exactly how Sabi AI handles data before it opens."]].map(([t, c]) => <li key={t} className="flex gap-3"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f5c45]" /><span><b>{t}.</b> <span className={SOFT}>{c}</span></span></li>)}
      </ul>
    </div></Reveal>
  </section>;
}

// ---------------------------------------------------------------- FAQs
const FAQS = [
  ["What is Sabi AI?", "An AI assistant built for healthcare. It helps healthcare professionals, patients and caregivers explore medical knowledge, make sense of complex information and work through healthcare questions in clear language. It isn't open yet — join the waitlist to hear when it is."],
  ["Who can use Sabi?", "Sabi is designed first for healthcare professionals, and also for patients and caregivers who want to understand health information. Access will open in stages, starting with people on the waitlist."],
  ["How can Sabi support healthcare professionals?", "By helping you explore clinical concepts, condense long histories and reports you provide into summaries, turn your notes into structured drafts, and explain medical information in plain language. You review everything and make every clinical decision."],
  ["Can Sabi help me understand a medical report?", "Yes — Sabi can explain the terms in a report, what each measure describes and what the reference ranges printed on it mean, and help you prepare questions. It won't diagnose a condition from a report; your clinician can tell you what the results mean for you."],
  ["Where can I use Sabi?", "Sabi AI isn't available yet. It's planned for Sabi Health (for patients and caregivers), Sabi EMR (for professional workflows) and WhatsApp. Each will open separately, and health information won't move between them automatically."],
  ["Does Sabi replace a healthcare professional?", "No. Sabi supports understanding and clinical work. It does not replace professional judgment or emergency services. In an emergency, call your local emergency number or go to the nearest emergency department."],
] as const;

function Faqs() {
  const [open, setOpen] = useState(0);
  return <section id="faqs" aria-labelledby="faq-heading" className="scroll-mt-36 border-t border-[#0b2b20]/[0.06] bg-[#fbf9f4] px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <Reveal><Kicker>FAQs</Kicker><Headline id="faq-heading">Questions, answered plainly.</Headline></Reveal>
      <div className="divide-y divide-[#e6e0d3] border-y border-[#e6e0d3]">
        {FAQS.map(([q, a], i) => { const expanded = open === i; return <div key={q}>
          <h3><button type="button" id={`ai-faq-q-${i}`} aria-expanded={expanded} aria-controls={`ai-faq-a-${i}`} onClick={() => setOpen(expanded ? -1 : i)} className="flex w-full items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b2b20]/25">
            <span className="flex-1 font-display text-[17px] font-semibold tracking-[-0.02em] sm:text-lg">{q}</span>
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#0b2b20]/15">{expanded ? <Minus size={15} /> : <Plus size={15} />}</span>
          </button></h3>
          <div id={`ai-faq-a-${i}`} role="region" aria-labelledby={`ai-faq-q-${i}`} hidden={!expanded}><p className={cn("max-w-[620px] pb-6 text-[15px] leading-7", SOFT)}>{a}</p></div>
        </div>; })}
      </div>
    </div>
  </section>;
}

// ---------------------------------------------------------------- waitlist + final CTA
function Waitlist() {
  return <section id="waitlist" aria-labelledby="waitlist-heading" className="scroll-mt-36 px-5 py-20 sm:px-8 lg:py-28">
    <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
      <Reveal><Kicker>Early access</Kicker><Headline id="waitlist-heading">Join the waitlist.</Headline>
        <p className={cn("mt-6 max-w-[440px] text-[17px] leading-[1.75]", SOFT)}>Sabi AI opens in stages. Tell us who you are and we'll let you know when it's ready for you.</p></Reveal>
      <Reveal delay={.06}><div className="rounded-[28px] border border-[#e6e0d3] bg-white p-6 sm:p-8"><WaitlistForm source="ai-waitlist-section" /></div></Reveal>
    </div>
  </section>;
}

function FinalCta() {
  const reduce = useReducedMotion();
  return <section aria-labelledby="final-heading" className="relative isolate overflow-hidden bg-[#0b2b20] px-5 py-24 text-center sm:px-8 lg:py-32">
    {/* Paths converging on one point: many questions, one clear place to work through them. */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-screen">
      <GatewayFlow className="h-full w-full" density={0.7} speed={reduce ? 0 : 0.6} />
    </div>
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(11,43,32,.15)_0%,rgba(11,43,32,.85)_70%)]" />
    <Reveal className="mx-auto max-w-[760px]">
      <Kicker light>Sabi AI</Kicker>
      <Headline id="final-heading" light>Bring more clarity to healthcare.</Headline>
      <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.75] text-[#f7f4ee]/70">For the questions you face, the information you review, and the people you care for.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3"><Pill href={WAITLIST} variant="light">Join the waitlist</Pill><Pill href="#professionals" variant="outline-light">Explore Sabi</Pill></div>
    </Reveal>
  </section>;
}
