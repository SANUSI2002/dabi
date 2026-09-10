import { useState } from "react";
import { Check, X, Clock, GitPullRequestArrow, AlarmClock } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/form";
import { dateTime, timeAgo } from "@/lib/format";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { useIdentity } from "@/store/useIdentity";
import { useHr } from "@/store/useHr";

export default function WorkflowInbox() {
  const { instances, pendingFor, decide, cancel, tick } = useWorkflow();
  const uid = useIdentity((s) => s.user.id);
  const staff = useHr((s) => s.staff);
  const who = (id?: string) => staff.find((x) => x.id === id)?.name ?? id ?? "—";
  const [act, setAct] = useState<{ instanceId: string; nodeId: string; decision: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  const mine = pendingFor(uid);
  const running = instances.filter((i) => i.status === "Running");
  const di = detail ? instances.find((i) => i.id === detail) : null;

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Workflow instances running across the platform, and the steps waiting on you."
        actions={<Button variant="soft" onClick={() => { const r = tick(); alert(r.escalated ? `${r.escalated} stalled step(s) escalated.` : "Nothing to escalate."); }}><AlarmClock size={14} /> Run escalations</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Waiting on you" value={mine.length} tone={mine.length ? "action" : "brand"} icon={<GitPullRequestArrow size={18} />} />
        <StatCard label="Running" value={running.length} tone="amber" delay={0.05} />
        <StatCard label="Approved" value={instances.filter((i) => i.status === "Approved").length} tone="brand" delay={0.1} />
        <StatCard label="Rejected" value={instances.filter((i) => i.status === "Rejected").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["My inbox", "All instances"]}>
        {(t) => t === "My inbox" ? (
          mine.length === 0 ? <EmptyState title="Nothing waiting on you" /> : (
            <div className="space-y-2">
              {mine.map(({ instance, node, activeNode }) => (
                <Card key={`${instance.id}-${node.id}`} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-mist-800">{instance.subject}</p>
                    <p className="text-xs text-mist-500">{instance.defName} · step: <b>{node.label}</b> · raised by {who(instance.initiatedBy)} {timeAgo(instance.createdAt)}</p>
                    {node.type === "parallel" && <p className="text-[11px] text-mist-400">Parallel — {activeNode.memberDecisions?.filter((m) => m.decision !== "pending").length}/{activeNode.memberDecisions?.length} decided</p>}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setDetail(instance.id)}>View</button>
                    <button className="btn-action px-2.5 py-1 text-xs" onClick={() => { setComment(""); setAct({ instanceId: instance.id, nodeId: node.id, decision: "reject" }); }}><X size={12} /> Reject</button>
                    <button className="btn-primary px-2.5 py-1 text-xs" onClick={() => { setComment(""); setAct({ instanceId: instance.id, nodeId: node.id, decision: "approve" }); }}><Check size={12} /> Approve</button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : instances.length === 0 ? <EmptyState title="No workflow instances yet" hint="Start one from a Workforce request or the Workflow Builder's Test run." /> : (
          <Card className="p-0">
            <Table columns={["Subject", "Workflow", "Raised by", "Started", "Current step", "Status", ""]}>
              {instances.map((i, idx) => (
                <Row key={i.id} index={idx} onClick={() => setDetail(i.id)}>
                  <Cell className="font-semibold">{i.subject}</Cell>
                  <Cell>{i.defName}</Cell>
                  <Cell>{who(i.initiatedBy)}</Cell>
                  <Cell className="whitespace-nowrap text-mist-500">{timeAgo(i.createdAt)}</Cell>
                  <Cell className="text-mist-500">{i.active.map((a) => a.approverLabel).join(", ") || "—"}</Cell>
                  <Cell><Badge tone={statusTone(i.status.toLowerCase())}>{i.status}</Badge></Cell>
                  <Cell>{i.status === "Running" && <button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); cancel(i.id, "cancelled by admin"); }}>Cancel</button>}</Cell>
                </Row>
              ))}
            </Table>
          </Card>
        )}
      </Tabs>

      <Modal open={!!act} onClose={() => setAct(null)} title={act?.decision === "approve" ? "Approve step" : "Reject step"}
        footer={<><Button variant="ghost" onClick={() => setAct(null)}>Cancel</Button>
          <Button variant={act?.decision === "approve" ? "primary" : "action"} onClick={() => { if (act) { const r = decide(act.instanceId, act.nodeId, act.decision, { comment: comment || undefined }); if (!r.ok) alert(r.error); setAct(null); } }}>{act?.decision === "approve" ? "Approve" : "Reject"}</Button></>}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" />
      </Modal>

      <Modal open={!!di} onClose={() => setDetail(null)} title={di?.subject ?? ""} wide
        footer={<Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>}>
        {di && (
          <div className="space-y-3">
            <div className="grid gap-1 rounded-lg bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Workflow</span> · {di.defName}</div>
              <div><span className="text-mist-400">Trigger</span> · {di.triggerType}</div>
              <div><span className="text-mist-400">Reference</span> · {di.reference}</div>
              <div><span className="text-mist-400">Status</span> · <b>{di.status}</b></div>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase text-mist-400">History</h4>
              <div className="space-y-1">
                {di.history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">{h.action === "approved" ? <Check size={13} className="text-brand-600" /> : h.action === "rejected" ? <X size={13} className="text-action-600" /> : h.action === "escalated" ? <AlarmClock size={13} className="text-amber-600" /> : <Clock size={13} className="text-mist-400" />}</span>
                    <div>
                      <span className="font-medium">{h.nodeLabel}</span> — {h.action}{h.actorId ? ` by ${who(h.actorId)}` : ""}{h.comment ? ` · ${h.comment}` : ""}
                      <span className="ml-1 text-xs text-mist-400">{dateTime(h.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
