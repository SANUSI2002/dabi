import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, Baby, BadgeCheck, BedDouble, Building2, CalendarClock, ClipboardCheck, Clock3, FileLock2, Fingerprint, FlaskConical, GitBranch, HeartPulse, History, Hospital, KeyRound, Laptop, LockKeyhole, Minus, Network, Pill, Plus, ReceiptText, Repeat2, ScanSearch, ShieldCheck, Sparkles, Stethoscope, UserCheck, Users, Video } from "lucide-react";
import { PRODUCTS, modulesByProduct, type ProductKey } from "@/platform/entitlements";
import { cn } from "@/lib/cn";
import Timeline, { type TimelineMilestone } from "@/components/ui/timeline";
import { ImageStreamHero } from "@/components/ui/image-stream-hero";
import { ProductWindow } from "@/public/components";
import { CONTACT_LINES, telUrl, whatsappUrl } from "@/public/contact";
import { DOCTOR_REGISTER_URL, DOCTOR_SIGN_IN_URL, EMR_SIGN_IN_URL, PHARMACY_SIGN_IN_URL, TELEMEDICINE_SIGN_IN_URL } from "@/public/ecosystemLinks";
import { Action, ContactLines, CtaBand, Eyebrow, INK, MUTED, PageHero, Reveal, SectionTitle, TextLink, WhatsAppGlyph } from "@/public/ui";
import providerHospital from "@/assets/landing/provider-hospital.webp";
import providerProfessional from "@/assets/landing/provider-professional.webp";
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
import ctaWellness from "@/assets/landing/cta-wellness.webp";

const primaryLine = CONTACT_LINES[0];

/* ───────────────────────────── Sabi EMR ───────────────────────────── */

const hospitalDay: TimelineMilestone[] = [
  { id: "front-desk", heading: "08:02 · Front desk", content: "Returning patient found by phone or name in seconds; new patients registered once, with duplicate checks." },
  { id: "triage", heading: "08:15 · Triage", content: "Vitals, MUAC and reported allergies captured, then the patient joins the doctor's live queue." },
  { id: "consult", heading: "08:40 · Consultation", content: "History, examination and an ICD-11 coded diagnosis, with lab and drug orders sent in the same note." },
  { id: "lab", heading: "09:10 · Laboratory", content: "Sample, result, review — abnormal results go back to the requesting doctor, not into a drawer." },
  { id: "pharmacy", heading: "09:55 · Pharmacy", content: "Prescriptions arrive itemised; the pharmacist checks, dispenses and stock moves by itself." },
  { id: "ward", heading: "10:30 · Ward", content: "Admitted to a named bed, with nursing observations and a medication chart that records every dose." },
  { id: "discharge", heading: "Next day · Discharge", content: "Outcome recorded, bed freed and the stay documented end to end. No chasing paper at the exit." },
];

const emrWins = [
  { before: "Files go missing between departments", after: "One chart per patient, open wherever the patient is", icon: ClipboardCheck },
  { before: "Nobody knows how long the queue is", after: "A live queue for every clinic and doctor", icon: Clock3 },
  { before: "Services given but never billed", after: "Every order and dispense is traceable for billing", icon: ReceiptText },
  { before: "Two people edit a record; one change is lost", after: "Conflicting edits are caught, never silently overwritten", icon: Repeat2 },
];

const emrFaqs = [
  { q: "Do we need servers or installation?", a: "No. Sabi EMR runs in the browser on the computers, laptops and tablets you already have. We host it; you sign in." },
  { q: "Can we start with only a few departments?", a: "Yes. Modules are switched on per facility, so you can begin with the front desk and consultation and add laboratory, pharmacy, wards or billing when you're ready." },
  { q: "Is our data separate from other hospitals?", a: "Yes. Every facility is its own workspace, and the server scopes every request to it — separation isn't just hidden in the interface." },
  { q: "What does getting started involve?", a: "You apply online, upload your facility's registration documents, we verify them, and your administrator sets up the workspace and invites staff with the right roles." },
  { q: "We have more than one branch. Does that work?", a: "Yes. Branches sit under one organization, with staff and permissions managed centrally." },
  { q: "How much does it cost?", a: "We're finalising our published plans. Call or WhatsApp us and we'll put together a quote for your facility today." },
];

