import { useState } from "react";
import { Users2, FileText, GraduationCap, Briefcase, Award, MessageSquarePlus, History, ArrowRight, Paperclip, Phone, Mail, MapPin, Cake } from "lucide-react";
import { PageHeader, Card, Badge, StatCard, Button, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DocViewer } from "@/components/ui/DocViewer";
import { useRecruitment } from "@/store/useRecruitment";
import { useHr } from "@/store/useHr";
import { useMasterData } from "@/platform/useMasterData";
import { timeAgo, initials, shortDate, dateTime } from "@/lib/format";
import { SKILL_ZONES } from "@/data/recruitment";
import type { TalentPoolEntry } from "@/data/recruitment";

export default function TalentPool() {
  const { talentPool, requisitions, talentEntryById, addTalentNote, addTalentDocument, takeToRecruitment } = useRecruitment();
  const staff = useHr((s) => s.staff);
  const statuses = useMasterData((s) => s.items("recruitment-statuses")).filter((x) => x.active);
  const docTypes = useMasterData((s) => s.items("document-types")).filter((x) => x.active);
  const [open, setOpen] = useState<string | null>(null);
  const [viewDocs, setViewDocs] = useState<{ list: TalentPoolEntry["documents"]; index: number } | null>(null);
  const [note, setNote] = useState("");
  const [takeModal, setTakeModal] = useState(false);
  const [tf, setTf] = useState({ requisitionId: "", statusCode: "SCREEN" });
  const [docModal, setDocModal] = useState(false);
  const [df, setDf] = useState({ type: "Curriculum Vitae", filename: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const e = open ? talentEntryById(open) : null;

  return (
    <div>
      <PageHeader title="Talent Pool" subtitle="Strong candidates not hired this time — full profiles, ready to move into an open requisition." />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In pool" value={talentPool.length} tone="brand" icon={<Users2 size={18} />} />
        <StatCard label="Skill zones" value={new Set(talentPool.map((t) => t.skillZone)).size} tone="mist" delay={0.05} />
        <StatCard label="Moved to recruitment" value={talentPool.filter((t) => t.takenToRecruitment).length} tone="brand" delay={0.1} />
        <StatCard label="Documents on file" value={talentPool.reduce((n, t) => n + (t.documents?.length ?? 0), 0)} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-4">
        {SKILL_ZONES.map((zone) => {
          const entries = talentPool.filter((t) => t.skillZone === zone);
          if (!entries.length) return null;
          return (
            <Card key={zone}>
              <div className="mb-2 flex items-center justify-between"><p className="font-display font-bold text-mist-900">{zone}</p><Badge tone="mist">{entries.length}</Badge></div>
              <div className="space-y-2">
                {entries.map((t) => (
                  <button key={t.id} onClick={() => setOpen(t.id)} className="flex w-full items-start gap-3 rounded-xl bg-mist-50 px-3 py-2 text-left hover:bg-mist-100">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(t.candidateName)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-mist-900">{t.candidateName} {t.takenToRecruitment && <Badge tone="brand">in recruitment</Badge>}</p>
                      <p className="text-[11px] text-mist-400">{t.headline ?? `${t.email} · ${t.phone}`}</p>
                      <p className="mt-0.5 text-xs text-mist-600">{t.reason}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-mist-400">{timeAgo(t.addedAt)}</span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
        {talentPool.length === 0 && <EmptyState title="Talent pool is empty" hint="Add a candidate when rejecting them in Recruitment." />}
      </div>

      {/* full profile */}
      <Modal open={!!e} onClose={() => setOpen(null)} title={e?.candidateName ?? ""} wide
        footer={e && <>
          <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
          <Button variant="soft" onClick={() => { setDf({ type: docTypes[0]?.label ?? "Document", filename: "" }); setDocModal(true); }}><Paperclip size={14} /> Add document</Button>
          {!e.takenToRecruitment && <Button onClick={() => { setTf({ requisitionId: requisitions.filter((r) => !r.closed)[0]?.id ?? "", statusCode: statuses[1]?.code ?? "SCREEN" }); setTakeModal(true); }}>Take to Recruitment <ArrowRight size={14} /></Button>}
        </>}>
        {e && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-mist-500">
              {e.email && <span className="flex items-center gap-1"><Mail size={12} /> {e.email}</span>}
              {e.phone && <span className="flex items-center gap-1"><Phone size={12} /> {e.phone}</span>}
              {e.dob && <span className="flex items-center gap-1"><Cake size={12} /> {shortDate(e.dob)}</span>}
              {e.address && <span className="flex items-center gap-1"><MapPin size={12} /> {e.address}</span>}
            </div>
            {e.headline && <p className="text-sm font-semibold text-mist-800">{e.headline}</p>}

            {e.skills && e.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{e.skills.map((s) => <span key={s} className="chip bg-mist-100 text-mist-600 ring-1 ring-mist-200">{s}</span>)}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Section icon={<Briefcase size={13} />} title="Experience">
                {(e.experience ?? []).map((x) => (
                  <div key={x.id} className="text-sm"><p className="font-semibold text-mist-800">{x.role}</p><p className="text-xs text-mist-500">{x.employer} · {x.from}–{x.to ?? "present"}</p>{x.summary && <p className="mt-0.5 text-xs text-mist-500">{x.summary}</p>}</div>
                ))}
                {!e.experience?.length && <p className="text-xs text-mist-400">None recorded.</p>}
              </Section>
              <Section icon={<GraduationCap size={13} />} title="Education">
                {(e.education ?? []).map((x) => (
                  <div key={x.id} className="text-sm"><p className="font-semibold text-mist-800">{x.qualification}</p><p className="text-xs text-mist-500">{x.institution}{x.year ? ` · ${x.year}` : ""}</p></div>
                ))}
                {!e.education?.length && <p className="text-xs text-mist-400">None recorded.</p>}
              </Section>
              <Section icon={<Award size={13} />} title="Professional qualifications">
                {(e.qualifications ?? []).map((x) => (
                  <div key={x.id} className="text-sm"><p className="font-semibold text-mist-800">{x.name} {x.verified && <Badge tone="brand">verified</Badge>}</p><p className="text-xs text-mist-500">{x.body}{x.expires ? ` · expires ${shortDate(x.expires)}` : ""}</p></div>
                ))}
                {!e.qualifications?.length && <p className="text-xs text-mist-400">None recorded.</p>}
              </Section>
              <Section icon={<FileText size={13} />} title={`Documents (${e.documents?.length ?? 0})`}>
                {(e.documents ?? []).map((d, di) => (
                  <button key={d.id} onClick={() => setViewDocs({ list: e.documents, index: di })} className="flex w-full items-center gap-2 rounded-lg bg-mist-50 px-2 py-1.5 text-left text-sm hover:bg-mist-100">
                    <FileText size={13} className="shrink-0 text-mist-400" /><span className="truncate">{d.filename}</span><span className="ml-auto shrink-0 text-[10px] text-mist-400">{d.type}</span>
                  </button>
                ))}
                {!e.documents?.length && <p className="text-xs text-mist-400">No documents.</p>}
              </Section>
            </div>

            <Section icon={<History size={13} />} title="Application history">
              {(e.history ?? []).map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm"><span className="text-mist-400">{shortDate(h.at)}</span> {h.event}{h.detail ? ` — ${h.detail}` : ""}</div>
              ))}
            </Section>

            <Section icon={<MessageSquarePlus size={13} />} title="Notes">
              <div className="flex gap-2">
                <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add a note…" className="h-8" />
                <Button variant="soft" disabled={!note.trim()} onClick={() => { addTalentNote(e.id, note.trim()); setNote(""); }}>Add</Button>
              </div>
              {(e.notes ?? []).map((n) => (
                <div key={n.id} className="rounded-lg bg-mist-50 px-2 py-1.5 text-sm"><p>{n.text}</p><p className="text-[10px] text-mist-400">{staff.find((s) => s.id === n.by)?.name ?? n.by} · {dateTime(n.at)}</p></div>
              ))}
            </Section>

            {e.takenToRecruitment && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">Moved to recruitment on {shortDate(e.takenToRecruitment.at)} — {requisitions.find((r) => r.id === e.takenToRecruitment!.requisitionId)?.title}.</div>}
          </div>
        )}
      </Modal>

      {/* take to recruitment */}
      <Modal open={takeModal} onClose={() => setTakeModal(false)} title="Take to Recruitment"
        footer={<><Button variant="ghost" onClick={() => setTakeModal(false)}>Cancel</Button>
          <Button disabled={!tf.requisitionId} onClick={() => { const r = takeToRecruitment(open!, tf.requisitionId, tf.statusCode); setTakeModal(false); setMsg(r.ok ? "Added to the requisition pipeline." : (r.error ?? "Failed")); }}>Move</Button></>}>
        <div className="space-y-3">
          <Field label="Requisition"><Select value={tf.requisitionId} onChange={(ev) => setTf({ ...tf, requisitionId: ev.target.value })} options={[{ value: "", label: "Select an open requisition…" }, ...requisitions.filter((r) => !r.closed).map((r) => ({ value: r.id, label: r.title }))]} /></Field>
          <Field label="Recruitment status" hint="Statuses are configurable in Platform → Master Data"><Select value={tf.statusCode} onChange={(ev) => setTf({ ...tf, statusCode: ev.target.value })} options={statuses.map((s) => ({ value: s.code ?? s.id, label: s.label }))} /></Field>
        </div>
      </Modal>

      {/* add document */}
      <Modal open={docModal} onClose={() => setDocModal(false)} title="Attach a document"
        footer={<><Button variant="ghost" onClick={() => setDocModal(false)}>Cancel</Button>
          <Button disabled={!df.filename} onClick={() => { addTalentDocument(open!, { type: df.type, filename: df.filename, sizeKb: 120 }); setDocModal(false); }}>Attach</Button></>}>
        <div className="space-y-3">
          <Field label="Type"><Select value={df.type} onChange={(ev) => setDf({ ...df, type: ev.target.value })} options={docTypes.map((d) => ({ value: d.label, label: d.label }))} /></Field>
          <Field label="Filename"><Input value={df.filename} onChange={(ev) => setDf({ ...df, filename: ev.target.value })} placeholder="reference-letter.pdf" /></Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-mist-300 bg-mist-50 px-3 py-3 text-sm text-mist-500">
            <input type="file" hidden onChange={(ev) => { const file = ev.target.files?.[0]; if (file) setDf({ ...df, filename: file.name }); }} />
            Or choose a file…
          </label>
        </div>
      </Modal>

      {viewDocs?.list && <DocViewer docs={viewDocs.list} startIndex={viewDocs.index} onClose={() => setViewDocs(null)} />}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">{icon} {title}</p>
      {children}
    </div>
  );
}
