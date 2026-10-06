import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarCheck, ChevronDown, FlaskConical, HeartHandshake, HeartPulse, LockKeyhole, Mic, Minus, Network, PhoneOff, Pill, Plus, Salad, Search, ShieldCheck, Smile, Stethoscope, UserRound, Video } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { DOCTOR_REGISTER_URL, DOCTOR_SIGN_IN_URL, EMR_SIGN_IN_URL, PHARMACY_SIGN_IN_URL, TELEMEDICINE_SIGN_IN_URL } from "@/public/ecosystemLinks";
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
import providerPharmacy from "@/assets/landing/provider-pharmacy.webp";
import providerProfessional from "@/assets/landing/provider-professional.webp";
import ctaWellness from "@/assets/landing/cta-wellness.webp";

// Palette taken from the portal artwork: forest ink, sage surfaces, terracotta accent.
const INK = "text-[#0b2b20]";
const MUTED = "text-[#55685f]";

const careAreas = [
  { icon: Stethoscope, tone: "bg-brand-50 text-brand-700", title: "General consultations", copy: "Everyday symptoms, check-ins and routine questions with a qualified clinician." },
  { icon: HeartPulse, tone: "bg-[#fbece4] text-[#a4532c]", title: "Women's health", copy: "Reproductive, maternal and wellness care with privacy built in." },
  { icon: Smile, tone: "bg-[#eef3fb] text-[#41608a]", title: "Child & family care", copy: "Book for dependants and keep the whole family's care in one account." },
  { icon: FlaskConical, tone: "bg-[#f3eefa] text-[#6d5a91]", title: "Long-term conditions", copy: "Track vitals, care plans and follow-ups between appointments." },
  { icon: HeartHandshake, tone: "bg-[#fdf5e6] text-[#8d6a2c]", title: "Mental wellbeing", copy: "Confidential conversations with verified professionals." },
  { icon: Salad, tone: "bg-[#ecf6ee] text-[#3f7350]", title: "Nutrition & lifestyle", copy: "Guidance from nutrition professionals for healthier daily habits." },
];

const story = [
  { image: storyUnwell, alt: "A woman at home checking how she feels on her tablet", title: "“I haven't been feeling well.”", copy: "Start from your phone, wherever you are.", place: "lg:col-start-1 lg:row-start-1" },
  { image: storyDoctor, alt: "A doctor reviewing notes at her desk before a video consultation", title: "“Let's look at your symptoms.”", copy: "Consult a verified clinician by video.", place: "lg:col-start-2 lg:row-start-1 lg:mt-24" },
  { image: storyTests, alt: "A patient taking a blood-pressure reading at home", title: "Tests and readings", copy: "Results and vitals stay with your record.", place: "lg:col-start-3 lg:row-start-1" },
  { image: storyMedication, alt: "A patient organising her prescribed medication", title: "Get your medication", copy: "Send prescriptions to a partner pharmacy.", place: "lg:col-start-1 lg:row-start-2 lg:col-span-1 lg:ml-[18%]" },
  { image: storyMeal, alt: "A woman preparing a colourful, healthy meal", title: "Live a little healthier", copy: "Wellness and nutrition support between visits.", place: "lg:col-start-2 lg:row-start-2 lg:col-span-1 lg:mt-14 lg:ml-[18%]" },
];

const team = [
  { image: teamGp, role: "General practitioners", detail: "Consultations, referrals and follow-up" },
  { image: teamNutrition, role: "Nutrition professionals", detail: "Meal plans and lifestyle coaching" },
  { image: teamPharmacist, role: "Pharmacists", detail: "Prescription review and dispensing" },
  { image: teamNursing, role: "Hospital care teams", detail: "Check-in, admission and in-patient care" },
  { image: teamWellbeing, role: "Wellbeing professionals", detail: "Counselling and ongoing support" },
  { image: teamFamily, role: "Family care", detail: "Dependants managed from one account" },
];

