import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, X, Clock, ListOrdered, FileSpreadsheet } from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useLabConfig, newResultField } from "@/store/useLabConfig";
import { LAB_TESTS } from "@/data/catalog";
import type { ResultField } from "@/data/labConfig";

export default function LabTestSettings() {
  const { configFor, setTurnaround, setPhases, setTemplate } = useLabConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [tat, setTat] = useState(0);
  const [phases, setPhasesLocal] = useState<string[]>([]);
  const [template, setTemplateLocal] = useState<ResultField[]>([]);

  function open(testName: string) {
    const cfg = configFor(testName);
    setTat(cfg.turnaroundMinutes);
    setPhasesLocal([...cfg.phases]);
    setTemplateLocal(cfg.resultTemplate.map((f) => ({ ...f })));
    setEditing(testName);
  }

  function save() {
    if (!editing) return;
    setTurnaround(editing, tat);
    setPhases(editing, phases.filter((p) => p.trim()));
    setTemplate(editing, template.filter((f) => f.label.trim()));
    setEditing(null);
  }

  return (
    <div>
      <Link to="/laboratory" className="btn-ghost mb-4"><ArrowLeft size={15} /> Back to Laboratory</Link>
      <PageHeader title="Lab Test Settings" subtitle="Configure the phases, turnaround time and result template each test must follow" />

      <div className="grid gap-3 sm:grid-cols-2">
        {LAB_TESTS.map((t) => {
          const cfg = configFor(t.name);
          return (
            <Card key={t.name}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-mist-900">{t.name}</p>
                  <p className="text-[11px] text-mist-400">{t.category}</p>
                </div>
                <button onClick={() => open(t.name)} className="btn-ghost px-2.5 py-1 text-xs"><Pencil size={12} /> Configure</button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge tone="mist"><Clock size={11} /> {cfg.turnaroundMinutes} min</Badge>
                <Badge tone="mist"><ListOrdered size={11} /> {cfg.phases.length} phase{cfg.phases.length !== 1 ? "s" : ""}</Badge>
                <Badge tone="mist"><FileSpreadsheet size={11} /> {cfg.resultTemplate.length} template field{cfg.resultTemplate.length !== 1 ? "s" : ""}</Badge>
              </div>
              <p className="mt-2 truncate text-xs text-mist-500">{cfg.phases.join(" → ")} → Approval</p>
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Configure — ${editing ?? ""}`}
        wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save configuration</Button></>}
      >
        <div className="space-y-6">
          <Field label="Turnaround time (minutes)"><Input type="number" value={tat} onChange={(e) => setTat(+e.target.value)} /></Field>

          <div>
            <span className="label mb-2 block">Processing phases, in order (sign-off is added automatically as the final step)</span>
            <div className="space-y-2">
              {phases.map((ph, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mist-200 text-[11px] font-bold text-mist-600">{i + 1}</span>
                  <Input className="flex-1" value={ph} onChange={(e) => setPhasesLocal(phases.map((p, i2) => (i2 === i ? e.target.value : p)))} />
                  <button onClick={() => setPhasesLocal(phases.filter((_, i2) => i2 !== i))} className="btn-ghost px-2 py-1.5 text-xs text-action-500"><X size={13} /></button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setPhasesLocal([...phases, ""])}><Plus size={14} /> Add phase</Button>
            </div>
          </div>

          <div>
            <span className="label mb-2 block">Result template — the fields the lab fills in</span>
            <div className="space-y-2">
              {template.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl bg-mist-50 p-2.5">
                  <Input className="flex-1" placeholder="Field label" value={f.label} onChange={(e) => setTemplateLocal(template.map((x, i2) => (i2 === i ? { ...x, label: e.target.value } : x)))} />
                  <Input className="w-24" placeholder="Unit" value={f.unit ?? ""} onChange={(e) => setTemplateLocal(template.map((x, i2) => (i2 === i ? { ...x, unit: e.target.value } : x)))} />
                  <Input className="w-32" placeholder="Reference range" value={f.refRange ?? ""} onChange={(e) => setTemplateLocal(template.map((x, i2) => (i2 === i ? { ...x, refRange: e.target.value } : x)))} />
                  <Select className="w-28" value={f.type} onChange={(e) => setTemplateLocal(template.map((x, i2) => (i2 === i ? { ...x, type: e.target.value as ResultField["type"] } : x)))} options={["text", "number", "select"]} />
                  <button onClick={() => setTemplateLocal(template.filter((_, i2) => i2 !== i))} className="btn-ghost px-2 py-1.5 text-xs text-action-500"><X size={13} /></button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setTemplateLocal([...template, newResultField()])}><Plus size={14} /> Add field</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
