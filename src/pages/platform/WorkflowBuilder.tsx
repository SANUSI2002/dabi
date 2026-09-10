import { useMemo, useRef, useState } from "react";
import { Plus, Save, Play, GitBranch, X, Link2, Workflow as WorkflowIcon } from "lucide-react";
import { PageHeader, Button, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { NODE_META, type WorkflowDef, type WorkflowNode, type WorkflowNodeType, type EdgeBranch, type ApproverType, type Condition } from "@/platform/workflow/model";
import { cn } from "@/lib/cn";

const rid = () => Math.random().toString(36).slice(2, 9);
const NODE_W = 150;
const NODE_H = 56;

const APPROVER_LABELS: Record<ApproverType, string> = {
  initiator: "Initiator", "line-manager": "Line manager", hod: "Head of Department", "deputy-hod": "Deputy HOD",
  "department-role": "Department role", "specific-person": "Named person", role: "Platform role",
};

const NODE_TONE: Record<string, string> = {
  brand: "border-brand-300 bg-brand-50 text-brand-800",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  action: "border-action-300 bg-action-50 text-action-800",
  mist: "border-mist-300 bg-mist-50 text-mist-700",
};

export default function WorkflowBuilder() {
  const { defs, defById, createDef, saveDef, toggleDef, validate, start } = useWorkflow();
  const approvalTypes = ["leave", "promotion", "vacancy", "loan", "expense", "query", "transfer", "onboarding", "salary-adjustment", "purchase-request", "lab-approval"];

  const [selId, setSelId] = useState<string | null>(defs[0]?.id ?? null);
  const [newModal, setNewModal] = useState(false);
  const [nf, setNf] = useState({ name: "", triggerType: "leave", description: "" });
  const [draft, setDraft] = useState<WorkflowDef | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testModal, setTestModal] = useState(false);
  const [testCtx, setTestCtx] = useState('{ "durationDays": 14, "initiatorId": "s3", "lineManagerId": "s2", "hodId": "s1" }');
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const stored = selId ? defById(selId) : undefined;
  const def = draft && draft.id === selId ? draft : stored;
  const errs = useMemo(() => (selId ? validate(selId) : []), [selId, validate, def?.version]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(stored);

  function edit(patch: Partial<WorkflowDef>) {
    if (!def) return;
    setDraft({ ...def, ...patch });
  }
  function editNode(nodeId: string, patch: Partial<WorkflowNode>) {
    if (!def) return;
    setDraft({ ...def, nodes: def.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) });
  }
  function addNode(type: WorkflowNodeType) {
    if (!def) return;
    const n: WorkflowNode = {
      id: `n-${rid()}`, type, label: NODE_META[type].label,
      x: 120 + Math.round(Math.random() * 60), y: 120 + Math.round(Math.random() * 120),
      ...(type === "approval" || type === "review" ? { approverType: "line-manager" as ApproverType } : {}),
      ...(type === "condition" ? { conditions: [{ id: `c-${rid()}`, field: "amount", op: "gt" as const, value: 0 }], conditionMatch: "all" as const } : {}),
      ...(type === "escalation" ? { afterHours: 48 } : {}),
      ...(type === "parallel" ? { joinMode: "all" as const, members: [] } : {}),
      ...(type === "end" ? { outcome: "approved" as const } : {}),
    };
    setDraft({ ...def, nodes: [...def.nodes, n] });
    setSelNode(n.id);
  }
  function removeNode(nodeId: string) {
    if (!def) return;
    setDraft({ ...def, nodes: def.nodes.filter((n) => n.id !== nodeId), edges: def.edges.filter((e) => e.from !== nodeId && e.to !== nodeId) });
    setSelNode(null);
  }
  function addEdge(from: string, to: string, branch: EdgeBranch) {
    if (!def || from === to) return;
    setDraft({ ...def, edges: [...def.edges.filter((e) => !(e.from === from && e.to === to && e.branch === branch)), { id: `e-${rid()}`, from, to, branch }] });
  }
  function removeEdge(id: string) {
    if (!def) return;
    setDraft({ ...def, edges: def.edges.filter((e) => e.id !== id) });
  }

  function onPointerDown(e: React.PointerEvent, nodeId: string) {
    if (connectFrom) {
      if (connectFrom !== nodeId) {
        const branch = (prompt("Branch label: approve / reject / true / false / timeout / default", "default") || "default").trim() as EdgeBranch;
        addEdge(connectFrom, nodeId, branch);
      }
      setConnectFrom(null);
      return;
    }
    setSelNode(nodeId);
    const node = def?.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragRef.current = { id: nodeId, ox: e.clientX - node.x, oy: e.clientY - node.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    editNode(d.id, { x: Math.max(0, e.clientX - d.ox), y: Math.max(0, e.clientY - d.oy) });
  }
  function onPointerUp() { dragRef.current = null; }

  const node = def?.nodes.find((n) => n.id === selNode);

  return (
    <div>
      <PageHeader title="Workflow Builder" subtitle="Design branching approval workflows — conditions, parallel approvers, time escalation — for any process."
        actions={<Button onClick={() => { setNf({ name: "", triggerType: "leave", description: "" }); setNewModal(true); }}><Plus size={15} /> New Workflow</Button>} />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-max p-2">
          {defs.length === 0 ? <p className="p-2 text-sm text-mist-400">No workflows yet.</p> : defs.map((d) => (
            <button key={d.id} onClick={() => { setSelId(d.id); setDraft(null); setSelNode(null); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm", d.id === selId ? "bg-brand-50 font-semibold text-brand-700" : "text-mist-600 hover:bg-mist-50")}>
              <span className="min-w-0 truncate">{d.name}</span>
              <Badge tone={d.active ? "brand" : "mist"}>{d.active ? "on" : "off"}</Badge>
            </button>
          ))}
        </Card>

        {!def ? <EmptyState title="Pick or create a workflow" /> : (
          <div className="space-y-3">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <WorkflowIcon size={16} className="text-brand-600" />
                    <input className="input h-8 w-64 font-semibold" value={def.name} onChange={(e) => edit({ name: e.target.value })} />
                    <Badge tone="mist">trigger: {def.triggerType}</Badge>
                    <Badge tone="mist">v{def.version}</Badge>
                  </div>
                  {errs.length > 0 && <p className="mt-1 text-xs text-action-600">{errs.length} issue(s): {errs[0]}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="soft" onClick={() => setTestModal(true)}><Play size={13} /> Test run</Button>
                  <Button variant="soft" onClick={() => { toggleDef(def.id); setMsg(def.active ? "Deactivated." : "Activated."); }}>{def.active ? "Deactivate" : "Activate"}</Button>
                  <Button disabled={!dirty} onClick={() => { saveDef(draft!); setDraft(null); setMsg("Saved."); }}><Save size={13} /> Save</Button>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              {/* palette */}
              <Card className="w-40 shrink-0 p-2">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase text-mist-400">Add node</p>
                {(Object.keys(NODE_META) as WorkflowNodeType[]).filter((t) => t !== "start").map((t) => (
                  <button key={t} onClick={() => addNode(t)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-mist-50">
                    <span className={cn("h-2 w-2 rounded-full", `bg-${NODE_META[t].color}-400`)} /> {NODE_META[t].label}
                  </button>
                ))}
                <p className="mt-2 px-1 text-[10px] text-mist-400">Drag a node to move it. Use “Connect” on a node then click a target to link them.</p>
              </Card>

              {/* canvas */}
              <Card className="relative min-h-[460px] flex-1 overflow-auto p-0">
                <div className="relative h-[600px] w-[1200px]" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {def.edges.map((e) => {
                      const a = def.nodes.find((n) => n.id === e.from);
                      const b = def.nodes.find((n) => n.id === e.to);
                      if (!a || !b) return null;
                      const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
                      const mx = (x1 + x2) / 2;
                      const stroke = e.branch === "reject" || e.branch === "false" ? "#ef4444" : e.branch === "timeout" ? "#f59e0b" : "#94a3b8";
                      return (
                        <g key={e.id} className="pointer-events-auto cursor-pointer" onClick={() => removeEdge(e.id)}>
                          <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={stroke} strokeWidth={2} />
                          <circle cx={x2} cy={y2} r={3} fill={stroke} />
                          {(e.label || e.branch !== "default") && (
                            <text x={mx} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize={10} fill={stroke}>{e.label || e.branch}</text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  {def.nodes.map((n) => (
                    <div key={n.id}
                      onPointerDown={(e) => onPointerDown(e, n.id)}
                      style={{ left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H }}
                      className={cn("absolute cursor-grab select-none rounded-xl border-2 px-2.5 py-1.5 text-xs shadow-sm", NODE_TONE[NODE_META[n.type].color], selNode === n.id && "ring-2 ring-brand-400", connectFrom === n.id && "ring-2 ring-amber-400")}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold uppercase tracking-wide text-[9px] opacity-60">{n.type}</span>
                        {n.type !== "start" && <button onClick={(e) => { e.stopPropagation(); removeNode(n.id); }} className="opacity-50 hover:opacity-100"><X size={11} /></button>}
                      </div>
                      <div className="truncate font-semibold">{n.label}</div>
                      {(n.type === "approval" || n.type === "review") && <div className="truncate text-[10px] opacity-70">{APPROVER_LABELS[n.approverType ?? "line-manager"]}{n.approverRef ? ` · ${n.approverRef}` : ""}</div>}
                      {n.type === "condition" && <div className="text-[10px] opacity-70">{n.conditions?.[0]?.field} {n.conditions?.[0]?.op} {n.conditions?.[0]?.value}</div>}
                      {n.type === "escalation" && <div className="text-[10px] opacity-70">after {n.afterHours}h</div>}
                      {n.type === "end" && <div className="text-[10px] opacity-70">{n.outcome}</div>}
                      <button onClick={(e) => { e.stopPropagation(); setConnectFrom(connectFrom === n.id ? null : n.id); }} className="mt-1 rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-current/20">
                        <Link2 size={9} className="mr-0.5 inline" />{connectFrom === n.id ? "click target…" : "connect"}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>

              {/* config */}
              {node && (
                <Card className="w-64 shrink-0 space-y-2 p-3">
                  <p className="text-xs font-bold uppercase text-mist-400">{NODE_META[node.type].label} config</p>
                  <Field label="Label"><Input value={node.label} onChange={(e) => editNode(node.id, { label: e.target.value })} className="h-8" /></Field>

                  {(node.type === "approval" || node.type === "review") && (
                    <>
                      <Field label="Approver"><Select value={node.approverType} onChange={(e) => editNode(node.id, { approverType: e.target.value as ApproverType })} options={(Object.keys(APPROVER_LABELS) as ApproverType[]).map((k) => ({ value: k, label: APPROVER_LABELS[k] }))} /></Field>
                      {(node.approverType === "specific-person" || node.approverType === "role" || node.approverType === "department-role") && (
                        <Field label={node.approverType === "specific-person" ? "Staff id" : "Role / key"}><Input value={node.approverRef ?? ""} onChange={(e) => editNode(node.id, { approverRef: e.target.value })} className="h-8" placeholder={node.approverType === "role" ? "HR Administrator" : "chief-lab-scientist"} /></Field>
                      )}
                    </>
                  )}

                  {node.type === "condition" && (
                    <div className="space-y-2">
                      <Field label="Match"><Select value={node.conditionMatch ?? "all"} onChange={(e) => editNode(node.id, { conditionMatch: e.target.value as never })} options={[{ value: "all", label: "All conditions" }, { value: "any", label: "Any condition" }]} /></Field>
                      {(node.conditions ?? []).map((c, i) => (
                        <div key={c.id} className="grid grid-cols-[1fr_54px_1fr_20px] items-center gap-1">
                          <Input value={c.field} onChange={(e) => editCond(node, i, { field: e.target.value }, editNode)} className="h-7 text-xs" placeholder="field" />
                          <Select value={c.op} onChange={(e) => editCond(node, i, { op: e.target.value as never }, editNode)} options={["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"]} className="h-7 px-1 text-xs" />
                          <Input value={String(c.value)} onChange={(e) => editCond(node, i, { value: isNaN(+e.target.value) || e.target.value === "" ? e.target.value : +e.target.value }, editNode)} className="h-7 text-xs" placeholder="value" />
                          <button onClick={() => editNode(node.id, { conditions: (node.conditions ?? []).filter((_, j) => j !== i) })} className="text-action-500"><X size={12} /></button>
                        </div>
                      ))}
                      <button onClick={() => editNode(node.id, { conditions: [...(node.conditions ?? []), { id: `c-${rid()}`, field: "amount", op: "gt", value: 0 }] })} className="text-xs text-brand-600">+ condition</button>
                    </div>
                  )}

                  {node.type === "escalation" && (
                    <Field label="Timeout (hours)"><Input type="number" value={node.afterHours ?? 48} onChange={(e) => editNode(node.id, { afterHours: +e.target.value })} className="h-8" /></Field>
                  )}
                  {node.type === "parallel" && (
                    <>
                      <Field label="Join"><Select value={node.joinMode ?? "all"} onChange={(e) => editNode(node.id, { joinMode: e.target.value as never })} options={[{ value: "all", label: "All must approve" }, { value: "any", label: "Any one approves" }, { value: "quorum", label: "Quorum" }]} /></Field>
                      {node.joinMode === "quorum" && <Field label="Quorum"><Input type="number" value={node.quorum ?? 2} onChange={(e) => editNode(node.id, { quorum: +e.target.value })} className="h-8" /></Field>}
                      <button onClick={() => editNode(node.id, { members: [...(node.members ?? []), { approverType: "line-manager", label: `Approver ${(node.members?.length ?? 0) + 1}` }] })} className="text-xs text-brand-600">+ member</button>
                      {(node.members ?? []).map((m, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Select value={m.approverType} onChange={(e) => editNode(node.id, { members: (node.members ?? []).map((x, j) => (j === i ? { ...x, approverType: e.target.value as ApproverType } : x)) })} options={(Object.keys(APPROVER_LABELS) as ApproverType[]).map((k) => ({ value: k, label: APPROVER_LABELS[k] }))} className="h-7 text-xs" />
                          <button onClick={() => editNode(node.id, { members: (node.members ?? []).filter((_, j) => j !== i) })} className="text-action-500"><X size={12} /></button>
                        </div>
                      ))}
                    </>
                  )}
                  {node.type === "notify" && <Field label="Message"><Textarea value={node.notifyText ?? ""} onChange={(e) => editNode(node.id, { notifyText: e.target.value })} /></Field>}
                  {node.type === "end" && <Field label="Outcome"><Select value={node.outcome ?? "approved"} onChange={(e) => editNode(node.id, { outcome: e.target.value as never })} options={["approved", "rejected"]} /></Field>}

                  <div className="border-t border-mist-100 pt-2 text-[11px] text-mist-400">Outgoing:
                    {def.edges.filter((e) => e.from === node.id).map((e) => (
                      <span key={e.id} className="ml-1 inline-flex items-center gap-0.5"><GitBranch size={9} />{e.branch}→{def.nodes.find((n) => n.id === e.to)?.label}</span>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={newModal} onClose={() => setNewModal(false)} title="New Workflow"
        footer={<><Button variant="ghost" onClick={() => setNewModal(false)}>Cancel</Button><Button disabled={!nf.name} onClick={() => { const id = createDef(nf); setSelId(id); setDraft(null); setNewModal(false); }}>Create</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Salary Adjustment" /></Field>
          <Field label="Triggered by"><Select value={nf.triggerType} onChange={(e) => setNf({ ...nf, triggerType: e.target.value })} options={approvalTypes} /></Field>
          <Field label="Description"><Textarea value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={testModal} onClose={() => setTestModal(false)} title="Test run"
        footer={<><Button variant="ghost" onClick={() => setTestModal(false)}>Close</Button><Button onClick={() => {
          try {
            const ctx = JSON.parse(testCtx);
            const r = start({ triggerType: def!.triggerType, subject: "Test run", reference: `test-${rid()}`, context: ctx, defId: def!.id });
            setMsg(r.ok ? (r.autoApproved ? "Ran to completion — auto-approved (no human steps hit)." : `Started — instance ${r.instanceId}. Check the Approvals inbox.`) : (r.error ?? "Failed"));
            setTestModal(false);
          } catch { setMsg("Context must be valid JSON."); }
        }}>Run</Button></>}>
        <div className="space-y-2">
          <p className="text-sm text-mist-500">Provide the request context as JSON — the fields your conditions and approver rules read.</p>
          <Textarea value={testCtx} onChange={(e) => setTestCtx(e.target.value)} className="min-h-[120px] font-mono text-xs" />
        </div>
      </Modal>
    </div>
  );
}

function editCond(node: WorkflowNode, i: number, patch: Partial<Condition>, editNode: (id: string, p: Partial<WorkflowNode>) => void) {
  editNode(node.id, { conditions: (node.conditions ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) });
}
