import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, FileText, Paperclip, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

// Scripted, clearly labelled sample conversations. Every name, value and history is fictional.
// Nothing here calls a model: Sabi AI is not open yet.

type Sample = { prompt: string; attachment?: string; reply: ReactNode };

const Bullets = ({ items }: { items: ReactNode[] }) => <ul className="mt-2 space-y-1.5">{items.map((item, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#1f5c45]" /><span>{item}</span></li>)}</ul>;

const HERO_SAMPLES: Sample[] = [
  {
    prompt: "Explain this medical report in plain language.",
    attachment: "blood-count-sample.pdf",
    reply: <>
      <p>Here's what this sample report covers, in plain words:</p>
      <Bullets items={[
        <><b>Haemoglobin 11.2 g/dL</b> — a little below the range printed on the report (12.0–15.5). Haemoglobin carries oxygen around the body.</>,
        <><b>White cells and platelets</b> — inside the ranges listed.</>,
        <>A value just outside a range can have many explanations. Your clinician can say what it means for you.</>,
      ]} />
      <p className="mt-3 text-[#55685f]">Want a short list of questions to take to your appointment?</p>
    </>,
  },
  {
    prompt: "Summarise this patient history for review.",
    attachment: "history-notes-sample.txt",
    reply: <>
      <p>Sample summary of the notes you provided:</p>
      <Bullets items={[
        <><b>Background:</b> type 2 diabetes (2016), hypertension.</>,
        <><b>Medicines listed:</b> metformin, amlodipine.</>,
        <><b>Recent:</b> two clinic blood pressures above the documented target.</>,
        <><b>Gaps to check:</b> no HbA1c recorded since March.</>,
      ]} />
      <p className="mt-3 text-[#55685f]">Please check this against the source record before relying on it.</p>
    </>,
  },
  {
    prompt: "Help me understand these body composition results.",
    attachment: "body-scan-sample.png",
    reply: <>
      <p>Your sample scan reports three measures:</p>
      <Bullets items={[
        <><b>Body fat 31%</b> — the share of your weight that is fat tissue.</>,
        <><b>Skeletal muscle 26 kg</b> — the muscle you use to move.</>,
        <><b>Visceral fat rating 9</b> — an estimate of fat around the organs.</>,
      ]} />
      <p className="mt-3 text-[#55685f]">Reference bands differ between devices, so changes over time often say more than one reading.</p>
    </>,
  },
  {
    prompt: "Explain this medical concept.",
    reply: <>
      <p><b>Insulin resistance</b>, in brief: insulin is the hormone that helps sugar move from the blood into cells. When cells respond to it less well, the body needs more insulin to do the same job, and blood sugar can slowly rise.</p>
      <p className="mt-3 text-[#55685f]">I can go deeper into how it's measured, or explain it for a patient.</p>
    </>,
  },
];

function Bubble({ from, children }: { from: "you" | "sabi"; children: ReactNode }) {
  return from === "you"
    ? <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#0b2b20] px-4 py-3 text-[14px] leading-6 text-white">{children}</div>
    : <div className="flex max-w-[94%] gap-3"><span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e6efe8] text-[#1f5c45]"><Sparkles size={14} /></span><div className="min-w-0 text-[14px] leading-6 text-[#0b2b20]">{children}</div></div>;
}

function Attachment({ name }: { name: string }) {
  return <span className="mb-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90"><FileText size={13} aria-hidden /> {name}</span>;
}

/** Hero preview: pick one of four example prompts and read a sample answer. */
export function HeroConversation() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const sample = HERO_SAMPLES[index];
  return <figure aria-label="Sample Sabi AI conversation with fictional details" className="relative">
    <div className="overflow-hidden rounded-[28px] border border-[#e6e0d3] bg-white shadow-[0_40px_80px_-48px_rgba(11,43,32,.45)]">
      <div className="flex items-center justify-between border-b border-[#efe9dd] px-5 py-3.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b2b20]"><span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-[#0b2b20] text-[#f3efe6]"><Sparkles size={12} /></span>Sabi AI</span>
        <span className="rounded-full bg-[#f3efe6] px-2.5 py-1 text-[11px] font-semibold text-[#55685f]">Sample · fictional details</span>
      </div>
      <div className="min-h-[340px] space-y-4 px-5 py-6 sm:min-h-[360px]" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: .3 }} className="space-y-4">
            <Bubble from="you">{sample.attachment && <Attachment name={sample.attachment} />}<span className="block">{sample.prompt}</span></Bubble>
            <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : .35, duration: .4 }}><Bubble from="sabi">{sample.reply}</Bubble></motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="border-t border-[#efe9dd] bg-[#fbf9f4] px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a8a82]">Try a sample prompt</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sample prompts">
          {HERO_SAMPLES.map((s, i) => <button key={s.prompt} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}
            className={cn("rounded-full border px-3 py-1.5 text-left text-[12.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2b20]/30",
              i === index ? "border-[#0b2b20] bg-[#0b2b20] text-white" : "border-[#e0d9cb] bg-white text-[#2b4a3d] hover:border-[#0b2b20]/40")}>{s.prompt}</button>)}
        </div>
      </div>
    </div>
    <figcaption className="mt-3 text-center text-xs text-[#7a8a82]">A scripted sample. Sabi supports understanding; it doesn't replace professional care.</figcaption>
  </figure>;
}

