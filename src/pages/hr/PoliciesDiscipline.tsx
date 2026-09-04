import { useState } from "react";
import { BookOpen, FileWarning, Plus, ShieldAlert } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { useEmployees } from "@/store/useEmployees";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";
import type { PolicyCategory } from "@/data/hrProfile";

const CATEGORIES: PolicyCategory[] = ["Conduct", "Safety & Clinical", "Data & Security", "IT & Assets", "Leave & Attendance", "Other"];

export default function PoliciesDiscipline() {
  const { policies, disciplinaryActions, actionTypes, addPolicy, addActionType } = useEmployees();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const [viewFor, setViewFor] = useState<string | null>(null);
  const [polOpen, setPolOpen] = useState(false);
  const [pf, setPf] = useState<{ category: PolicyCategory; title: string; purpose: string; body: string }>({ category: "Conduct", title: "", purpose: "", body: "" });
  const [typeOpen, setTypeOpen] = useState(false);
  const [tf, setTf] = useState({ name: "", blockOption: false });

  return (
    <div>
      <PageHeader title="Policies & Discipline" subtitle="Company policy library and disciplinary record" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Policies published" value={policies.length} tone="brand" icon={<BookOpen size={18} />} />
        <StatCard label="Disciplinary actions" value={disciplinaryActions.length} tone={disciplinaryActions.length ? "action" : "mist"} delay={0.05} icon={<FileWarning size={18} />} />
        <StatCard label="Action types" value={actionTypes.length} tone="mist" delay={0.1} />
        <StatCard label="Block-eligible types" value={actionTypes.filter((t) => t.blockOption).length} tone="amber" delay={0.15} icon={<ShieldAlert size={18} />} />
      </div>

      <Tabs tabs={["Policies", "Disciplinary Actions", "Action Types"]}>
        {(t) =>
          t === "Policies" ? (
            <div className="space-y-3">
              <div className="flex justify-end"><Button onClick={() => { setPf({ category: "Conduct", title: "", purpose: "", body: "" }); setPolOpen(true); }}><Plus size={14} /> Publish policy</Button></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {policies.map((p) => (
                  <Card key={p.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge tone="mist">{p.category}</Badge>
                      <span className="text-[11px] text-mist-400">Updated {shortDate(p.updatedAt)}</span>
                    </div>
                    <p className="mb-1 font-display font-bold text-mist-900">{p.title}</p>
                    <p className="mb-2 text-xs text-mist-400">{p.purpose}</p>
                    <button onClick={() => setViewFor(p.id)} className="btn-ghost text-xs">View policy</button>
                  </Card>
                ))}
              </div>
            </div>
          ) : t === "Disciplinary Actions" ? (
            <Table columns={["Employees", "Action", "Description", "Duration", "Date"]}>
              {disciplinaryActions.map((a, i) => {
                const at = actionTypes.find((x) => x.id === a.actionTypeId);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{a.employeeIds.map(name).join(", ")}</Cell>
                    <Cell><Badge tone={at?.blockOption ? "action" : "amber"}>{at?.name ?? "—"}</Badge></Cell>
                    <Cell className="max-w-[320px] text-mist-600">{a.description}</Cell>
                    <Cell>{a.amount ? `${a.amount} ${a.unit.toLowerCase()}` : "—"}</Cell>
                    <Cell className="text-mist-400">{shortDate(a.startDate)}</Cell>
                  </Row>
                );
              })}
              {disciplinaryActions.length === 0 && <Row><Cell className="text-mist-400">No disciplinary actions recorded.</Cell><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setTf({ name: "", blockOption: false }); setTypeOpen(true); }}><Plus size={14} /> Add action type</Button></div>
              <Table columns={["Type", "Blocks profile edits"]}>
                {actionTypes.map((at, i) => (
                  <Row key={at.id} index={i}>
                    <Cell className="font-semibold">{at.name}</Cell>
                    <Cell><Badge tone={at.blockOption ? "action" : "mist"}>{at.blockOption ? "Yes" : "No"}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={!!viewFor}
        onClose={() => setViewFor(null)}
        title={policies.find((p) => p.id === viewFor)?.title ?? "Policy"}
        wide
        footer={<Button variant="ghost" onClick={() => setViewFor(null)}>Close</Button>}
      >
        {(() => {
          const p = policies.find((x) => x.id === viewFor);
          if (!p) return null;
          return (
            <div className="space-y-3 text-sm">
              <Badge tone="mist">{p.category}</Badge>
              <p><b>Purpose:</b> {p.purpose}</p>
              <p className="whitespace-pre-line text-mist-600">{p.body}</p>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={polOpen}
        onClose={() => setPolOpen(false)}
        title="Publish policy"
        wide
        footer={<><Button variant="ghost" onClick={() => setPolOpen(false)}>Cancel</Button>
          <Button disabled={!pf.title.trim() || !pf.body.trim()} onClick={() => { addPolicy(pf); setPolOpen(false); }}>Publish</Button></>}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={pf.title} onChange={(e) => setPf({ ...pf, title: e.target.value })} /></Field>
          <Field label="Category"><Select value={pf.category} onChange={(e) => setPf({ ...pf, category: e.target.value as PolicyCategory })} options={CATEGORIES} /></Field>
          <Field label="Purpose"><Input value={pf.purpose} onChange={(e) => setPf({ ...pf, purpose: e.target.value })} /></Field>
          <Field label="Body"><Textarea value={pf.body} onChange={(e) => setPf({ ...pf, body: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title="Add disciplinary action type"
        footer={<><Button variant="ghost" onClick={() => setTypeOpen(false)}>Cancel</Button>
          <Button disabled={!tf.name.trim()} onClick={() => { addActionType(tf.name.trim(), tf.blockOption); setTypeOpen(false); }}>Add</Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} /></Field>
          <Checkbox label="Blocks profile edits while active" checked={tf.blockOption} onChange={(e) => setTf({ ...tf, blockOption: e.target.checked })} />
        </div>
      </Modal>
    </div>
  );
}
