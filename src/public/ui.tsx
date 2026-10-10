import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, Phone, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CONTACT_EMAILS, CONTACT_LINES, telUrl, whatsappUrl } from "@/public/contact";

// The public site's shared look: forest ink, sage surfaces and brand green, taken from the
// portal artwork. Every marketing page builds from these pieces so the pages rhyme.
export const INK = "text-[#0b2b20]";
export const MUTED = "text-[#55685f]";

export function Eyebrow({ children, light = false, className }: { children: ReactNode; light?: boolean; className?: string }) {
  return <p className={cn("mb-4 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em]", light ? "text-brand-100" : "text-[#55685f]", className)}><span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", light ? "bg-brand-300" : "bg-brand-600")} />{children}</p>;
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: .55, delay }}>{children}</motion.div>;
}

export function SectionTitle({ eyebrow, title, copy, centered = false, light = false, id, className }: { eyebrow: string; title: ReactNode; copy?: ReactNode; centered?: boolean; light?: boolean; id?: string; className?: string }) {
  return <Reveal className={cn("max-w-[720px]", centered && "mx-auto text-center [&>p:first-child]:justify-center", className)}>
    <Eyebrow light={light}>{eyebrow}</Eyebrow>
    <h2 id={id} className="text-balance font-display text-[32px] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[44px]">{title}</h2>
    {copy && <p className={cn("mt-4 text-[15px] leading-relaxed sm:text-base", light ? "text-white/70" : MUTED)}>{copy}</p>}
  </Reveal>;
}

type ActionProps = { to?: string; href?: string; children: ReactNode; variant?: "primary" | "secondary" | "light" | "ghost"; className?: string };
const actionStyles = {
  primary: "bg-[#0b2b20] text-white shadow-[0_10px_24px_-12px_rgba(11,43,32,.55)] hover:bg-brand-800",
  secondary: "border border-[#0b2b20]/15 bg-white text-[#0b2b20] hover:border-brand-400 hover:text-brand-800",
  light: "bg-white text-[#0b2b20] hover:bg-brand-50",
  ghost: "border border-white/30 text-white hover:bg-white/10",
};
/** A button-styled link: router link for internal paths, anchor for other apps and tel/WhatsApp. */
export function Action({ to, href, children, variant = "primary", className }: ActionProps) {
  const cls = cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2", actionStyles[variant], className);
  const body = <>{children}{(variant === "primary" || variant === "light") && <ArrowRight size={16} aria-hidden />}</>;
  return href ? <a href={href} className={cls}>{body}</a> : <Link to={to!} className={cls}>{body}</Link>;
}

export function TextLink({ to, href, children, light = false }: { to?: string; href?: string; children: ReactNode; light?: boolean }) {
  const cls = cn("inline-flex items-center gap-2 text-sm font-bold", light ? "text-brand-200 hover:text-white" : "text-brand-700 hover:text-brand-900");
  const body = <>{children}<ArrowRight size={15} aria-hidden /></>;
  return href ? <a href={href} className={cls}>{body}</a> : <Link to={to!} className={cls}>{body}</Link>;
}

/** The light hero every inner page opens with. */
export function PageHero({ eyebrow, title, copy, actions, aside, id = "page-heading" }: { eyebrow: string; title: ReactNode; copy: ReactNode; actions?: ReactNode; aside?: ReactNode; id?: string }) {
  const reduceMotion = useReducedMotion();
  return <section aria-labelledby={id} className={cn("relative isolate overflow-hidden border-b border-[#0b2b20]/5 bg-[#f6f9f5]", INK)}>
    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full bg-[radial-gradient(ellipse_at_78%_40%,#dff0e5_0%,transparent_62%)] lg:w-3/4" />
    <div className={cn("mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-16 sm:px-8 lg:px-10 lg:py-24", aside && "lg:grid-cols-[1fr_1fr]")}>
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className="max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 id={id} className="text-balance font-display text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.05em]">{title}</h1>
        <p className={cn("mt-6 max-w-[540px] text-base leading-[1.8] sm:text-lg", MUTED)}>{copy}</p>
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </motion.div>
      {aside && <motion.div initial={reduceMotion ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12, duration: .6 }}>{aside}</motion.div>}
    </div>
  </section>;
}