export function EmrPage() {
  const [product, setProduct] = useState<ProductKey>("emr");
  const productDef = PRODUCTS[product];
  return <div className={INK}>
    <section aria-labelledby="emr-heading" className="relative overflow-hidden bg-[#0b2b20] text-white">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(47,221,138,.16),transparent_55%),radial-gradient(ellipse_at_10%_90%,rgba(255,255,255,.06),transparent_50%)]" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:py-24">
        <Reveal>
          <Eyebrow light>Sabi EMR · for hospitals and clinics</Eyebrow>
          <h1 id="emr-heading" className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.4rem)] font-semibold leading-[1.04] tracking-[-0.05em]">Your whole hospital,<br /><span className="text-brand-300">on one calm screen.</span></h1>
          <p className="mt-6 max-w-[540px] text-base leading-[1.8] text-white/70 sm:text-lg">From the front desk to discharge, every department works from the same patient chart — so care moves faster, nothing goes unbilled and your records finally stay put.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Action variant="light" to="/register/organization">Register your facility</Action><Action variant="ghost" href={whatsappUrl(primaryLine, "Hello Sabi, I'd like a demo of Sabi EMR for my facility.")}><WhatsAppGlyph className="h-4 w-4" />Book a demo on WhatsApp</Action></div>
          <p className="mt-6 text-sm text-white/55">Already on Sabi? <a href={EMR_SIGN_IN_URL} className="font-bold text-brand-200 hover:text-white">Sign in to your workspace</a></p>
        </Reveal>
        <Reveal delay={.1}><ProductWindow /></Reveal>
      </div>
      <div className="relative border-t border-white/10"><ul className="mx-auto flex max-w-[1400px] flex-wrap justify-center gap-x-8 gap-y-3 px-5 py-6 text-sm font-semibold text-white/60 sm:px-8 lg:px-10">{[[Users, "Registration & queue"], [Stethoscope, "Consultation"], [FlaskConical, "Laboratory"], [Pill, "Pharmacy"], [BedDouble, "Wards & nursing"], [ReceiptText, "Billing"], [Baby, "Maternal & child health"]].map(([Icon, label]) => { const C = Icon as typeof Users; return <li key={String(label)} className="inline-flex items-center gap-2"><C size={15} className="text-brand-300" />{String(label)}</li>; })}</ul></div>
    </section>

    <section aria-labelledby="wins-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1160px]">
        <SectionTitle id="wins-heading" eyebrow="What changes on day one" title="Fix the problems your staff already complain about." className="mb-10" />
        <div className="grid gap-4 md:grid-cols-2">{emrWins.map(({ before, after, icon: Icon }, i) => <Reveal key={before} delay={i * .05}><article className="flex h-full gap-5 rounded-[22px] border border-[#e3ebe5] bg-[#fcfefc] p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={21} /></span>
          <div><p className="text-sm text-[#8a9a92] line-through decoration-[#d6553b]/60">{before}</p><p className="mt-2 text-lg font-bold leading-snug tracking-[-0.02em]">{after}</p></div>
        </article></Reveal>)}</div>
      </div>
    </section>

    <Timeline id="hospital-day" title="A patient's morning at a Sabi hospital" periodLabel="One visit · every department" milestones={hospitalDay} imageUrl={providerHospital} imageAlt="A hospital care team reviewing a patient's chart together" />

    <section aria-labelledby="modules-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1300px]">
        <SectionTitle id="modules-heading" eyebrow="Pick what you need" title="Switch on modules as your facility grows." copy="These are the actual modules in our catalogue. Each facility gets only what it has signed up for." className="mb-10" />
        <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
          <div role="tablist" aria-label="Sabi products" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">{(Object.keys(PRODUCTS) as ProductKey[]).map((key) => <button key={key} role="tab" aria-selected={product === key} onClick={() => setProduct(key)} className={cn("min-w-[200px] rounded-2xl border p-4 text-left transition lg:min-w-0", product === key ? "border-brand-400 bg-brand-50 shadow-sm" : "border-[#e3ebe5] bg-white hover:border-brand-200")}><b className="block font-display">{PRODUCTS[key].label}</b><span className={cn("mt-1 block text-xs leading-5", MUTED)}>{PRODUCTS[key].tagline}</span></button>)}</div>
          <div role="tabpanel" className="rounded-[28px] bg-[#f6f9f5] p-6 sm:p-9"><h3 className="font-display text-3xl font-bold tracking-[-0.03em]">{productDef.label}</h3><p className={cn("mt-2 max-w-2xl text-sm leading-6", MUTED)}>{productDef.description}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modulesByProduct(product).map((module) => <div key={module.key} className="rounded-2xl border border-[#e3ebe5] bg-white p-4"><div className="flex items-center justify-between gap-2"><b className="text-sm">{module.label}</b>{module.core && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-800">Included</span>}</div><p className={cn("mt-2 text-xs leading-5", MUTED)}>{module.description}</p></div>)}</div>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="control-heading" className="bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div><SectionTitle id="control-heading" eyebrow="Built for administrators" title="Stay in control without standing over everyone." copy="Give each person exactly the access their job needs, see who did what, and grow across branches without starting again." /><div className="mt-6"><TextLink to="/security">Read how we keep data safe</TextLink></div></div>
        <div className="grid gap-3 sm:grid-cols-2">{([[UserCheck, "Roles that match real jobs", "Front desk, nurse, doctor, lab scientist, pharmacist — each sees their own work."], [History, "A full activity trail", "Clinical and admin changes are recorded with who and when."], [GitBranch, "Many branches, one organization", "Run several sites with central staff and settings."], [Repeat2, "Double-taps don't double-charge", "Repeated submissions are recognised and applied once."]] as const).map(([Icon, title, copy], i) => <Reveal key={title} delay={i * .05} className="h-full"><div className="h-full rounded-2xl border border-[#e3ebe5] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span><h3 className="mt-4 font-bold">{title}</h3><p className={cn("mt-1 text-sm leading-6", MUTED)}>{copy}</p></div></Reveal>)}</div>
      </div>
    </section>

    <section aria-labelledby="golive-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1160px]">
        <SectionTitle centered id="golive-heading" eyebrow="Going live" title="From application to first patient." copy="A guided path, with a person from our team on the phone whenever you need one." className="mb-12" />
        <ol className="relative grid gap-6 md:grid-cols-4">
          <div aria-hidden className="absolute left-[12%] right-[12%] top-7 hidden h-px bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 md:block" />
          {[["Apply", "Tell us about your facility online in a few minutes."], ["Verify", "Upload your registration documents for review."], ["Set up", "Your administrator configures departments and invites staff."], ["Go live", "Start registering patients — we stay on hand as you settle in."]].map(([title, copy], i) => <Reveal key={title} delay={i * .06}><li className="relative text-center"><span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-[#0b2b20] font-display text-lg font-bold text-white shadow-md">{i + 1}</span><h3 className="mt-4 text-lg font-bold">{title}</h3><p className={cn("mx-auto mt-1 max-w-[220px] text-sm leading-6", MUTED)}>{copy}</p></li></Reveal>)}
        </ol>
      </div>
    </section>

    <FaqBlock id="emr-faq" eyebrow="Questions hospitals ask" title={<>Before you<br />switch systems.</>} items={emrFaqs} />

    <CtaBand eyebrow="Ready when you are" title="See Sabi EMR running with your own departments." copy="Book a walkthrough and we'll set it up around how your facility actually works." actions={<><Action variant="light" to="/register/organization">Register your facility</Action><Action variant="ghost" href={telUrl(primaryLine)}>Call {primaryLine.display}</Action></>} />
  </div>;
}

/* ─────────────────────────── Sabi Health telemedicine ─────────────────────────── */

const streamImages = [storyUnwell, teamGp, storyDoctor, teamNutrition, storyTests, teamPharmacist, storyMedication, teamWellbeing, storyMeal, teamFamily, teamNursing, ctaWellness].map((src) => ({ src }));

const patientJourney: TimelineMilestone[] = [
  { id: "sign-up", heading: "Sign up", content: "Create a free account in a couple of minutes. Add family members whenever you like." },
  { id: "find", heading: "Find someone", content: "Browse verified professionals by specialty, and by video or in-person visits." },
  { id: "request", heading: "Request a time", content: "Pick one of their open slots and tell them briefly what it's about." },
  { id: "confirm", heading: "Get confirmed", content: "The professional accepts, and the visit appears in your appointments." },
  { id: "visit", heading: "Meet on video", content: "Join a private room from your browser; it opens shortly before your time." },
  { id: "prescription", heading: "Prescription", content: "If you need medicine, partner pharmacies send quotes and you choose one." },
  { id: "follow-up", heading: "Follow-up", content: "Care plans, readings and notes keep the conversation going after the call." },
];

const telemedicineFeatures = [
  { icon: Video, title: "Video visits", copy: "Private rooms in your browser, with in-call chat. Recording is off." },
  { icon: Hospital, title: "In-person bookings", copy: "Prefer to be seen? Book an in-person visit with professionals who offer one." },
  { icon: Pill, title: "Prescriptions & pharmacy", copy: "Receive prescriptions in your account and compare quotes from partner pharmacies." },
  { icon: Users, title: "Family accounts", copy: "Look after children and dependants from your own login." },
  { icon: HeartPulse, title: "Home readings", copy: "Log blood pressure and other vitals and keep a running history." },
  { icon: ClipboardCheck, title: "Care plans", copy: "Plans from your professional, shared only with your consent." },
];

const telemedicineFaqs = [
  { q: "Do I need to download an app?", a: "No. Sabi Health works in the browser on your phone or computer." },
  { q: "Can I book lab tests?", a: "Not yet — patient lab booking is coming. For now, your professional can advise where to go, and hospitals on Sabi EMR run their own labs." },
  { q: "Are the professionals real and qualified?", a: "Every professional submits their licence and credentials, and our team reviews them before they can accept patients." },
  { q: "Can someone else join my video visit?", a: "Rooms are tied to the appointment, so only the patient and the professional on it can enter." },
  { q: "Can I use it for my children?", a: "Yes. Add them as dependants and book on their behalf from your account." },
];

export function TelemedicinePage() {
  return <div className={INK}>
    <ImageStreamHero images={streamImages} imagePosition="68% center" speed={22} className="h-[640px] bg-[#0b2b20] sm:h-[720px]" aria-labelledby="tele-heading">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0b2b20_0%,rgba(11,43,32,.82)_22%,rgba(11,43,32,0)_48%,rgba(11,43,32,0)_70%,#0b2b20_100%)]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-5 py-12 text-center text-white sm:py-16">
        <Reveal><Eyebrow light className="justify-center">Sabi Health · telemedicine</Eyebrow><h1 id="tele-heading" className="mx-auto max-w-3xl text-balance font-display text-[clamp(2.3rem,6vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.05em]">See a doctor without<br /><span className="text-brand-300">leaving the house.</span></h1></Reveal>
        <Reveal delay={.1} className="max-w-xl"><p className="text-balance text-base leading-7 text-white/80 sm:text-lg">Verified professionals on video, prescriptions sent to a pharmacy, and your family's care in one account.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Action variant="light" href={TELEMEDICINE_SIGN_IN_URL}>Create a free account</Action><Action variant="ghost" href={TELEMEDICINE_SIGN_IN_URL}>Sign in</Action></div></Reveal>
      </div>
    </ImageStreamHero>

    <section aria-labelledby="features-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1160px]">
        <SectionTitle id="features-heading" eyebrow="In your account" title="Everything a good visit needs — and what happens after." className="mb-10" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{telemedicineFeatures.map(({ icon: Icon, title, copy }, i) => <li key={title}><Reveal delay={i * .04} className="h-full"><article className="h-full rounded-2xl border border-[#e3ebe5] bg-[#fcfefc] p-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={20} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className={cn("mt-2 text-sm leading-6", MUTED)}>{copy}</p></article></Reveal></li>)}
          <li><Reveal className="h-full"><article className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-[#c9d8ce] bg-[#f6f9f5] p-6"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf5e6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8d6a2c]"><Sparkles size={12} />Coming soon</span><h3 className="mt-4 text-lg font-bold">Lab test booking</h3><p className={cn("mt-2 text-sm leading-6", MUTED)}>Booking laboratory tests from your account isn't available yet. We'll announce it here when it is.</p></div></article></Reveal></li>
        </ul>
      </div>
    </section>

    <Timeline id="patient-journey" title="Your visit, start to finish" periodLabel="Seven steps · one account" milestones={patientJourney} imageUrl={heroArt} imageAlt="A doctor and patient talking together" />

    <section aria-labelledby="pros-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-2">
        <Reveal><img src={providerProfessional} alt="A doctor working on her tablet in a consulting room" loading="lazy" width={820} height={547} className="w-full rounded-[28px] object-cover shadow-[0_24px_50px_-28px_rgba(11,43,32,.5)]" /></Reveal>
        <div>
          <SectionTitle id="pros-heading" eyebrow="For doctors and health professionals" title="Your practice, without the rent." copy="Doctors, nurses, nutrition and wellbeing professionals can see patients on Sabi Health once their credentials are approved." />
          <ol className="mt-7 space-y-4">{[["Apply", "Create your professional account and confirm your email."], ["Upload credentials", "Licence and supporting documents go to private, scanned storage."], ["Get reviewed", "Our team checks them; you'll hear back by email."], ["Publish your hours", "Set availability, accept bookings and start consulting."]].map(([title, copy], i) => <li key={title} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0b2b20] text-xs font-bold text-white">{i + 1}</span><div><b>{title}</b><p className={cn("text-sm leading-6", MUTED)}>{copy}</p></div></li>)}</ol>
          <div className="mt-8 flex flex-wrap gap-3"><Action href={DOCTOR_REGISTER_URL}>Apply to practise</Action><Action variant="secondary" href={DOCTOR_SIGN_IN_URL}>Professional sign in</Action></div>
        </div>
      </div>
    </section>

    <FaqBlock id="tele-faq" eyebrow="Patients often ask" title={<>Quick answers<br />before you book.</>} items={telemedicineFaqs} />

    <CtaBand eyebrow="Start today" title="Your next appointment can be from your sofa." actions={<><Action variant="light" href={TELEMEDICINE_SIGN_IN_URL}>Create a free account</Action><Action variant="ghost" to="/products/emr">I run a facility</Action></>} />
  </div>;
}

/* ───────────────────────────── Solutions ───────────────────────────── */

type Fit = { key: string; title: string; copy: string; product: "Sabi EMR" | "Sabi Health" | "Sabi EMR + Sabi Health" | "Pharmacy portal"; icon: typeof Hospital; to?: string; href?: string };
const fits: Fit[] = [
  { key: "hospitals", title: "Hospitals", copy: "Outpatients, wards, lab, pharmacy and billing on one chart.", product: "Sabi EMR", icon: Hospital, to: "/products/emr" },
  { key: "clinics", title: "Clinics", copy: "Start with the front desk and consulting rooms; add more later.", product: "Sabi EMR", icon: Stethoscope, to: "/products/emr" },
  { key: "hospital-groups", title: "Hospital groups", copy: "Several branches under one organization, managed centrally.", product: "Sabi EMR", icon: Building2, to: "/products/emr" },
  { key: "maternity-centres", title: "Maternity centres", copy: "Antenatal, delivery, postnatal and child health records.", product: "Sabi EMR", icon: Baby, to: "/products/emr" },
  { key: "laboratories", title: "Hospital laboratories", copy: "Orders, samples, results and review inside Sabi EMR. A standalone lab product isn't available yet.", product: "Sabi EMR", icon: FlaskConical, to: "/products/emr" },
  { key: "professionals", title: "Doctors & professionals", copy: "See patients on video and in person once you're verified.", product: "Sabi Health", icon: BadgeCheck, href: DOCTOR_REGISTER_URL },
  { key: "patients", title: "Patients & families", copy: "Book visits, manage prescriptions and care for dependants.", product: "Sabi Health", icon: Users, href: TELEMEDICINE_SIGN_IN_URL },
  { key: "pharmacies", title: "Pharmacies", copy: "Receive prescriptions, send quotes and fulfil orders from your own workspace.", product: "Pharmacy portal", icon: Pill, href: PHARMACY_SIGN_IN_URL },
];

export function SolutionsPage() {
  const { type } = useParams();
  const highlighted = fits.some((fit) => fit.key === type) ? type : undefined;
  useEffect(() => {
    if (!highlighted) return;
    // Bring the matching tile into view once the shell has finished its scroll-to-top. On a cold
    // load the first attempt can be overridden while the page settles, so check again shortly after.
    const reveal = () => {
      const tile = document.getElementById(`fit-${highlighted}`);
      const rect = tile?.getBoundingClientRect();
      if (tile && rect && (rect.top < 0 || rect.bottom > window.innerHeight)) tile.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const timers = [350, 1200].map((delay) => window.setTimeout(reveal, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [highlighted]);
  return <div className={INK}>
    <PageHero eyebrow="Solutions" title={<>Two products.<br /><span className="text-brand-600">One connected network.</span></>} copy="Sabi EMR runs your facility from the inside. Sabi Health connects patients with verified professionals from wherever they are. Use one, or both." actions={<><Action to="/products/emr">Sabi EMR</Action><Action variant="secondary" to="/products/telemedicine">Sabi Health telemedicine</Action></>}
      aside={<div className="relative mx-auto grid max-w-[520px] grid-cols-2 gap-4"><img src={providerHospital} alt="A hospital team using Sabi EMR" className="aspect-[3/4] w-full rounded-[26px] object-cover object-[60%_center] shadow-[0_24px_50px_-28px_rgba(11,43,32,.5)]" /><img src={storyDoctor} alt="A doctor ready for a video visit" className="mt-12 aspect-[3/4] w-full rounded-[26px] object-cover object-[68%_center] shadow-[0_24px_50px_-28px_rgba(11,43,32,.5)]" /><span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#f6f9f5] bg-brand-600 text-white shadow-lg"><Network size={22} /></span></div>} />

    <section aria-labelledby="products-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle id="products-heading" eyebrow="Our products" title="Choose by who you are." className="mb-10" />
        <div className="grid gap-5 lg:grid-cols-2">
          <ProductPanel image={providerHospital} alt="A hospital care team reviewing a chart" tag="For facilities" name="Sabi EMR" pitch="The hospital system: registration, queue, consultation, laboratory, pharmacy, wards, billing, plus workforce and accounting when you need them." points={["Each facility's data kept separate", "Roles for every department", "Browser-based — nothing to install"]} to="/products/emr" />
          <ProductPanel image={storyDoctor} alt="A doctor preparing for a video visit" tag="For patients & professionals" name="Sabi Health" pitch="Telemedicine: verified professionals, private video visits, prescriptions with partner pharmacies, and family accounts." points={["Credential-checked professionals", "Private, unrecorded video rooms", "Lab booking coming soon"]} to="/products/telemedicine" />
        </div>
      </div>
    </section>

    <section aria-labelledby="fit-heading" className="bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle id="fit-heading" eyebrow="Find your fit" title="Where does your organization sit?" copy="Each tile tells you which Sabi product is built for you." className="mb-10" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fits.map((fit, i) => { const Icon = fit.icon; const active = fit.key === highlighted; const body = <><span className={cn("grid h-11 w-11 place-items-center rounded-2xl", active ? "bg-white text-brand-700" : "bg-brand-50 text-brand-700")}><Icon size={20} /></span><h3 className="mt-5 text-lg font-bold">{fit.title}</h3><p className={cn("mt-2 flex-1 text-sm leading-6", active ? "text-white/75" : MUTED)}>{fit.copy}</p><span className={cn("mt-5 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold", active ? "bg-white/15 text-brand-100" : "bg-[#eef6f0] text-brand-800")}>{fit.product}</span></>; const cls = cn("flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-0.5", active ? "border-transparent bg-[#0b2b20] text-white shadow-xl" : "border-[#e3ebe5] bg-white hover:border-brand-300"); return <li key={fit.key} id={`fit-${fit.key}`} className="scroll-mt-28"><Reveal delay={i * .03} className="h-full">{fit.to ? <Link to={fit.to} className={cls}>{body}</Link> : <a href={fit.href} className={cls}>{body}</a>}</Reveal></li>; })}</ul>
      </div>
    </section>

    <CtaBand eyebrow="Not sure which?" title="Tell us about your setup and we'll point you to the right product." actions={<><Action variant="light" href={whatsappUrl(primaryLine)}>Chat on WhatsApp</Action><Action variant="ghost" href={telUrl(primaryLine)}>Call {primaryLine.display}</Action></>} />
  </div>;
}

function ProductPanel({ image, alt, tag, name, pitch, points, to }: { image: string; alt: string; tag: string; name: string; pitch: string; points: string[]; to: string }) {
  return <Reveal className="h-full"><article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[#e3ebe5] bg-[#fcfefc]">
    <div className="relative overflow-hidden"><img src={image} alt={alt} loading="lazy" width={820} height={547} className="aspect-[16/9] w-full object-cover transition duration-700 group-hover:scale-[1.03]" /><span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-800 backdrop-blur">{tag}</span></div>
    <div className="flex flex-1 flex-col p-7"><h3 className="font-display text-3xl font-bold tracking-[-0.03em]">{name}</h3><p className={cn("mt-3 text-[15px] leading-7", MUTED)}>{pitch}</p><ul className="mt-5 flex-1 space-y-2">{points.map((point) => <li key={point} className="flex items-center gap-2.5 text-sm font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{point}</li>)}</ul><div className="mt-7"><Action to={to}>Explore {name}</Action></div></div>
  </article></Reveal>;
}

/* ───────────────────────────── Pricing ───────────────────────────── */

export function PricingPage() {
  return <div className={INK}>
    <PageHero eyebrow="Pricing" title={<>Clear plans are<br /><span className="text-brand-600">on their way.</span></>} copy="We're finalising simple, published pricing for hospitals, clinics and professionals. In the meantime, talk to us and we'll quote for your facility — no obligation." actions={<><Action href={whatsappUrl(primaryLine, "Hello Sabi, I'd like a price quote.")}>Get a quote on WhatsApp</Action><Action variant="secondary" href={telUrl(primaryLine)}>Call {primaryLine.display}</Action></>}
      aside={<Reveal className="mx-auto max-w-[460px] rounded-[30px] border border-[#e3ebe5] bg-white p-8 shadow-[0_30px_60px_-36px_rgba(11,43,32,.45)]"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf5e6] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#8d6a2c]"><CalendarClock size={13} />Coming soon</span><h2 className="mt-6 font-display text-2xl font-bold tracking-[-0.03em]">What pricing will cover</h2><ul className="mt-5 space-y-3">{["Sabi EMR plans by facility size and modules", "Branch and storage allowances", "Workforce and accounting add-ons", "Telemedicine terms for professionals"].map((item) => <li key={item} className="flex items-start gap-3 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{item}</li>)}</ul><div className="mt-7 rounded-2xl bg-[#f6f9f5] p-4"><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Talk to us now</p><ContactLines /></div></Reveal>} />
    <section className="bg-white px-5 py-16 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-6 rounded-[26px] border border-[#e3ebe5] bg-[#fcfefc] p-8 md:flex-row md:items-center"><div><h2 className="font-display text-2xl font-bold tracking-[-0.03em]">Want to see it before you talk numbers?</h2><p className={cn("mt-2 text-sm", MUTED)}>Explore what each product does first.</p></div><div className="flex flex-wrap gap-3"><Action to="/products/emr">Sabi EMR</Action><Action variant="secondary" to="/products/telemedicine">Sabi Health</Action></div></div></section>
  </div>;
}

/* ───────────────────────────── Security ───────────────────────────── */

const controls = [
  { icon: KeyRound, title: "Permission checks on every request", copy: "The server checks each action against the person's role. Hiding a button is never the only safeguard." },
  { icon: Network, title: "Facilities sealed off from each other", copy: "Every hospital is its own workspace, and every request is checked against the facility it belongs to." },
  { icon: Fingerprint, title: "Extra sign-in step for our staff", copy: "Sabi operations staff must confirm with a second factor before sensitive platform actions." },
  { icon: History, title: "An audit trail you can follow", copy: "Clinical and administrative changes are recorded with who did them and when." },
  { icon: FileLock2, title: "Private, scanned documents", copy: "Uploaded licences and facility documents land in private storage and are checked for malware before anyone opens them." },
  { icon: Repeat2, title: "No lost or duplicated changes", copy: "If two people edit the same record, the second is warned instead of overwriting; repeated submissions are applied once." },
];

export function SecurityPage() {
  return <div className={INK}>
    <PageHero eyebrow="Security & privacy" title={<>Health records belong<br /><span className="text-brand-600">to the people in them.</span></>} copy="Here is how we protect them — described plainly, without badges we haven't earned." actions={<><Action href="#controls">See the controls</Action><Action variant="secondary" href="#report">Report a concern</Action></>}
      aside={<Reveal className="relative mx-auto max-w-[460px]"><div className="rounded-[30px] bg-[#0b2b20] p-8 text-white shadow-[0_30px_60px_-30px_rgba(11,43,32,.7)]"><ShieldCheck size={40} className="text-brand-300" /><p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-brand-200">Our three rules</p><ul className="mt-4 space-y-4">{[["See only what you need", "Access follows the job, not the title."], ["Leave a trail", "Important actions are recorded."], ["Keep it apart", "One facility can never read another's records."]].map(([title, copy], i) => <li key={title} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">{i + 1}</span><div><b>{title}</b><p className="text-sm text-white/65">{copy}</p></div></li>)}</ul></div></Reveal>} />

    <section id="controls" aria-labelledby="controls-heading" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle id="controls-heading" eyebrow="How the platform is built" title="Six safeguards, designed in from the start." className="mb-10" />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{controls.map(({ icon: Icon, title, copy }, i) => <li key={title}><Reveal delay={i * .04} className="h-full"><article className="h-full rounded-2xl border border-[#e3ebe5] bg-[#fcfefc] p-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={20} /></span><h3 className="mt-5 text-lg font-bold leading-snug">{title}</h3><p className={cn("mt-2 text-sm leading-6", MUTED)}>{copy}</p></article></Reveal></li>)}</ul>
      </div>
    </section>

    <section aria-labelledby="patients-privacy-heading" className="bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-2">
        <div><SectionTitle id="patients-privacy-heading" eyebrow="If you're a patient" title="What happens with your information." />
          <ul className="mt-7 space-y-4">{([[Video, "Video visits stay between you and your professional", "Rooms open only around your appointment, for the two of you. Recording and transcription are off."], [UserCheck, "Care plans need your consent", "A professional can only create and share a plan with you after you agree."], [BadgeCheck, "You only meet checked professionals", "Licences are reviewed before anyone can accept patients."], [ScanSearch, "You can ask what we hold", "Call or WhatsApp us and we'll walk you through it."]] as const).map(([Icon, title, copy]) => <li key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm"><Icon size={18} /></span><div><b>{title}</b><p className={cn("mt-0.5 text-sm leading-6", MUTED)}>{copy}</p></div></li>)}</ul>
        </div>
        <Reveal><img src={storyUnwell} alt="A woman at home using her tablet privately" loading="lazy" width={820} height={547} className="w-full rounded-[28px] object-cover shadow-[0_24px_50px_-28px_rgba(11,43,32,.5)]" /></Reveal>
      </div>
    </section>

    <section aria-labelledby="honest-heading" className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2">
        <Reveal className="h-full"><div className="h-full rounded-[26px] border border-[#e3ebe5] bg-[#fcfefc] p-8"><Laptop className="text-brand-700" /><h2 id="honest-heading" className="mt-5 font-display text-2xl font-bold tracking-[-0.03em]">What we're working on next</h2><ul className="mt-5 space-y-3">{["Second-factor sign-in for every hospital user, not just our staff", "Self-service session and device management", "Published backup and recovery targets", "Independent security review"].map((item) => <li key={item} className="flex items-start gap-3 text-sm"><Activity size={15} className="mt-0.5 shrink-0 text-brand-600" />{item}</li>)}</ul></div></Reveal>
        <Reveal delay={.06} className="h-full"><div className="h-full rounded-[26px] border border-[#f3e3c8] bg-[#fdf8ef] p-8"><LockKeyhole className="text-[#8d6a2c]" /><h2 className="mt-5 font-display text-2xl font-bold tracking-[-0.03em]">Our honest position</h2><p className={cn("mt-4 text-sm leading-7", MUTED)}>We don't currently hold ISO 27001, SOC 2, HIPAA or NDPC certification, and we won't imply that we do. Compliance also depends on how each facility configures accounts and runs its own procedures — we'll help you set that up properly.</p></div></Reveal>
      </div>
    </section>

    <section id="report" aria-labelledby="report-heading" className="scroll-mt-20 bg-[#0b2b20] px-5 py-16 text-white sm:px-8 lg:px-10 lg:py-20">
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center"><Reveal><Eyebrow light>Report a concern</Eyebrow><h2 id="report-heading" className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-[42px]">Seen something that doesn't look right?</h2><p className="mt-4 max-w-xl text-white/70">Tell us straight away — whether it's a possible vulnerability, a privacy worry or access that looks wrong. Please don't include patient details in the first message.</p></Reveal><Reveal delay={.08} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><ContactLines light /></Reveal></div>
    </section>
  </div>;
}

/* ───────────────────────────── Shared FAQ ───────────────────────────── */

function FaqBlock({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: ReactNode; items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return <section aria-labelledby={`${id}-heading`} className="bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
    <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[.8fr_1.2fr] lg:gap-16">
      <div className="md:sticky md:top-28 md:self-start"><Eyebrow>{eyebrow}</Eyebrow><h2 id={`${id}-heading`} className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.04em] sm:text-[42px]">{title}</h2><div className="mt-6 max-w-[360px] rounded-2xl bg-[#f6f9f5] p-6"><p className="mb-3 text-sm font-bold">Still unsure? Call or WhatsApp us.</p><ContactLines /></div></div>
      <div className="self-start overflow-hidden rounded-[24px] bg-[#f6f9f5]">{items.map(({ q, a }, i) => { const expanded = open === i; return <article key={q} className={cn("border-b border-[#e3ebe5] last:border-b-0", expanded && "bg-[#eaf4ed]")}>
        <h3><button id={`${id}-q-${i}`} type="button" aria-expanded={expanded} aria-controls={`${id}-a-${i}`} onClick={() => setOpen(expanded ? -1 : i)} className="flex w-full items-center gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"><span className="flex-1 text-[15px] font-bold leading-snug lg:text-[17px]">{q}</span><span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-brand-700">{expanded ? <Minus size={15} /> : <Plus size={15} />}</span></button></h3>
        <div id={`${id}-a-${i}`} role="region" aria-labelledby={`${id}-q-${i}`} hidden={!expanded}><p className={cn("max-w-[560px] px-5 pb-5 text-sm leading-[1.7]", MUTED)}>{a}</p></div>
      </article>; })}</div>
    </div>
  </section>;
}
