import notice from "../content/privacy-notice.md?raw";

// Plain text only: the owner-approved notice is local content, not uploaded HTML.
export default function PrivacyPage() {
  return <article className="mx-auto max-w-3xl px-5 py-12 text-slate-800 sm:px-8 sm:py-20">
    {notice.trim().split(/\r?\n\s*\r?\n/).map((block, index) =>
      block.startsWith("# ") ? <h1 key={index} className="mb-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">{block.slice(2)}</h1> :
      block.startsWith("## ") ? <h2 key={index} className="mb-3 mt-9 text-xl font-bold">{block.slice(3)}</h2> :
      <p key={index} className="mb-5 text-base leading-8 [overflow-wrap:anywhere]">{block}</p>
    )}
    <p className="mt-8 text-base leading-8">Privacy enquiries: <a className="font-semibold text-emerald-800 underline" href="mailto:support@sabihealth.org">support@sabihealth.org</a>.</p>
  </article>;
}