/** Both phone lines, each with call and WhatsApp. */
export function ContactLines({ light = false }: { light?: boolean }) {
  return <ul className="space-y-2.5">{CONTACT_LINES.map((line) => <li key={line.tel} className="flex flex-wrap items-center gap-x-4 gap-y-1">
    <a href={telUrl(line)} className={cn("inline-flex items-center gap-2 text-sm font-bold", light ? "text-white hover:text-brand-200" : "hover:text-brand-700")}><Phone size={14} aria-hidden />{line.display}</a>
    <a href={whatsappUrl(line)} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 text-xs font-bold", light ? "text-brand-200 hover:text-white" : "text-brand-700 hover:text-brand-900")}><WhatsAppGlyph className="h-3.5 w-3.5" />WhatsApp</a>
  </li>)}</ul>;
}

/** Public email links, labelled by purpose and allowed to wrap on small screens. */
export function ContactEmails({ light = false, className }: { light?: boolean; className?: string }) {
  return <ul className={cn("space-y-2", className)}>{CONTACT_EMAILS.map(({ label, address }) => <li key={address}>
    <a href={`mailto:${address}`} className={cn("flex min-h-11 min-w-0 items-center gap-3 rounded-lg py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400", light ? "text-white hover:text-brand-200" : "text-[#0b2b20] hover:text-brand-700")}>
      <Mail size={16} className="shrink-0" aria-hidden />
      <span className="min-w-0"><span className={cn("block text-xs", light ? "text-brand-200" : MUTED)}>{label}</span>{" "}<span className="block text-sm font-semibold [overflow-wrap:anywhere]">{address}</span></span>
    </a>
  </li>)}</ul>;
}

/** Closing call-to-action band shared by the inner pages. */
export function CtaBand({ eyebrow = "Talk to us", title, copy, actions }: { eyebrow?: string; title: ReactNode; copy?: ReactNode; actions: ReactNode }) {
  return <section className="relative overflow-hidden bg-[#0b2b20] px-5 py-16 text-white sm:px-8 lg:px-10 lg:py-20">
    <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10" /><div aria-hidden className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />
    <div className="relative mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
      <Reveal><Eyebrow light>{eyebrow}</Eyebrow><h2 className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-[42px]">{title}</h2>{copy && <p className="mt-4 max-w-xl text-base leading-7 text-white/70">{copy}</p>}<div className="mt-8 flex flex-wrap gap-3">{actions}</div></Reveal>
      <Reveal delay={.08} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-200">Call or WhatsApp</p><p className="mb-4 mt-1 text-sm text-white/60">Speak with the Sabi team directly.</p><ContactLines light /></Reveal>
    </div>
  </section>;
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.36A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.08.8.82-3-.2-.31a8.2 8.2 0 1 1 6.96 3.84Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.55.12-.17.24-.64.8-.78.96-.14.17-.29.19-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.75 2.75 0 0 0-.86 2.04 4.77 4.77 0 0 0 1 2.54c.12.16 1.7 2.6 4.12 3.64 1.53.66 2.13.72 2.9.6.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.11-.22-.17-.47-.29Z" /></svg>;
}

/** Floating WhatsApp button: opens a small card offering both lines. */
export function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    const onPointer = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !toggle.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);
  return <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <div ref={panel} id="whatsapp-panel" role="dialog" aria-label="Chat with Sabi Health on WhatsApp" className="w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white text-[#0b2b20] shadow-[0_24px_50px_-20px_rgba(11,43,32,.45)]">
      <div className="flex items-start justify-between gap-3 bg-[#0b2b20] p-4 text-white"><div><p className="text-sm font-bold">Chat with Sabi Health</p><p className="mt-0.5 text-xs text-white/65">Pick a line to open WhatsApp.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"><X size={15} /></button></div>
      <ul className="p-2">{CONTACT_LINES.map((line) => <li key={line.whatsapp}><a href={whatsappUrl(line)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[#f0f7f2]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#25d366] text-white"><WhatsAppGlyph className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{line.display}</span><span className={cn("block text-xs", MUTED)}>Opens a WhatsApp chat</span></span></a></li>)}</ul>
    </div>}
    <button ref={toggle} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="whatsapp-panel" aria-label={open ? "Close WhatsApp chat options" : "Chat with us on WhatsApp"} className="grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_28px_-8px_rgba(37,211,102,.7)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/40">
      {open ? <X size={24} /> : <WhatsAppGlyph className="h-7 w-7" />}
    </button>
  </div>;
}