type Turn = { from: "you" | "sabi"; body: ReactNode; attachment?: string };
const OPENING: Turn[] = [
  { from: "you", attachment: "lipid-panel-sample.pdf", body: "What does this cholesterol report mean? My LDL is flagged." },
  { from: "sabi", body: <>
    <p>In this sample report, <b>LDL cholesterol is 4.1 mmol/L</b>, above the target printed beside it (under 3.0). LDL is often called "bad" cholesterol because higher levels are linked with fatty build-up in blood vessels.</p>
    <p className="mt-2">HDL and triglycerides are within the ranges shown. What counts as the right target depends on your wider health, which your clinician will consider.</p>
  </> },
];
const FOLLOW_UPS: { question: string; answer: ReactNode }[] = [
  { question: "What questions should I ask my doctor?", answer: <Bullets items={["Is my LDL level a concern given my overall health?", "Would changes to food or activity help, and by how much?", "When should this test be repeated?"]} /> },
  { question: "Explain HDL in simple terms.", answer: <p>HDL is often called "good" cholesterol: it helps carry cholesterol away from blood vessels to the liver, which removes it.</p> },
  { question: "Which foods affect LDL?", answer: <p>Foods high in saturated fat — like fatty meat, butter and some fried snacks — tend to raise LDL. Oats, beans, nuts and vegetables are often suggested in their place. A dietitian can tailor this to you.</p> },
];

/** "Ask. Share. Explore." — a sample thread with real, clickable follow-ups and a clearly inactive composer. */
export function InteractionDemo({ waitlistHref = "#waitlist" }: { waitlistHref?: string }) {
  const reduce = useReducedMotion();
  const [turns, setTurns] = useState<Turn[]>(OPENING);
  const asked = new Set(turns.filter((t) => t.from === "you").map((t) => String(t.body)));
  const ask = (f: (typeof FOLLOW_UPS)[number]) => setTurns((list) => [...list, { from: "you", body: f.question }, { from: "sabi", body: f.answer }]);
  return <div className="overflow-hidden rounded-[28px] border border-[#e6e0d3] bg-white shadow-[0_40px_80px_-52px_rgba(11,43,32,.5)]">
    <div className="flex items-center justify-between border-b border-[#efe9dd] px-5 py-3.5">
      <span className="text-sm font-semibold text-[#0b2b20]">Understanding a cholesterol report</span>
      <span className="rounded-full bg-[#f3efe6] px-2.5 py-1 text-[11px] font-semibold text-[#55685f]">Preview · sample data</span>
    </div>
    <div className="max-h-[440px] space-y-4 overflow-y-auto px-5 py-6" aria-live="polite">
      {turns.map((turn, i) => <motion.div key={i} initial={reduce || i < 2 ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: turn.from === "sabi" && !reduce ? .25 : 0 }}>
        <Bubble from={turn.from}>{turn.attachment && <Attachment name={turn.attachment} />}<div>{turn.body}</div></Bubble>
      </motion.div>)}
    </div>
    <div className="border-t border-[#efe9dd] px-5 pb-5 pt-4">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a8a82]">Suggested follow-ups</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {FOLLOW_UPS.filter((f) => !asked.has(f.question)).map((f) => <button key={f.question} type="button" onClick={() => ask(f)} className="rounded-full border border-[#e0d9cb] bg-[#fbf9f4] px-3 py-1.5 text-[12.5px] text-[#2b4a3d] transition hover:border-[#0b2b20]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2b20]/30">{f.question}</button>)}
        {turns.length > 2 && <button type="button" onClick={() => setTurns(OPENING)} className="px-2 py-1.5 text-[12.5px] font-semibold text-[#55685f] underline underline-offset-4 hover:text-[#0b2b20]">Start over</button>}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-[#e0d9cb] bg-[#fbf9f4] p-2">
        <span title="Uploads arrive when Sabi AI opens" className="grid h-10 w-10 shrink-0 cursor-not-allowed place-items-center rounded-xl text-[#9aa59f]" aria-label="Attach a document (available when Sabi AI opens)"><Paperclip size={18} /></span>
        <span className="min-w-0 flex-1 truncate text-sm text-[#8a958e]">Sabi AI is opening soon — this is a preview.</span>
        <a href={waitlistHref} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#0b2b20] px-3.5 text-[13px] font-semibold text-white hover:bg-[#123d2e]">Join the waitlist <ArrowUp size={14} className="rotate-45" aria-hidden /></a>
      </div>
    </div>
  </div>;
}
