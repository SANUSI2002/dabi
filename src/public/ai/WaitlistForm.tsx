import { useId, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { joinWaitlist } from "./waitlist";

// Sabi AI is not open yet: this is the one sign-up path on the page. It stores contact details only
// (POST /api/v1/waitlist); people are asked not to include health information.
const ROLES = [
  ["PROFESSIONAL", "Healthcare professional"],
  ["PATIENT", "Patient"],
  ["CAREGIVER", "Caregiver or family member"],
  ["ORGANISATION", "Hospital, clinic or organisation"],
  ["OTHER", "Something else"],
] as const;


export function WaitlistForm({ source, dark = false, className }: { source: string; dark?: boolean; className?: string }) {
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending"); setError("");
    try {
      await joinWaitlist({
        email: String(form.get("email") || "").trim(),
        name: String(form.get("name") || "").trim() || undefined,
        role: String(form.get("role")),
        organisation: String(form.get("organisation") || "").trim() || undefined,
        source,
      });
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  const label = cn("mb-1.5 block text-[13px] font-semibold", dark ? "text-white/80" : "text-[#0b2b20]");
  const field = cn("w-full rounded-xl border px-3.5 py-3 text-[15px] outline-none transition focus-visible:ring-2",
    dark ? "border-white/15 bg-white/[0.06] text-white placeholder:text-white/35 focus-visible:border-white/40 focus-visible:ring-white/20"
      : "border-[#d9d3c5] bg-white text-[#0b2b20] placeholder:text-[#8a958e] focus-visible:border-[#0b2b20]/40 focus-visible:ring-[#0b2b20]/10");

  if (state === "done") {
    return <div role="status" className={cn("rounded-2xl border p-6", dark ? "border-white/15 bg-white/[0.06] text-white" : "border-[#d9d3c5] bg-white", className)}>
      <CheckCircle2 className={dark ? "text-brand-300" : "text-brand-700"} size={26} aria-hidden />
      <p className="mt-4 font-display text-xl font-semibold tracking-[-0.02em]">You're on the list.</p>
      <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/65" : "text-[#55685f]")}>We'll email you when Sabi AI opens for your group. We only use these details to contact you about Sabi AI.</p>
    </div>;
  }

  return <form onSubmit={submit} className={cn("grid gap-4 sm:grid-cols-2", className)} aria-describedby={`${id}-note`}>
    <div><label htmlFor={`${id}-name`} className={label}>Name <span className="font-normal opacity-60">(optional)</span></label><input id={`${id}-name`} name="name" autoComplete="name" maxLength={120} className={field} /></div>
    <div><label htmlFor={`${id}-email`} className={label}>Email</label><input id={`${id}-email`} name="email" type="email" required autoComplete="email" maxLength={254} className={field} placeholder="you@example.com" /></div>
    <div><label htmlFor={`${id}-role`} className={label}>I am a…</label><select id={`${id}-role`} name="role" required defaultValue="PROFESSIONAL" className={field}>{ROLES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>
    <div><label htmlFor={`${id}-org`} className={label}>Organisation <span className="font-normal opacity-60">(optional)</span></label><input id={`${id}-org`} name="organisation" autoComplete="organization" maxLength={160} className={field} /></div>
    <label className={cn("flex items-start gap-3 text-sm leading-6 sm:col-span-2", dark ? "text-white/75" : "text-[#55685f]")}>
      <input type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[#0b2b20]" />
      <span>Email me about Sabi AI access. I can ask to be removed at any time.</span>
    </label>
    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
      <p id={`${id}-note`} className={cn("max-w-md text-xs leading-5", dark ? "text-white/50" : "text-[#7a8a82]")}>Please don't include any health information here.</p>
      <button type="submit" disabled={state === "sending"} className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60",
        dark ? "bg-[#f3efe6] text-[#0b2b20] hover:bg-white focus-visible:ring-white focus-visible:ring-offset-[#0b2b20]" : "bg-[#0b2b20] text-white hover:bg-[#123d2e] focus-visible:ring-[#0b2b20]")}>
        {state === "sending" ? "Joining…" : "Join the waitlist"} <ArrowRight size={16} aria-hidden />
      </button>
    </div>
    {error && <p role="alert" className={cn("text-sm font-semibold sm:col-span-2", dark ? "text-[#ffb4a6]" : "text-[#b3412b]")}>{error}</p>}
  </form>;
}