const faqs = [
  { q: "What can I do with Sabi Health?", a: "Book video or in-person consultations with verified professionals, keep your health records and vitals in one place, manage prescriptions with partner pharmacies, and look after family members from the same account." },
  { q: "How do I book a consultation?", a: "Create a free patient account, choose a professional by specialty and availability, pick an open time and send your request. You'll see it confirmed in your appointments once the professional accepts." },
  { q: "Are video consultations private?", a: "Calls run in private rooms that open only for the patient and professional on that appointment, shortly before it starts. Recording and transcription are switched off." },
  { q: "How do professionals join?", a: "Doctors and other health professionals register, upload their credentials and are reviewed by the Sabi operations team. Only verified professionals can accept patients." },
  { q: "How does a hospital or pharmacy join?", a: "Organizations register through the shared onboarding workflow. Hospitals get Sabi OS (EMR, laboratory, pharmacy, billing and more); pharmacies get their own operator workspace." },
  { q: "What should I do in an emergency?", a: "Sabi Health is not an emergency service. If you or someone near you is in danger, call your local emergency number or go to the nearest emergency department immediately." },
];

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: .55, delay }}>{children}</motion.div>;
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={cn("mb-4 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em]", light ? "text-brand-100" : "text-[#55685f]")}><span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", light ? "bg-brand-200" : "bg-brand-600")} />{children}</p>;
}

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  return (
    <div className={INK}>
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden border-b border-[#0b2b20]/5 bg-[#f6f9f5]">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full bg-[radial-gradient(ellipse_at_78%_45%,#dff0e5_0%,transparent_62%)] lg:w-3/4" />
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-16 pt-14 sm:px-8 lg:min-h-[760px] lg:grid-cols-2 lg:gap-4 lg:px-10 lg:pb-20 lg:pt-16 xl:px-16">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} className="relative z-20 max-w-2xl">
            <Eyebrow>One connected healthcare ecosystem</Eyebrow>
            <h1 id="hero-heading" className="font-display text-[clamp(2.7rem,7.6vw,4.6rem)] font-semibold leading-[1.04] tracking-[-0.05em]">Healthcare,<br />intelligently<br /><span className="text-brand-600">connected.</span></h1>
            <p className={cn("mt-6 max-w-[500px] text-base leading-[1.8] sm:text-lg", MUTED)}>See a verified doctor by video, keep your records and prescriptions together, and reach hospitals and pharmacies that run on the same connected platform.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href={TELEMEDICINE_SIGN_IN_URL} className="inline-flex min-h-[52px] items-center gap-5 rounded-xl bg-[#0b2b20] px-6 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(11,43,32,.55)] transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4">Book a consultation <ArrowRight size={16} /></a>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold underline decoration-[#0b2b20]/20 underline-offset-[6px] hover:text-brand-700">Explore how it works <ChevronDown size={15} /></a>
            </div>
            <div className={cn("mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#0b2b20]/10 pt-6 text-sm font-medium", MUTED)}>
              <a href={DOCTOR_SIGN_IN_URL} className="inline-flex items-center gap-1.5 hover:text-brand-700">For professionals <ArrowRight size={13} /></a>
              <Link to="/register/organization" className="inline-flex items-center gap-1.5 hover:text-brand-700">For hospitals <ArrowRight size={13} /></Link>
              <a href={PHARMACY_SIGN_IN_URL} className="inline-flex items-center gap-1.5 hover:text-brand-700">For pharmacies <ArrowRight size={13} /></a>
            </div>
          </motion.div>
          <HeroFigure />
        </div>
      </section>

      {/* Areas of care */}
      <section id="care" aria-labelledby="care-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1160px]">
          <Reveal className="mb-10 max-w-[720px]"><Eyebrow>Specialist care, made accessible</Eyebrow><h2 id="care-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">The right care for different moments of life.</h2><p className={cn("mt-4 text-[15px] leading-relaxed", MUTED)}>Areas of care available from verified professionals on Sabi Health.</p></Reveal>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {careAreas.map(({ icon: Icon, tone, title, copy }, i) => <li key={title}><Reveal delay={i * .04} className="h-full"><article className="group h-full rounded-2xl border border-[#e3ebe5] bg-[#fcfefc] p-6 transition hover:border-brand-200 hover:shadow-[0_10px_28px_-18px_rgba(5,154,87,.45)]">
              <div className="mb-4 flex items-center justify-between"><span aria-hidden className={cn("grid h-10 w-10 place-items-center rounded-xl transition group-hover:-translate-y-0.5", tone)}><Icon size={19} strokeWidth={1.6} /></span><span aria-hidden className="text-[11px] tabular-nums tracking-[0.12em] text-[#8a9a92]">{String(i + 1).padStart(2, "0")}</span></div>
              <h3 className="text-xl font-bold leading-tight tracking-[-0.02em]">{title}</h3><p className={cn("mt-2 text-sm leading-[1.65]", MUTED)}>{copy}</p>
            </article></Reveal></li>)}
          </ul>
        </div>
      </section>

      {/* Care story */}
      <section aria-labelledby="story-heading" className="overflow-hidden bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto mb-12 max-w-[680px] text-center"><Eyebrow>Your healthcare, connected</Eyebrow><h2 id="story-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">Care for every <span className="text-brand-600">stage of the journey.</span></h2><p className={cn("mt-4 text-[15px] leading-relaxed", MUTED)}>From the first consultation to tests, medication and healthier habits, each step builds on the last.</p></Reveal>
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-4">
            {story.map((moment, i) => <Reveal key={moment.title} delay={i * .06} className={moment.place}><figure>
              <div className="relative"><div aria-hidden className="absolute -inset-2 -z-0 rotate-[-2deg] rounded-[30px] bg-[#e4efe7]" /><img src={moment.image} alt={moment.alt} loading="lazy" width={820} height={547} className="relative aspect-[3/2] w-full rounded-[26px] object-cover shadow-[0_18px_40px_-26px_rgba(11,43,32,.45)]" /><span aria-hidden className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-md">{i + 1}</span></div>
              <figcaption className="mt-4 px-1"><h3 className="text-lg font-bold tracking-[-0.02em]">{moment.title}</h3><p className={cn("mt-1 text-sm", MUTED)}>{moment.copy}</p></figcaption>
            </figure></Reveal>)}
            <Reveal className="flex flex-col justify-center rounded-[26px] bg-[#0b2b20] p-8 text-white sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:mt-14"><p className="font-display text-2xl font-bold leading-snug tracking-[-0.03em]">Accessible <span className="text-brand-300">·</span> Connected <span className="text-brand-300">·</span> Verified</p><p className="mt-3 text-sm leading-6 text-white/65">One account follows you between your doctor, pharmacy and hospital.</p><a href={TELEMEDICINE_SIGN_IN_URL} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-200 hover:text-white">Start your care journey <ArrowRight size={15} /></a></Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1160px]">
          <Reveal className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-[640px]"><Eyebrow>How Sabi Health works</Eyebrow><h2 id="how-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">Healthcare in three simple steps.</h2><p className={cn("mt-4 text-[15px] leading-relaxed", MUTED)}>Choose a professional, book a time, and connect through Sabi Health.</p></div><a href={TELEMEDICINE_SIGN_IN_URL} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-900">Get started <ArrowRight size={15} /></a></Reveal>
          <ol className="grid gap-5 md:grid-cols-3">
            <Step n={1} title="Find the right professional" copy="Browse verified professionals by specialty, availability and whether they offer video or in-person care."><FindVisual /></Step>
            <Step n={2} title="Book now or for later" copy="Pick an open slot that suits you. Your request is confirmed by the professional, and you're reminded before it starts."><CalendarVisual /></Step>
            <Step n={3} title="Meet by video" copy="Join a private video room from the browser a few minutes before your appointment — chat included, nothing to install."><VideoVisual /></Step>
          </ol>
        </div>
      </section>

      {/* Care team */}
      <CareTeam />

      {/* Providers */}
      <section id="providers" aria-labelledby="providers-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto mb-8 max-w-[700px] text-center"><Eyebrow>Who we work with</Eyebrow><h2 id="providers-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">One platform for every provider.</h2></Reveal>
          <ul className="mb-10 flex flex-wrap justify-center gap-2.5">{["Hospitals", "Clinics", "Doctors", "Health professionals", "Pharmacies", "Laboratories"].map((p) => <li key={p} className="inline-flex items-center gap-2 rounded-full border border-[#e3ebe5] bg-[#f6f9f5] px-4 py-2 text-sm font-semibold"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />{p}</li>)}</ul>
          <div className="grid gap-5 lg:grid-cols-3">
            <ProviderCard image={providerHospital} alt="A hospital care team reviewing a patient chart together" label="Sabi OS for hospitals" title="Run your whole facility on one system." copy="EMR, queue, laboratory, pharmacy, in-patient care, billing, HR and accounting — isolated per organization." primary={{ label: "Register organization", to: "/register/organization" }} secondary={{ label: "Hospital sign in", href: EMR_SIGN_IN_URL }} />
            <ProviderCard image={providerProfessional} alt="A doctor working on her tablet in a bright consulting room" label="Professional portal" title="Practise online, verified." copy="Publish availability, accept bookings, consult by video and manage care plans after credential review." primary={{ label: "Join as a professional", href: DOCTOR_REGISTER_URL }} secondary={{ label: "Professional sign in", href: DOCTOR_SIGN_IN_URL }} />
            <ProviderCard image={providerPharmacy} alt="A pharmacist preparing an order at the pharmacy counter" label="Pharmacy portal" title="Fulfil prescriptions with confidence." copy="Review prescriptions, send quotes, dispense and manage stock across branches in your own workspace." primary={{ label: "Pharmacy sign in", href: PHARMACY_SIGN_IN_URL }} secondary={{ label: "How it works", to: "/solutions/pharmacies" }} />
          </div>
        </div>
      </section>

      {/* Get started band */}
      <section aria-labelledby="start-heading" className="relative overflow-hidden bg-brand-800 text-white">
        <div aria-hidden className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/10" /><div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:px-10 lg:py-20">
          <Reveal><Eyebrow light>Get started with Sabi Health</Eyebrow><h2 id="start-heading" className="font-display text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">Your care,<br />on your terms.</h2><p className="mt-5 max-w-[420px] text-base leading-7 text-brand-50/80 sm:text-lg">Consultations, records, prescriptions and family care — together in one account.</p>
            <div className="mt-8 flex flex-wrap gap-3"><a href={TELEMEDICINE_SIGN_IN_URL} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#0b2b20] transition hover:bg-brand-50">Create a free account <ArrowRight size={16} /></a><a href={TELEMEDICINE_SIGN_IN_URL} className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-5 text-sm font-bold text-white transition hover:bg-white/10">Patient sign in</a></div></Reveal>
          <Reveal delay={.1}><img src={ctaWellness} alt="A woman relaxing at home with her tablet, surrounded by plants" loading="lazy" width={1100} height={733} className="w-full rounded-[28px] border-4 border-white/15 object-cover shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]" /></Reveal>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust-heading" className="bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-[1160px] gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <Reveal><Eyebrow>Security & privacy</Eyebrow><h2 id="trust-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[40px]">Trust is part of the architecture.</h2><p className={cn("mt-4 text-[15px] leading-relaxed", MUTED)}>Role-based access, tenant isolation, audit trails and verified professionals guide how the platform is built.</p><Link to="/security" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-900">Review our principles <ArrowRight size={15} /></Link></Reveal>
          <div className="grid grid-cols-2 gap-3">{[[LockKeyhole, "Access control", "Each person sees only what their role allows."], [ShieldCheck, "Auditability", "Sensitive actions leave a reviewable trail."], [Network, "Tenant isolation", "Every organization's records are kept separate."], [UserRound, "Verified professionals", "Credentials are reviewed before patients are seen."]].map(([Icon, label, copy], i) => { const C = Icon as typeof LockKeyhole; return <Reveal key={String(label)} delay={i * .05} className="h-full"><div className="h-full rounded-2xl border border-[#e3ebe5] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><C size={18} /></span><h3 className="mt-4 font-bold">{String(label)}</h3><p className={cn("mt-1 text-sm leading-6", MUTED)}>{String(copy)}</p></div></Reveal>; })}</div>
          <p className="text-xs leading-5 text-[#7a8a82] lg:col-span-2">Compliance depends on configuration, hosting, organizational procedures and applicable regulatory requirements. No certification is implied.</p>
        </div>
      </section>

      <Faq />
    </div>
  );
}

function HeroFigure() {
  const reduceMotion = useReducedMotion();
  const cards = [
    { icon: Video, tone: "bg-brand-50 text-brand-700", title: "Doctor consultation", sub: "General practitioner", status: "Video appointment", place: "left-0 top-[10%] sm:left-[1%]" },
    { icon: FlaskConical, tone: "bg-[#f3eefa] text-[#6d5a91]", title: "Test results", sub: "Shared with your doctor", status: "Added to your record", place: "right-0 top-[26%] sm:right-[1%]" },
    { icon: Pill, tone: "bg-[#fbece4] text-[#a4532c]", title: "Pharmacy", sub: "Your prescription", status: "Quote received", place: "left-0 top-[58%] sm:top-[62%]" },
    { icon: Building2, tone: "bg-[#fdf5e6] text-[#8d6a2c]", title: "Hospital care", sub: "Follow-up visit", status: "Checked in", place: "right-0 top-[72%] sm:right-[1%]" },
  ];
  return (
    <motion.figure initial={reduceMotion ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12, duration: .7 }} aria-label="Illustration of Sabi Health connecting consultations, test results, pharmacy and hospital care" className="relative mx-auto mb-6 aspect-[0.92] w-full max-w-[590px]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-[15%] rounded-full bg-[#d6eadc]/70 blur-3xl" />
        <div className="absolute inset-x-[4%] inset-y-[12%] rounded-full border border-brand-700/10" />
        <div className="absolute inset-x-[15%] inset-y-[22%] rounded-full border border-brand-700/10" />
        <svg viewBox="0 0 590 640" fill="none" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><g stroke="#9cc3ab" strokeDasharray="3 5"><path d="M125 120H200Q225 120 225 145V245H295" /><path d="M470 225H395Q370 225 370 250V310H295" /><path d="M120 430H205Q230 430 230 405V370H295" /><path d="M470 520H390Q365 520 365 495V430H295" /></g><g fill="#f6f9f5" stroke="#9cc3ab"><circle cx="125" cy="120" r="4" /><circle cx="470" cy="225" r="4" /><circle cx="120" cy="430" r="4" /><circle cx="470" cy="520" r="4" /></g></svg>
      </div>
      <div className="absolute left-[24%] top-[3%] z-10 w-[52%] overflow-hidden rounded-[36px] border-[6px] border-white bg-white shadow-[0_28px_50px_-24px_rgba(11,43,32,.45)]"><img src={heroArt} alt="A doctor and patient talking together during a consultation" width={760} height={1140} className="aspect-[2/3] h-full w-full object-cover" /></div>
      {cards.map(({ icon: Icon, tone, title, sub, status, place }, i) => <motion.div key={title} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 + i * .1 }} className={cn("absolute z-20 w-[43%] max-w-[220px]", place)}>
        <div className="rounded-xl border border-[#dfe8e2] bg-white/95 p-2.5 shadow-[0_12px_32px_-16px_rgba(11,43,32,.28)] sm:p-4">
          <div className="flex items-center gap-2 sm:gap-2.5"><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md sm:h-8 sm:w-8", tone)}><Icon size={15} strokeWidth={1.6} /></span><p className="text-[10px] font-bold leading-tight sm:text-xs">{title}</p></div>
          <p className={cn("mt-3 hidden text-xs sm:block", MUTED)}>{sub}</p>
          <div className="mt-2 flex items-center gap-1.5 border-t border-[#0b2b20]/[.06] pt-2 sm:mt-3 sm:pt-3"><span aria-hidden className="h-1 w-1 rounded-full bg-brand-500" /><p className={cn("text-[9px] font-medium sm:text-[11px]", MUTED)}>{status}</p></div>
        </div>
      </motion.div>)}
      <figcaption className="absolute inset-x-0 -bottom-7 text-center text-[10px] tracking-wide text-[#7a8a82] sm:text-xs">Connected care, in one place <span aria-hidden className="px-1">·</span> Illustrative experience</figcaption>
    </motion.figure>
  );
}

function Step({ n, title, copy, children }: { n: number; title: string; copy: string; children: ReactNode }) {
  return <li><Reveal delay={(n - 1) * .08} className="h-full"><div className="flex h-full flex-col rounded-[24px] border border-[#e3ebe5] bg-[#fcfefc] p-4">
    <div aria-hidden className="relative grid h-56 place-items-center overflow-hidden rounded-[18px] bg-[#eef5f0]"><span className="absolute left-4 top-3 font-display text-4xl font-bold text-brand-700/15">{String(n).padStart(2, "0")}</span>{children}</div>
    <div className="px-2 pb-2 pt-5"><h3 className="text-xl font-bold tracking-[-0.02em]">{title}</h3><p className={cn("mt-2 text-sm leading-6", MUTED)}>{copy}</p></div>
  </div></Reveal></li>;
}

function FindVisual() {
  return <div className="w-[78%] space-y-2.5">
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs text-[#7a8a82] shadow-sm"><Search size={14} /> Find a professional</div>
    {[["General practice", true], ["Nutrition", false]].map(([label, live]) => <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound size={16} /></span><div className="flex-1"><span className="block h-2 w-20 rounded bg-[#dfe8e2]" /><span className="mt-1.5 block text-[10px] font-semibold text-[#55685f]">{String(label)}</span></div>{live && <span className="h-2 w-2 rounded-full bg-brand-500 ring-4 ring-brand-100" />}</div>)}
  </div>;
}

function CalendarVisual() {
  return <div className="w-[80%] rounded-xl bg-white p-3 shadow-sm">
    <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>Your appointment</span><CalendarCheck size={14} className="text-brand-600" /></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[9px]">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="font-bold text-[#8a9a92]">{d}</span>)}{Array.from({ length: 14 }, (_, i) => <span key={i} className={cn("rounded-md py-1", i === 9 ? "bg-brand-600 font-bold text-white" : "text-[#55685f]")}>{i + 1}</span>)}</div>
    <div className="mt-2.5 flex gap-1.5 text-[10px] font-semibold">{["09:00", "10:30", "14:00"].map((t) => <span key={t} className={cn("flex-1 rounded-md border py-1 text-center", t === "10:30" ? "border-brand-500 bg-brand-50 text-brand-800" : "border-[#e3ebe5] text-[#55685f]")}>{t}</span>)}</div>
  </div>;
}

function VideoVisual() {
  return <div className="relative h-[78%] w-[80%] overflow-hidden rounded-xl bg-[#0b2b20]">
    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Connected</span>
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
      <Reveal className="mb-8 max-w-[640px]"><Eyebrow>Your care team</Eyebrow><h2 id="team-heading" className="font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">Qualified professionals, verified first.</h2><p className={cn("mt-4 text-[15px] leading-relaxed", MUTED)}>Every professional on Sabi Health has their credentials reviewed before they can accept patients.</p></Reveal>
      <div className="relative">
        <ul ref={row} tabIndex={0} aria-label="Care team roles. Scroll to see more." className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-scrollbar]:hidden">
          {team.map(({ image, role, detail }) => <li key={role} className="relative aspect-[4/5] w-[78vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-[#e4efe7] sm:w-[270px]">
            <img src={image} alt="" loading="lazy" width={720} height={480} className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-4 backdrop-blur"><h3 className="font-bold leading-tight">{role}</h3><p className={cn("mt-1 text-xs", MUTED)}>{detail}</p></div>
          </li>)}
        </ul>
        <button type="button" onClick={scroll} aria-label="Show more care team roles" className="absolute -right-1 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-[#0b2b20] text-white shadow-lg transition hover:bg-brand-800 sm:grid"><ArrowRight size={18} /></button>
      </div>
      <a href={TELEMEDICINE_SIGN_IN_URL} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-900">Find a professional <ArrowRight size={15} /></a>
    </div>
  </section>;
}

type CardLink = { label: string; to?: string; href?: string };
function CardAction({ link, primary }: { link: CardLink; primary?: boolean }) {
  const cls = primary ? "inline-flex items-center gap-2 rounded-xl bg-[#0b2b20] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800" : "inline-flex items-center rounded-xl px-2 py-2.5 text-sm font-bold text-brand-700 hover:text-brand-900";
  const body = <>{link.label}{primary && <ArrowRight size={15} />}</>;
  return link.href ? <a href={link.href} className={cls}>{body}</a> : <Link to={link.to!} className={cls}>{body}</Link>;
}

function ProviderCard({ image, alt, label, title, copy, primary, secondary }: { image: string; alt: string; label: string; title: string; copy: string; primary: CardLink; secondary: CardLink }) {
  return <Reveal className="h-full"><article className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[#e3ebe5] bg-[#fcfefc]">
    <img src={image} alt={alt} loading="lazy" width={820} height={547} className="aspect-[16/10] w-full object-cover" />
    <div className="flex flex-1 flex-col p-6"><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700"><Building2 size={13} />{label}</p><h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-[-0.03em]">{title}</h3><p className={cn("mt-3 flex-1 text-sm leading-6", MUTED)}>{copy}</p><div className="mt-6 flex flex-wrap items-center gap-2"><CardAction link={primary} primary /><CardAction link={secondary} /></div></div>
  </article></Reveal>;
}

function Faq() {
  const [open, setOpen] = useState(0);
  return <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
    <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[.8fr_1.2fr] lg:gap-16">
      <div className="md:sticky md:top-28 md:self-start"><Eyebrow>FAQ</Eyebrow><h2 id="faq-heading" className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.04em] sm:text-[42px]">Questions about Sabi Health?<br />Start here.</h2><p className={cn("mt-4 max-w-[360px] text-sm leading-[1.7]", MUTED)}>Consultations, accounts, privacy and how providers join.</p>
        <div className="mt-6 max-w-[360px] rounded-2xl bg-[#0b2b20] p-6 text-white"><h3 className="text-lg font-bold">Still need help?</h3><p className="mt-1 text-sm text-white/70">Talk to the Sabi team about your organization.</p><Link to="/book-demo" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-200 hover:text-white">Contact us <ArrowRight size={15} /></Link></div>
      </div>
      <div className="self-start overflow-hidden rounded-[24px] bg-[#f6f9f5]">
        {faqs.map(({ q, a }, i) => { const expanded = open === i; return <article key={q} className={cn("border-b border-[#e3ebe5] last:border-b-0 transition-colors", expanded && "bg-[#eaf4ed]")}>
          <h3><button id={`faq-q-${i}`} type="button" aria-expanded={expanded} aria-controls={`faq-a-${i}`} onClick={() => setOpen(expanded ? -1 : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-brand-700">{String(i + 1).padStart(2, "0")}</span><span className="flex-1 text-[15px] font-bold leading-snug lg:text-[17px]">{q}</span><span aria-hidden className="text-brand-700">{expanded ? <Minus size={16} /> : <Plus size={16} />}</span></button></h3>
          <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!expanded}><p className={cn("max-w-[520px] pb-5 pl-[60px] pr-5 text-sm leading-[1.7]", MUTED)}>{a}</p></div>
        </article>; })}
      </div>
    </div>
  </section>;
}
