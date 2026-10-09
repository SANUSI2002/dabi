import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Baby, Building2, CalendarCheck, ChevronDown, ClipboardList, FileText, HeartHandshake, HeartPulse, Hospital, LockKeyhole, Mic, Minus, Network, PhoneOff, Pill, Plus, Salad, Search, ShieldCheck, Sparkles, Stethoscope, UserRound, Video } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { DOCTOR_REGISTER_URL, DOCTOR_SIGN_IN_URL, TELEMEDICINE_SIGN_IN_URL } from "@/public/ecosystemLinks";
import { Action, ContactLines, Eyebrow, INK, MUTED, Reveal, SectionTitle, TextLink } from "@/public/ui";
import heroArt from "@/assets/landing/hero-care-conversation.webp";
import storyUnwell from "@/assets/landing/story-unwell.webp";
import storyDoctor from "@/assets/landing/story-doctor.webp";
import storyTests from "@/assets/landing/story-tests.webp";
import storyMedication from "@/assets/landing/story-medication.webp";
import storyMeal from "@/assets/landing/story-meal.webp";
import teamGp from "@/assets/landing/team-gp.webp";
import teamNutrition from "@/assets/landing/team-nutrition.webp";
import teamPharmacist from "@/assets/landing/team-pharmacist.webp";
import teamNursing from "@/assets/landing/team-nursing.webp";
import teamWellbeing from "@/assets/landing/team-wellbeing.webp";
import teamFamily from "@/assets/landing/team-family.webp";
import providerHospital from "@/assets/landing/provider-hospital.webp";
import providerProfessional from "@/assets/landing/provider-professional.webp";
import ctaWellness from "@/assets/landing/cta-wellness.webp";

const helpWith = [
  { icon: Stethoscope, tone: "bg-brand-50 text-brand-700", title: "Everyday health worries", copy: "A cough that won't settle, a rash, a fever at night — talk it through with a qualified clinician." },
  { icon: HeartPulse, tone: "bg-[#fbece4] text-[#a4532c]", title: "Women's health", copy: "Private conversations about cycles, pregnancy and wellbeing, at a time that suits you." },
  { icon: Baby, tone: "bg-[#eef3fb] text-[#41608a]", title: "Your children and family", copy: "Add dependants to your account and book for them without a second login." },
  { icon: ClipboardList, tone: "bg-[#f3eefa] text-[#6d5a91]", title: "Ongoing conditions", copy: "Log readings at home and keep a care plan your professional can follow up on." },
  { icon: HeartHandshake, tone: "bg-[#fdf5e6] text-[#8d6a2c]", title: "Mind and mood", copy: "Talk to verified wellbeing professionals in a space that stays confidential." },
  { icon: Salad, tone: "bg-[#ecf6ee] text-[#3f7350]", title: "Food and lifestyle", copy: "Practical nutrition guidance that fits your budget, culture and routine." },
];

const amaka = [
  { image: storyUnwell, alt: "A woman at home looking at her tablet", title: "Something feels off", copy: "Amaka opens Sabi Health from her living room.", place: "lg:col-start-1 lg:row-start-1" },
  { image: storyDoctor, alt: "A doctor at her desk preparing for a video visit", title: "The clinician is ready", copy: "A verified doctor sees her on video, on time.", place: "lg:col-start-2 lg:row-start-1 lg:mt-24" },
  { image: storyTests, alt: "A patient checking her blood pressure at home", title: "Readings from home", copy: "Her blood pressure goes straight into her record.", place: "lg:col-start-3 lg:row-start-1" },
  { image: storyMedication, alt: "A patient sorting her prescribed medicine", title: "Prescription, sorted", copy: "Partner pharmacies quote; she picks one.", place: "lg:col-start-1 lg:row-start-2 lg:ml-[18%]" },
  { image: storyMeal, alt: "A woman preparing a colourful home-cooked meal", title: "Back to her best", copy: "A nutrition plan keeps her on track afterwards.", place: "lg:col-start-2 lg:row-start-2 lg:ml-[18%] lg:mt-14" },
];

