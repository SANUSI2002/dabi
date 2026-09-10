import { useMemo, useState } from "react";
import { FileText, Pencil, Eye, Plus } from "lucide-react";
import { PageHeader, Button, Card, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { LetterDoc } from "@/components/print/LetterDoc";
import { useLetters, templateTokens } from "@/platform/useLetters";
import type { LetterCategory, LetterTemplate } from "@/platform/letters";
import { term } from "@/platform/useTerminology";
import { shortDate } from "@/lib/format";

const CATEGORIES: LetterCategory[] = ["Onboarding", "Discipline", "Movement", "Finance", "General"];

// sample values so previews read like a real letter
const SAMPLE: Record<string, string> = {
  organisation: term("organisation", "singular"),
  department: `${term("department", "singular")} of Laboratory`,
  employee_name: "Grace Osei",
  candidate_name: "Grace Osei",
  position: "Laboratory Scientist",
  reporting_to: "Chief Laboratory Scientist",
  basic_salary: "NGN 420,000",
  employment_type: "Full-time",
  resumption_date: "1 October 2026",
  offer_deadline: "20 September 2026",
  issued_by: "A. Bello",
  issuer_role: "HR Officer",
  document_list: "• NYSC discharge certificate\n• Degree certificate (BMLS)",
  deadline: "25 September 2026",
  subject: "Lateness to duty",
  incident: "you reported for duty at 10:15am on 8 September 2026 without prior notice",
  response_days: "3",
  from_position: "Laboratory Scientist II",
  to_position: "Senior Laboratory Scientist",
  effective_date: "1 October 2026",
  new_salary: "NGN 520,000",
  new_reporting_to: "Head, Laboratory Services",
  from_branch: "Ikeja Branch",
  to_branch: "Lekki Branch",
  loan_reference: "LN-2026-0042",
  period_amount: "NGN 50,000",
  period_end: "30 September 2026",
  shortfall: "NGN 20,000",
  next_due: "NGN 70,000",
  warning_level: "first",
};

export default function LetterTemplates() {
  const { templates, generated, saveTemplate, addTemplate, letterById } = useLetters();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [viewLetterId, setViewLetterId] = useState<string | null>(null);

  const editing = templates.find((t) => t.key === editKey) ?? null;
  const previewT = templates.find((t) => t.key === previewKey) ?? null;
  const viewLetter = viewLetterId ? letterById(viewLetterId) : null;

  const byCategory = useMemo(
    () => CATEGORIES.map((c) => ({ category: c, items: templates.filter((t) => t.category === c) })).filter((g) => g.items.length),
    [templates],
  );

  return (
    <div>
      <PageHeader
        title="Letters & Documents"
        subtitle="Reusable templates for every HR letter — offer, outstanding-document notice, query, promotion, transfer, loan escalation, warning. Edit the wording; consumers fill the {{placeholders}}."
        actions={<Button onClick={() => setCreating(true)}><Plus size={15} /> New template</Button>}
      />

      <div className="space-y-4">
        {byCategory.map((g) => (
          <Card key={g.category} className="p-0">
            <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">{g.category}</p>
            <Table columns={["Template", "Placeholders", "Signatories", "Status", ""]}>
              {g.items.map((t, i) => (
                <Row key={t.key} index={i}>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-brand-500" />
                      <span className="font-medium text-mist-900">{t.name}</span>
                      {t.system && <Badge tone="mist">system</Badge>}
                    </div>
                  </Cell>
                  <Cell className="text-xs text-mist-500">{templateTokens(t.body).length}</Cell>
                  <Cell className="text-xs text-mist-500">{t.signatories.length}</Cell>
                  <Cell>{t.active !== false ? <Badge tone="brand">active</Badge> : <Badge tone="mist">off</Badge>}</Cell>
                  <Cell>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPreviewKey(t.key)}><Eye size={13} /> preview</button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditKey(t.key)}><Pencil size={13} /> edit</button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Generated letters ({generated.length})</p>
        {generated.length === 0 ? (
          <p className="px-4 py-6 text-sm text-mist-400">No letters generated yet. Consumers (onboarding, queries, loans…) log letters here when they generate them.</p>
        ) : (
          <Table columns={["Letter", "Reference", "Generated", "Sent", ""]}>
            {generated.map((l, i) => (
              <Row key={l.id} index={i}>
                <Cell className="font-medium text-mist-900">{l.title}</Cell>
                <Cell className="text-xs text-mist-500">{l.reference ?? "—"}</Cell>
                <Cell className="text-xs text-mist-500">{shortDate(l.generatedAt)}</Cell>
                <Cell className="text-xs text-mist-500">{l.sentAt ? `${shortDate(l.sentAt)} → ${l.sentTo}` : "—"}</Cell>
                <Cell><div className="flex justify-end"><button className="btn-ghost px-2 py-1 text-xs" onClick={() => setViewLetterId(l.id)}><Eye size={13} /> view</button></div></Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {editing && (
        <EditModal
          template={editing}
          onClose={() => setEditKey(null)}
          onSave={(patch) => { saveTemplate(editing.key, patch); setEditKey(null); }}
        />
      )}

      {creating && (
        <EditModal
          template={{ key: "", name: "", category: "General", body: "Dear {{employee_name}},\n\n", signatories: ["{{issued_by}} — Human Resources"], active: true }}
          isNew
          onClose={() => setCreating(false)}
          onSave={(patch) => {
            const key = (patch.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `tpl-${Date.now()}`;
            addTemplate({ key, name: patch.name ?? "Untitled", category: patch.category ?? "General", body: patch.body ?? "", signatories: patch.signatories ?? [], active: true });
            setCreating(false);
          }}
        />
      )}

      {previewT && <PreviewModal template={previewT} onClose={() => setPreviewKey(null)} />}

      {viewLetter && (
        <LetterDoc
          open
          onClose={() => setViewLetterId(null)}
          title={viewLetter.title}
          body={viewLetter.rendered}
          signatories={(templates.find((t) => t.key === viewLetter.templateKey)?.signatories ?? []).map((s) => renderWith(s, viewLetter.data))}
          reference={viewLetter.reference}
          date={viewLetter.generatedAt}
        />
      )}
    </div>
  );
}

function renderWith(s: string, data: Record<string, string>) {
  return s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => data[k] || "________");
}

function EditModal({
  template,
  isNew,
  onClose,
  onSave,
}: {
  template: LetterTemplate;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Pick<LetterTemplate, "name" | "body" | "signatories" | "active" | "category">>) => void;
}) {
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState<LetterCategory>(template.category);
  const [body, setBody] = useState(template.body);
  const [signatories, setSignatories] = useState(template.signatories.join("\n"));
  const [active, setActive] = useState(template.active !== false);
  const tokens = templateTokens(body);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={isNew ? "New letter template" : `Edit — ${template.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, category, body, signatories: signatories.split("\n").map((s) => s.trim()).filter(Boolean), active })}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Template name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Category">
            <Select options={CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value as LetterCategory)} />
          </Field>
        </div>
        <Field label="Body" hint="Use {{token}} placeholders. Blank lines separate paragraphs.">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[240px] font-mono text-xs" />
        </Field>
        <Field label="Signatories (one per line)" hint="{{tokens}} work here too, e.g. {{issued_by}} — Human Resources">
          <Textarea value={signatories} onChange={(e) => setSignatories(e.target.value)} className="min-h-[72px]" />
        </Field>
        <div>
          <p className="label mb-1">Placeholders used</p>
          <div className="flex flex-wrap gap-1.5">
            {tokens.length === 0 ? <span className="text-xs text-mist-400">none</span> : tokens.map((t) => (
              <code key={t} className="rounded bg-mist-100 px-1.5 py-0.5 text-[11px] text-mist-600">{`{{${t}}}`}</code>
            ))}
          </div>
        </div>
        {!template.system && (
          <label className="flex items-center gap-2 text-sm text-mist-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-mist-300 text-brand-600" />
            Active
          </label>
        )}
      </div>
    </Modal>
  );
}

function PreviewModal({ template, onClose }: { template: LetterTemplate; onClose: () => void }) {
  const tokens = templateTokens(template.body);
  const [data, setData] = useState<Record<string, string>>(() =>
    Object.fromEntries(tokens.map((t) => [t, SAMPLE[t] ?? ""])),
  );
  const [showDoc, setShowDoc] = useState(false);

  const body = renderWith(template.body, data);
  const signatories = template.signatories.map((s) => renderWith(s, data));

  return (
    <Modal open onClose={onClose} wide title={`Preview — ${template.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={() => setShowDoc(true)}>Open as document</Button></>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          <p className="label">Fill placeholders</p>
          {tokens.length === 0 && <p className="text-xs text-mist-400">This template has no placeholders.</p>}
          {tokens.map((t) => (
            <label key={t} className="block">
              <span className="text-[11px] text-mist-500">{t}</span>
              <Input value={data[t] ?? ""} onChange={(e) => setData((d) => ({ ...d, [t]: e.target.value }))} className="h-8" />
            </label>
          ))}
        </div>
        <div className="rounded-xl border border-mist-200 bg-white p-5 text-sm leading-relaxed text-mist-800">
          {body.split(/\n{2,}/).map((p, i) => <p key={i} className="mb-3 whitespace-pre-line">{p}</p>)}
          <div className="mt-6 flex flex-wrap gap-8 border-t border-mist-100 pt-4 text-[11px] text-mist-500">
            {signatories.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </div>
      </div>
      {showDoc && (
        <LetterDoc open onClose={() => setShowDoc(false)} title={template.name} body={body} signatories={signatories} />
      )}
    </Modal>
  );
}
