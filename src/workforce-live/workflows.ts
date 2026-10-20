import { create } from "zustand";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { nodeById } from "@/platform/workflow/engine";
import type { ActiveNode, WorkflowDef, WorkflowInstance, WorkflowNode } from "@/platform/workflow/model";
import { workforceRequest } from "@/emr-live/client";
import { liveChange, useWorkforceSync, uuid } from "./sync";

// Approval workflows in live mode (GET /workflows): the Workflow Builder edits the organization's own
// definitions and the Approvals inbox decides real requests. Who may decide a step is worked out by
// the server; the inbox lists exactly the steps the server says are yours. A request can only be
// started for a kind of document the server has connected (or as a Builder test run).

type Graph = Pick<WorkflowDef, "nodes" | "edges">;
type ApiInstance = WorkflowInstance & { isTest: boolean; version: number; graph: Graph };
type ApiWorkflows = {
  selfEmployeeId: string | null; canManage: boolean; connectedTriggers: string[];
  defs: WorkflowDef[]; instances: ApiInstance[]; inbox: { instanceId: string; nodeId: string }[];
};

export const useLiveWorkflowMeta = create<{ loaded: boolean; inbox: { instanceId: string; nodeId: string }[]; connectedTriggers: string[]; graphs: Record<string, Graph> }>(() => ({
  loaded: false, inbox: [], connectedTriggers: [], graphs: {},
}));

export async function loadWorkflows() {
  const { data } = await workforceRequest<{ data: ApiWorkflows }>("/workflows");
  useLiveWorkflowMeta.setState({ loaded: true, inbox: data.inbox, connectedTriggers: data.connectedTriggers, graphs: Object.fromEntries(data.instances.map((i) => [i.id, i.graph])) });
  useWorkflow.setState({ defs: data.defs, instances: data.instances });
}

const reload = () => loadWorkflows();
const post = (path: string, body: unknown, version?: number) => workforceRequest(path, { method: "POST", body, ...(version !== undefined ? { version } : {}) });
/** The graph an instance runs on: the snapshot it started with. */
const graphOf = (inst: WorkflowInstance): Graph | undefined => useLiveWorkflowMeta.getState().graphs[inst.id] ?? useWorkflow.getState().defById(inst.defId);
const NOT_CONNECTED = "Approvals for this kind of request are not connected to live records yet.";

/** Steps whose timeout has passed — what the server's escalation run will move on. */
function dueEscalations(now = Date.now()) {
  let due = 0;
  for (const inst of useWorkflow.getState().instances.filter((i) => i.status === "Running")) {
    const graph = graphOf(inst);
    if (!graph) continue;
    for (const a of inst.active) {
      const node = nodeById(graph as WorkflowDef, a.nodeId);
      if (!node || (node.type !== "approval" && node.type !== "review")) continue;
      const out = graph.edges.find((e) => e.from === a.nodeId && e.branch === "timeout");
      if (!out) continue;
      const esc = nodeById(graph as WorkflowDef, out.to);
      const hours = esc?.type === "escalation" ? esc.afterHours ?? 48 : 48;
      if (now - new Date(a.enteredAt).getTime() >= hours * 3_600_000) due += 1;
    }
  }
  return due;
}

export function goLiveWorkflows() {
  useWorkflow.setState({
    createDef: (input) => {
      const id = uuid();
      const now = new Date().toISOString();
      const def: WorkflowDef = {
        id, name: input.name, description: input.description, triggerType: input.triggerType, active: false, version: 1, createdBy: "", createdAt: now, updatedAt: now,
        nodes: [
          { id: "start", type: "start", label: "Start", x: 60, y: 160 },
          { id: "end-ok", type: "end", label: "Approved", x: 520, y: 100, outcome: "approved" },
          { id: "end-no", type: "end", label: "Rejected", x: 520, y: 260, outcome: "rejected" },
        ],
        edges: [],
      };
      void liveChange(() => post("/workflows/defs", { id, name: input.name, triggerType: input.triggerType, description: input.description || undefined }), reload, () => useWorkflow.setState((s) => ({ defs: [def, ...s.defs] })));
      return id;
    },
    saveDef: (def) => {
      const stored = useWorkflow.getState().defById(def.id);
      void liveChange(
        () => workforceRequest(`/workflows/defs/${def.id}`, { method: "PUT", version: stored?.version ?? def.version, body: { name: def.name, description: def.description ?? "", triggerType: def.triggerType, nodes: def.nodes, edges: def.edges } }),
        reload,
        () => useWorkflow.setState((s) => ({ defs: s.defs.map((d) => (d.id === def.id ? { ...def, version: d.version } : d)) })),
      );
    },
    toggleDef: (id) => {
      const d = useWorkflow.getState().defById(id);
      if (!d) return;
      void liveChange(() => post(`/workflows/defs/${id}/active`, { active: !d.active }), reload);
    },
    deleteDef: () => { useWorkforceSync.getState().report("Workflows are kept for the record; switch one off instead of deleting it."); },

    start: (input) => {
      const id = uuid();
      const test = input.reference.startsWith("test-");
      if (!test && !useLiveWorkflowMeta.getState().connectedTriggers.includes(input.triggerType)) return { ok: false, error: NOT_CONNECTED };
      void liveChange(() => post("/workflows/instances", test
        ? { id, triggerType: input.triggerType, defId: input.defId, subject: input.subject, context: input.context }
        : { id, triggerType: input.triggerType, reference: input.reference, subject: input.subject }), reload);
      return { ok: true, instanceId: id, autoApproved: false };
    },
    decide: (instanceId, nodeId, decision, opts) => {
      void liveChange(
        () => post(`/workflows/instances/${instanceId}/decide`, { nodeId, decision, ...(opts?.comment ? { comment: opts.comment } : {}) }),
        reload,
        () => useLiveWorkflowMeta.setState((s) => ({ inbox: s.inbox.filter((x) => !(x.instanceId === instanceId && x.nodeId === nodeId)) })),
      );
      return { ok: true };
    },
    cancel: (instanceId, reason) => { void liveChange(() => post(`/workflows/instances/${instanceId}/cancel`, reason ? { reason } : {}), reload); },
    tick: () => {
      const escalated = dueEscalations();
      void liveChange(() => post("/workflows/escalations", {}), reload);
      return { escalated };
    },
    pendingFor: () => {
      const out: { instance: WorkflowInstance; node: WorkflowNode; activeNode: ActiveNode }[] = [];
      for (const { instanceId, nodeId } of useLiveWorkflowMeta.getState().inbox) {
        const instance = useWorkflow.getState().instances.find((i) => i.id === instanceId);
        const graph = instance && graphOf(instance);
        const node = graph && nodeById(graph as WorkflowDef, nodeId);
        const activeNode = instance?.active.find((a) => a.nodeId === nodeId);
        if (instance && node && activeNode) out.push({ instance, node, activeNode });
      }
      return out;
    },
  });
}

export function clearWorkflows() {
  useLiveWorkflowMeta.setState({ loaded: false, inbox: [], connectedTriggers: [], graphs: {} });
  useWorkflow.setState({ defs: [], instances: [] });
}
