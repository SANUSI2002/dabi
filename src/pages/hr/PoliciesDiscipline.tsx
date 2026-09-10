import { useState } from "react";
import { BookOpen, FileWarning, Plus, ShieldAlert, Mail, Send, Eye } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { useEmployees } from "@/store/useEmployees";
import { useHr } from "@/store/useHr";
import { useQueries } from "@/store/useQueries";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { useIdentity } from "@/store/useIdentity";
import { useTerm } from "@/platform/useTerminology";
import { ACCOUNTS } from "@/data/accounts";
import { QueryLetterDoc } from "@/components/print/documents";
import { shortDate, timeAgo } from "@/lib/format";
import type { PolicyCategory } from "@/data/hrProfile";

const CATEGORIES: PolicyCategory[] = ["Conduct", "Safety & Clinical", "Data & Security", "IT & Assets", "Leave & Attendance", "Other"];

export default function PoliciesDiscipline() {
  const { policies, disciplinaryActions, actionTypes, addPolicy, addActionType } = useEmployees();
  const staff = useHr((s) => s.staff);
  const byId = useHr((s) => s.byId);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const orgTerm = useTerm();
  const { queries, raiseQuery, markSent } = useQueries();
  const instanceFor = useWorkflow((s) => s.instanceFor);
  useWorkflow((s) => s.instances); // re-render when any instance changes
  const user = useIdentity((s) => s.user);
  const hrAdmin = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator");

  const [viewFor, setViewFor] = useState<string | null>(null);
  const [polOpen, setPolOpen] = useState(false);
  const [pf, setPf] = useState<{ category: PolicyCategory; title: string; purpose: string; body: string }>({ category: "Conduct", title: "", purpose: "", body: "" });
  const [typeOpen, setTypeOpen] = useState(false);
  const [tf, setTf] = useState({ name: "", blockOption: false });

  const [queryOpen, setQueryOpen] = useState(false);
  const [qf, setQf] = useState({ employeeId: staff[0]?.id ?? "", subject: "", body: "", responseDeadlineDays: 3 });
  const [printQuery, setPrintQuery] = useState<string | null>(null);

  function queryStatusFor(queryId: string) {
    const inst = instanceFor(queryId);
    if (!inst || inst.status === "Cancelled") return { label: "Not submitted", tone: "mist" as const };
    if (inst.status === "Running") {
      const step = inst.active[0]?.approverLabel ?? "sign-off";
      return { label: `Awaiting ${step}`, tone: "amber" as const };
    }
    if (inst.status === "Rejected") return { label: "Withdrawn", tone: "action" as const };
    return { label: "HR signed", tone: "brand" as const };
  }

  return (
    <div>
      <PageHeader title="Policies & Discipline" subtitle="Company policy library, disciplinary record and query letters" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Policies published" value={policies.length} tone="brand" icon={<BookOpen size={18} />} />
        <StatCard label="Disciplinary actions" value={disciplinaryActions.length} tone={disciplinaryActions.length ? "action" : "mist"} delay={0.05} icon={<FileWarning size={18} />} />
        <StatCard label="Queries raised" value={queries.length} tone="amber" delay={0.1} icon={<Mail size={18} />} />
        <StatCard label="Block-eligible types" value={actionTypes.filter((t) => t.blockOption).length} tone="mist" delay={0.15} icon={<ShieldAlert size={18} />} />
      </div>

      <Tabs tabs={["Policies", "Queries", "Disciplinary Actions", "Action Types"]}>
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
          ) : t === "Queries" ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => { setQf({ employeeId: staff[0]?.id ?? "", subject: "", body: "", responseDeadlineDays: 3 }); setQueryOpen(true); }}><Plus size={14} /> Raise query</Button>
              </div>
              {queries.length === 0 && <EmptyState title="No queries raised" hint={`A ${orgTerm("lineManager").toLowerCase()} raising a query against an employee will show up here, routed to HR for signature.`} />}
              {queries.map((q) => {
                const st = queryStatusFor(q.id);
                const approved = instanceFor(q.id)?.status === "Approved";
                return (
                  <Card key={q.id}>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold text-mist-900">{name(q.employeeId)}</p>
                        <p className="text-xs text-mist-500">RE: {q.subject}</p>
                        <p className="text-[11px] text-mist-400">Raised by {name(q.raisedBy)} · {timeAgo(q.raisedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={q.status === "Sent" ? "brand" : "amber"}>{q.status}</Badge>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </div>
                    <p className="mb-3 whitespace-pre-line rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">{q.body}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {!approved && q.status === "Drafted" && (
                        <p className="text-xs text-mist-400">See the <a href="/workflows/inbox" className="text-brand-600 hover:underline">Approvals Inbox</a> for the sign-off queue.</p>
                      )}
                      {approved && q.status === "Drafted" && (
                        <Button variant="soft" onClick={() => markSent(q.id)}><Send size={14} /> Mark sent</Button>
                      )}
                      {(approved || q.status === "Sent") && (
                        <Button variant="ghost" onClick={() => setPrintQuery(q.id)}><Eye size={14} /> View / print letter</Button>
                      )}
                    </div>
                  </Card>
                );
              })}
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
        open={queryOpen}
        onClose={() => setQueryOpen(false)}
        title="Raise disciplinary query"
        wide
        footer={<><Button variant="ghost" onClick={() => setQueryOpen(false)}>Cancel</Button>
          <Button
            disabled={!qf.subject.trim() || !qf.body.trim()}
            onClick={() => { raiseQuery({ employeeId: qf.employeeId, raisedBy: user.id, subject: qf.subject.trim(), body: qf.body.trim(), responseDeadlineDays: qf.responseDeadlineDays }); setQueryOpen(false); }}
          >
            Escalate to HR
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Employee"><Select value={qf.employeeId} onChange={(e) => setQf({ ...qf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Subject"><Input value={qf.subject} onChange={(e) => setQf({ ...qf, subject: e.target.value })} placeholder="e.g. Unexplained absence from duty" /></Field>
          <Field label="Query letter body"><Textarea className="min-h-[160px]" value={qf.body} onChange={(e) => setQf({ ...qf, body: e.target.value })} placeholder="State the facts, the policy or expectation breached, and what is being asked of the employee…" /></Field>
          <Field label="Response deadline (days)"><Input type="number" min="1" value={qf.responseDeadlineDays} onChange={(e) => setQf({ ...qf, responseDeadlineDays: +e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Routes to the employee's {orgTerm("lineManager").toLowerCase()} to confirm and escalate, then to HR for signature, before it can be sent.</p>
        </div>
      </Modal>

      {printQuery && (() => {
        const q = queries.find((x) => x.id === printQuery);
        if (!q) return null;
        const emp = byId(q.employeeId);
        return (
          <QueryLetterDoc
            employeeName={emp?.name ?? "—"}
            employeeRole={emp?.role ?? "—"}
            subject={q.subject}
            body={q.body}
            raisedByName={name(q.raisedBy)}
            hrSignatoryName={hrAdmin?.name ?? "HR"}
            raisedAt={q.raisedAt}
            responseDeadlineDays={q.responseDeadlineDays}
            open
            onClose={() => setPrintQuery(null)}
          />
        );
      })()}

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