const team = [
  { image: teamGp, role: "General practitioners", detail: "First stop for most health questions" },
  { image: teamNutrition, role: "Nutrition professionals", detail: "Meal plans you can actually follow" },
  { image: teamPharmacist, role: "Pharmacists", detail: "Check, quote and dispense your medicine" },
  { image: teamNursing, role: "Hospital care teams", detail: "Ward and clinic staff on Sabi EMR" },
  { image: teamWellbeing, role: "Wellbeing professionals", detail: "Someone to talk to, in confidence" },
  { image: teamFamily, role: "You and your family", detail: "One account for everyone you care for" },
];

const faqs = [
  { q: "What is Sabi Health, in one sentence?", a: "It's a patient account for video and in-person visits with verified professionals, your prescriptions and readings, and your family's care, all in one place. It's built by the team behind Sabi EMR, our hospital system." },
  { q: "How quickly can I talk to someone?", a: "As soon as a professional has an open slot. You pick a time from their published availability, they confirm, and you join a private video room from your browser a few minutes before it starts." },
  { q: "Who can see my consultation?", a: "Only you and the professional on that appointment. Rooms are private, they open only around your booked time, and recording and transcription are switched off." },
  { q: "Can I book lab tests on Sabi Health?", a: "Not yet. Laboratory booking for patients is on our roadmap. Hospitals using Sabi EMR already run their own labs inside the system." },
  { q: "I'm a doctor or health professional. How do I join?", a: "Register, upload your licence and credentials, and our team reviews them. Once approved you can publish availability and start seeing patients." },
  { q: "Is this for emergencies?", a: "No. If someone is in danger, call your local emergency number or go to the nearest emergency department straight away." },
];

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  return (
    <div className={INK}>
      <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden border-b border-[#0b2b20]/5 bg-[#f6f9f5]">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full bg-[radial-gradient(ellipse_at_78%_45%,#dff0e5_0%,transparent_62%)] lg:w-3/4" />
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-16 pt-14 sm:px-8 lg:min-h-[760px] lg:grid-cols-2 lg:gap-4 lg:px-10 lg:pb-20 lg:pt-16 xl:px-16">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} className="relative z-20 max-w-2xl">
            <Eyebrow>Sabi Health · Care without the run-around</Eyebrow>
            <h1 id="hero-heading" className="font-display text-[clamp(2.7rem,7.6vw,4.6rem)] font-semibold leading-[1.04] tracking-[-0.05em]">See a doctor.<br />Skip the queue.<br /><span className="text-brand-600">Keep the record.</span></h1>
            <p className={cn("mt-6 max-w-[510px] text-base leading-[1.8] sm:text-lg", MUTED)}>Video visits with verified professionals, prescriptions that reach a pharmacy, and one account for your whole family's care — from the team behind Sabi EMR.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Action href={TELEMEDICINE_SIGN_IN_URL}>Book a video visit</Action>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold underline decoration-[#0b2b20]/20 underline-offset-[6px] hover:text-brand-700">See how a visit works <ChevronDown size={15} /></a>
            </div>
            <div className={cn("mt-9 grid gap-3 border-t border-[#0b2b20]/10 pt-6 text-sm font-medium sm:grid-cols-2", MUTED)}>
              <Link to="/products/emr" className="inline-flex items-center gap-2 hover:text-brand-700"><Hospital size={15} className="text-brand-600" /> Run a hospital? See Sabi EMR</Link>
              <a href={DOCTOR_REGISTER_URL} className="inline-flex items-center gap-2 hover:text-brand-700"><BadgeCheck size={15} className="text-brand-600" /> Professional? Apply to practise</a>
              <Link to="/ai" className="inline-flex items-center gap-2 hover:text-brand-700"><Sparkles size={15} className="text-brand-600" /> Meet Sabi AI, built for healthcare</Link>
            </div>
          </motion.div>
          <HeroFigure />
        </div>
      </section>

      <section aria-labelledby="help-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1160px]">
          <SectionTitle id="help-heading" eyebrow="What we can help with" title="Care for the everyday — and the not-so-everyday." copy="Six of the reasons people open Sabi Health. Every professional you meet here has had their credentials checked." className="mb-10" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {helpWith.map(({ icon: Icon, tone, title, copy }, i) => <li key={title}><Reveal delay={i * .04} className="h-full"><article className="group h-full rounded-2xl border border-[#e3ebe5] bg-[#fcfefc] p-6 transition hover:border-brand-200 hover:shadow-[0_10px_28px_-18px_rgba(5,154,87,.45)]">
              <span aria-hidden className={cn("grid h-11 w-11 place-items-center rounded-2xl transition group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]", tone)}><Icon size={20} strokeWidth={1.6} /></span>
              <h3 className="mt-5 text-xl font-bold leading-tight tracking-[-0.02em]">{title}</h3><p className={cn("mt-2 text-sm leading-[1.65]", MUTED)}>{copy}</p>
            </article></Reveal></li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="amaka-heading" className="overflow-hidden bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <SectionTitle centered id="amaka-heading" eyebrow="One account, many hands" title={<>Follow Amaka from first symptom <span className="text-brand-600">to feeling better.</span></>} copy="An illustrated example of how the pieces fit. Nobody asks her to repeat her story." className="mb-12" />
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-4">
            {amaka.map((moment, i) => <Reveal key={moment.title} delay={i * .06} className={moment.place}><figure>
              <div className="relative"><div aria-hidden className="absolute -inset-2 rotate-[-2deg] rounded-[30px] bg-[#e4efe7]" /><img src={moment.image} alt={moment.alt} loading="lazy" width={820} height={547} className="relative aspect-[3/2] w-full rounded-[26px] object-cover shadow-[0_18px_40px_-26px_rgba(11,43,32,.45)]" /><span aria-hidden className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-md">{i + 1}</span></div>
              <figcaption className="mt-4 px-1"><h3 className="text-lg font-bold tracking-[-0.02em]">{moment.title}</h3><p className={cn("mt-1 text-sm", MUTED)}>{moment.copy}</p></figcaption>
            </figure></Reveal>)}
            <Reveal className="flex flex-col justify-center rounded-[26px] bg-[#0b2b20] p-8 text-white sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:mt-14"><p className="font-display text-2xl font-bold leading-snug tracking-[-0.03em]">No paper folders.<br /><span className="text-brand-300">No starting from zero.</span></p><p className="mt-3 text-sm leading-6 text-white/65">Her visit, prescription and readings stay together in one account.</p><div className="mt-6"><TextLink light href={TELEMEDICINE_SIGN_IN_URL}>Open your account</TextLink></div></Reveal>
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><SectionTitle id="how-heading" eyebrow="Your first visit" title="From sign-up to seeing a doctor in three moves." copy="No app to install. Everything runs in your browser." /><TextLink href={TELEMEDICINE_SIGN_IN_URL}>Create a free account</TextLink></div>
          <ol className="grid gap-5 md:grid-cols-3">
            <Step n={1} title="Pick who you want to see" copy="Filter verified professionals by specialty and by whether they see you on video or in person."><FindVisual /></Step>
            <Step n={2} title="Choose a time that suits you" copy="Request one of their open slots. They confirm it, and it lands in your appointments."><CalendarVisual /></Step>
            <Step n={3} title="Talk face to face, from anywhere" copy="Your private room opens shortly before the appointment. Chat is built in for links and notes."><VideoVisual /></Step>
          </ol>
        </div>
      </section>

      <CareTeam />

      <section aria-labelledby="providers-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <SectionTitle centered id="providers-heading" eyebrow="For healthcare providers" title="Bring your practice onto Sabi." copy="Three products, one network: Sabi EMR runs the facility, Sabi Health brings the patients, and Sabi AI helps everyone make sense of health information." className="mb-10" />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ProviderCard image={providerHospital} alt="A hospital care team reviewing a chart together" label="Sabi EMR · hospitals & clinics" title="Every department, one patient chart." copy="Front desk, triage, consultation, laboratory, pharmacy, wards and billing — working from the same record, with each facility's data kept to itself." primary={{ label: "Explore Sabi EMR", to: "/products/emr" }} secondary={{ label: "Register your facility", to: "/register/organization" }} />
            <ProviderCard image={providerProfessional} alt="A doctor working on her tablet in a bright consulting room" label="Sabi Health · professionals" title="Practise online, once you're verified." copy="Publish your hours, accept bookings, see patients on video and keep care plans going between visits." primary={{ label: "Apply as a professional", href: DOCTOR_REGISTER_URL }} secondary={{ label: "Professional sign in", href: DOCTOR_SIGN_IN_URL }} />
            <AiProductCard />
          </div>
        </div>
      </section>

      <section aria-labelledby="start-heading" className="relative overflow-hidden bg-brand-800 text-white">
        <div aria-hidden className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/10" /><div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:px-10 lg:py-20">
          <Reveal><Eyebrow light>Free to sign up</Eyebrow><h2 id="start-heading" className="font-display text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">Better care starts<br />with one account.</h2><p className="mt-5 max-w-[420px] text-base leading-7 text-brand-50/80 sm:text-lg">Visits, prescriptions, readings and the people you look after — kept together, kept private.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Action variant="light" href={TELEMEDICINE_SIGN_IN_URL}>Create my account</Action><Action variant="ghost" href={TELEMEDICINE_SIGN_IN_URL}>I already have one</Action></div></Reveal>
          <Reveal delay={.1}><img src={ctaWellness} alt="A woman relaxing at home with her tablet, surrounded by plants" loading="lazy" width={1100} height={733} className="w-full rounded-[28px] border-4 border-white/15 object-cover shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]" /></Reveal>
        </div>
      </section>

      <section aria-labelledby="trust-heading" className="bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-[1160px] gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div><SectionTitle id="trust-heading" eyebrow="Privacy, by design" title="Your health data isn't a product." copy="We build the controls in from the start, and we don't claim certificates we haven't earned." /><div className="mt-6"><TextLink to="/security">How we protect your data</TextLink></div></div>
          <div className="grid grid-cols-2 gap-3">{([[LockKeyhole, "Need-to-know access", "Staff see only what their role requires."], [ShieldCheck, "Every change recorded", "Sensitive actions leave a trail."], [Network, "Facilities kept apart", "One hospital can't read another's records."], [BadgeCheck, "Checked professionals", "Licences reviewed before anyone sees patients."]] as const).map(([Icon, label, copy], i) => <Reveal key={label} delay={i * .05} className="h-full"><div className="h-full rounded-2xl border border-[#e3ebe5] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span><h3 className="mt-4 font-bold">{label}</h3><p className={cn("mt-1 text-sm leading-6", MUTED)}>{copy}</p></div></Reveal>)}</div>
        </div>
      </section>

      <Faq />
    </div>
  );
}

function HeroFigure() {
  const reduceMotion = useReducedMotion();
  const cards = [
    { icon: Video, tone: "bg-brand-50 text-brand-700", title: "Video visit", sub: "With a general practitioner", status: "Room opens at 10:30", place: "left-0 top-[9%] sm:left-[1%]" },
    { icon: HeartPulse, tone: "bg-[#f3eefa] text-[#6d5a91]", title: "Blood pressure", sub: "Logged from home", status: "Shared with your doctor", place: "right-0 top-[25%] sm:right-[1%]" },
    { icon: Pill, tone: "bg-[#fbece4] text-[#a4532c]", title: "Prescription", sub: "Two pharmacies quoted", status: "Choose and pay", place: "left-0 top-[58%] sm:top-[62%]" },
    { icon: Building2, tone: "bg-[#fdf5e6] text-[#8d6a2c]", title: "Hospital visit", sub: "At a Sabi EMR facility", status: "Request sent from your account", place: "right-0 top-[72%] sm:right-[1%]" },
  ];
  return (
    <motion.figure initial={reduceMotion ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12, duration: .7 }} aria-label="Illustration of a Sabi Health account linking a video visit, home readings, a prescription and a hospital visit" className="relative mx-auto mb-6 aspect-[0.92] w-full max-w-[590px]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-[15%] rounded-full bg-[#d6eadc]/70 blur-3xl" />
        <div className="absolute inset-[6%] rounded-[44%] border border-brand-700/10 motion-safe:animate-[spin_60s_linear_infinite]" />
        <div className="absolute inset-[18%] rounded-[40%] border border-dashed border-brand-700/15 motion-safe:animate-[spin_90s_linear_infinite_reverse]" />
        {["left-[22%] top-[14%]", "right-[20%] top-[46%]", "left-[18%] bottom-[22%]"].map((p) => <span key={p} className={cn("absolute h-2.5 w-2.5 rounded-full bg-brand-400", p)}><span className="absolute inset-0 rounded-full bg-brand-400 motion-safe:animate-pulse-ring" /></span>)}
      </div>
      <div className="absolute left-[24%] top-[3%] z-10 w-[52%] overflow-hidden rounded-[36px] border-[6px] border-white bg-white shadow-[0_28px_50px_-24px_rgba(11,43,32,.45)]"><img src={heroArt} alt="A doctor and a patient talking together during a consultation" width={760} height={1140} className="aspect-[2/3] h-full w-full object-cover" /></div>
      {cards.map(({ icon: Icon, tone, title, sub, status, place }, i) => <motion.div key={title} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 + i * .1 }} className={cn("absolute z-20 w-[43%] max-w-[220px]", place)}>
        <div className="rounded-2xl border border-[#dfe8e2] bg-white/95 p-2.5 shadow-[0_12px_32px_-16px_rgba(11,43,32,.28)] backdrop-blur sm:p-4">
          <div className="flex items-center gap-2 sm:gap-2.5"><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8", tone)}><Icon size={15} strokeWidth={1.6} /></span><p className="text-[10px] font-bold leading-tight sm:text-xs">{title}</p></div>
          <p className={cn("mt-3 hidden text-xs sm:block", MUTED)}>{sub}</p>
          <p className="mt-2 inline-flex rounded-full bg-[#eef6f0] px-2 py-1 text-[9px] font-semibold text-brand-800 sm:mt-3 sm:text-[11px]">{status}</p>
        </div>
      </motion.div>)}
      <figcaption className="absolute inset-x-0 -bottom-7 text-center text-[10px] tracking-wide text-[#7a8a82] sm:text-xs">A sample Sabi Health account</figcaption>
    </motion.figure>
  );
}

function Step({ n, title, copy, children }: { n: number; title: string; copy: string; children: ReactNode }) {
  return <li><Reveal delay={(n - 1) * .08} className="h-full"><div className="flex h-full flex-col rounded-[24px] border border-[#e3ebe5] bg-[#fcfefc] p-4">
    <div aria-hidden className="relative grid h-56 place-items-center overflow-hidden rounded-[18px] bg-[#eef5f0]">{children}</div>
    <div className="px-2 pb-2 pt-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Step {n}</p><h3 className="mt-1 text-xl font-bold tracking-[-0.02em]">{title}</h3><p className={cn("mt-2 text-sm leading-6", MUTED)}>{copy}</p></div>
  </div></Reveal></li>;
}

function FindVisual() {
  return <div className="w-[78%] space-y-2.5">
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs text-[#7a8a82] shadow-sm"><Search size={14} /> Specialty, name or language</div>
    {[["General practice", "Video · In person", true], ["Nutrition", "Video", false]].map(([label, mode, verified]) => <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound size={16} /></span><div className="flex-1"><span className="block text-[11px] font-bold">{String(label)}</span><span className="mt-0.5 block text-[10px] text-[#55685f]">{String(mode)}</span></div>{verified && <BadgeCheck size={16} className="text-brand-600" />}</div>)}
  </div>;
}

function CalendarVisual() {
  return <div className="w-[80%] rounded-xl bg-white p-3 shadow-sm">
    <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>Open slots</span><CalendarCheck size={14} className="text-brand-600" /></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[9px]">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="font-bold text-[#8a9a92]">{d}</span>)}{Array.from({ length: 14 }, (_, i) => <span key={i} className={cn("rounded-md py-1", i === 8 ? "bg-brand-600 font-bold text-white" : i % 3 === 0 ? "text-[#c3cec8]" : "text-[#55685f]")}>{i + 1}</span>)}</div>
    <div className="mt-2.5 flex gap-1.5 text-[10px] font-semibold">{["08:30", "10:30", "15:00"].map((t) => <span key={t} className={cn("flex-1 rounded-md border py-1 text-center", t === "10:30" ? "border-brand-500 bg-brand-50 text-brand-800" : "border-[#e3ebe5] text-[#55685f]")}>{t}</span>)}</div>
  </div>;
}

function VideoVisual() {
  return <div className="relative h-[78%] w-[80%] overflow-hidden rounded-xl bg-[#0b2b20]">
    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Private room</span>
    <div className="grid h-full place-items-center text-brand-200/60"><UserRound size={56} strokeWidth={1.2} /></div>
    <div className="absolute bottom-10 right-3 grid h-12 w-10 place-items-center rounded-md bg-[#174536] text-brand-200/60"><UserRound size={18} /></div>
    <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-2">{[Mic, PhoneOff, Video].map((Icon, i) => <span key={i} className={cn("grid h-6 w-6 place-items-center rounded-full", i === 1 ? "bg-[#d6553b] text-white" : "bg-white/15 text-white")}><Icon size={11} /></span>)}</div>
  </div>;
}

function CareTeam() {
  const row = useRef<HTMLUListElement>(null);
  const scroll = () => {
    const el = row.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + el.clientWidth * .8, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return <section aria-labelledby="team-heading" className="overflow-hidden bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
    <div className="mx-auto max-w-[1200px]">
      <SectionTitle id="team-heading" eyebrow="The people behind your care" title="Qualified professionals, verified first." copy="Nobody sees patients on Sabi Health until our team has reviewed their licence and credentials." className="mb-8" />
      <div className="relative">
        <ul ref={row} tabIndex={0} aria-label="Care team roles. Scroll to see more." className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-scrollbar]:hidden">
          {team.map(({ image, role, detail }) => <li key={role} className="relative aspect-[4/5] w-[78vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-[#e4efe7] sm:w-[270px]">
            <img src={image} alt="" loading="lazy" width={720} height={480} className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-4 backdrop-blur"><h3 className="font-bold leading-tight">{role}</h3><p className={cn("mt-1 text-xs", MUTED)}>{detail}</p></div>
          </li>)}
        </ul>
        <button type="button" onClick={scroll} aria-label="Show more roles" className="absolute -right-1 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-[#0b2b20] text-white shadow-lg transition hover:bg-brand-800 sm:grid"><ArrowRight size={18} /></button>
      </div>
      <div className="mt-6"><TextLink href={TELEMEDICINE_SIGN_IN_URL}>Browse professionals</TextLink></div>
    </div>
  </section>;
}

/** Sabi AI's card: a small sample exchange in place of a photograph, since the product is still opening. */
function AiProductCard() {
  return <Reveal className="h-full"><article className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[#e3ebe5] bg-[#fcfefc]">
    <div aria-hidden className="relative flex aspect-[16/9] w-full flex-col justify-center gap-2.5 overflow-hidden bg-[#f7f4ee] px-6">
      <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#0b2b20] px-3.5 py-2.5 text-[12px] leading-5 text-white"><span className="mb-1 flex items-center gap-1.5 text-[10px] text-white/70"><FileText size={11} /> blood-count-sample.pdf</span>Explain this report in plain language.</div>
      <div className="flex max-w-[86%] gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e6efe8] text-[#1f5c45]"><Sparkles size={12} /></span><p className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[12px] leading-5 text-[#0b2b20] shadow-sm">Haemoglobin is a little below the range printed on the report. Here's what that measure describes…</p></div>
      <span className="absolute bottom-3 right-4 text-[10px] font-semibold text-[#7a8a82]">Sample · fictional</span>
    </div>
    <div className="flex flex-1 flex-col p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Sabi AI · professionals, patients &amp; caregivers</p><h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-[-0.03em]">AI built for healthcare.</h3><p className={cn("mt-3 flex-1 text-sm leading-6", MUTED)}>Explore medical knowledge, make sense of complex reports and work through healthcare questions in clear language. Opening in stages.</p>
      <div className="mt-6 flex flex-wrap items-center gap-2"><Action to="/ai">Explore Sabi AI</Action><Link to="/ai#waitlist" className="px-2 py-2.5 text-sm font-bold text-brand-700 hover:text-brand-900">Join the waitlist</Link></div></div>
  </article></Reveal>;
}

type CardLink = { label: string; to?: string; href?: string };
function ProviderCard({ image, alt, label, title, copy, primary, secondary }: { image: string; alt: string; label: string; title: string; copy: string; primary: CardLink; secondary: CardLink }) {
  const secondaryCls = "px-2 py-2.5 text-sm font-bold text-brand-700 hover:text-brand-900";
  return <Reveal className="h-full"><article className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[#e3ebe5] bg-[#fcfefc]">
    <img src={image} alt={alt} loading="lazy" width={820} height={547} className="aspect-[16/9] w-full object-cover" />
    <div className="flex flex-1 flex-col p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">{label}</p><h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-[-0.03em]">{title}</h3><p className={cn("mt-3 flex-1 text-sm leading-6", MUTED)}>{copy}</p>
      <div className="mt-6 flex flex-wrap items-center gap-2"><Action to={primary.to} href={primary.href}>{primary.label}</Action>{secondary.to ? <Link to={secondary.to} className={secondaryCls}>{secondary.label}</Link> : <a href={secondary.href} className={secondaryCls}>{secondary.label}</a>}</div></div>
  </article></Reveal>;
}

function Faq() {
  const [open, setOpen] = useState(0);
  return <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
    <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[.8fr_1.2fr] lg:gap-16">
      <div className="md:sticky md:top-28 md:self-start"><Eyebrow>Before you sign up</Eyebrow><h2 id="faq-heading" className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.04em] sm:text-[42px]">Good questions,<br />straight answers.</h2>
        <div className="mt-6 max-w-[360px] rounded-2xl bg-[#0b2b20] p-6 text-white"><h3 className="text-lg font-bold">Rather talk to a person?</h3><p className="mb-4 mt-1 text-sm text-white/70">Call or WhatsApp the Sabi team.</p><ContactLines light /></div>
      </div>
      <div className="self-start overflow-hidden rounded-[24px] bg-[#f6f9f5]">
        {faqs.map(({ q, a }, i) => { const expanded = open === i; return <article key={q} className={cn("border-b border-[#e3ebe5] last:border-b-0 transition-colors", expanded && "bg-[#eaf4ed]")}>
          <h3><button id={`faq-q-${i}`} type="button" aria-expanded={expanded} aria-controls={`faq-a-${i}`} onClick={() => setOpen(expanded ? -1 : i)} className="flex w-full items-center gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"><span className="flex-1 text-[15px] font-bold leading-snug lg:text-[17px]">{q}</span><span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-brand-700">{expanded ? <Minus size={15} /> : <Plus size={15} />}</span></button></h3>
          <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!expanded}><p className={cn("max-w-[560px] px-5 pb-5 text-sm leading-[1.7]", MUTED)}>{a}</p></div>
        </article>; })}
      </div>
    </div>
  </section>;
}
