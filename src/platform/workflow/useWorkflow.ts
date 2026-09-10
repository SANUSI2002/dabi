import { create } from "zustand";
import { persisted } from "../persist";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { seedWorkflowDefs } from "./seed";
import { walkFrom, startNode, nodeById, edgeFor, validateDef } from "./engine";
import type {
  WorkflowDef,
  WorkflowInstance,
  WorkflowContext,
  WorkflowEvent,
  ActiveNode,
  WorkflowNode,
} from "./model";

const rid = () => Math.random().toString(36).slice(2, 9);
const ev = (nodeId: string, nodeLabel: string, action: WorkflowEvent["action"], extra?: Partial<WorkflowEvent>): WorkflowEvent => ({
  id: `we-${rid()}`,
  nodeId,
  nodeLabel,
  action,
  at: new Date().toISOString(),
  ...extra,
});

type WorkflowState = {
  defs: WorkflowDef[];
  instances: WorkflowInstance[];

  // ----- definitions (persisted) -----
  defsForTrigger: (triggerType: string) => WorkflowDef[];
  defById: (id: string) => WorkflowDef | undefined;
  saveDef: (def: WorkflowDef) => void;
  createDef: (input: { name: string; triggerType: string; description?: string }) => string;
  toggleDef: (id: string) => void;
  deleteDef: (id: string) => void;
  validate: (id: string) => string[];

  // ----- instances (runtime) -----
  start: (input: {
    triggerType: string;
    subject: string;
    reference: string;
    context: WorkflowContext;
    defId?: string;
  }) => { ok: boolean; error?: string; instanceId?: string; autoApproved?: boolean };
  decide: (instanceId: string, nodeId: string, decision: "approve" | "reject", opts?: { actorId?: string; comment?: string }) => { ok: boolean; error?: string };
  cancel: (instanceId: string, reason?: string) => void;
  tick: (nowIso?: string) => { escalated: number };

  instanceFor: (reference: string) => WorkflowInstance | undefined;
  instancesForTrigger: (triggerType: string) => WorkflowInstance[];
  pendingFor: (userId: string) => { instance: WorkflowInstance; node: WorkflowNode; activeNode: ActiveNode }[];
  isApproved: (reference: string) => boolean;
  outcomeOf: (reference: string) => WorkflowInstance["status"] | undefined;
};

export const useWorkflow = create<WorkflowState>(
  persisted<WorkflowState>(
    "workflow",
    (set, get) => ({
      defs: seedWorkflowDefs,
      instances: [],

      defsForTrigger: (t) => get().defs.filter((d) => d.active && d.triggerType === t),
      defById: (id) => get().defs.find((d) => d.id === id),
      saveDef: (def) => {
        set((s) => ({ defs: s.defs.map((d) => (d.id === def.id ? { ...def, version: d.version + 1, updatedAt: new Date().toISOString() } : d)) }));
        audit(`updated workflow "${def.name}"`, `platform/workflow/${def.id}`);
      },
      createDef: (input) => {
        const id = `wf-${rid()}`;
        const nowIso = new Date().toISOString();
        const def: WorkflowDef = {
          id,
          name: input.name,
          description: input.description,
          triggerType: input.triggerType,
          active: false,
          version: 1,
          createdBy: useIdentity.getState().user.id,
          createdAt: nowIso,
          updatedAt: nowIso,
          nodes: [
            { id: "start", type: "start", label: "Start", x: 60, y: 160 },
            { id: "end-ok", type: "end", label: "Approved", x: 520, y: 100, outcome: "approved" },
            { id: "end-no", type: "end", label: "Rejected", x: 520, y: 260, outcome: "rejected" },
          ],
          edges: [],
        };
        set((s) => ({ defs: [def, ...s.defs] }));
        audit(`created workflow "${input.name}" for ${input.triggerType}`, `platform/workflow/${id}`);
        return id;
      },
      toggleDef: (id) => {
        const d = get().defById(id);
        if (d && !d.active && validateDef(d).length) return; // don't activate an invalid graph
        set((s) => ({ defs: s.defs.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));
      },
      deleteDef: (id) => set((s) => ({ defs: s.defs.filter((d) => d.id !== id) })),
      validate: (id) => {
        const d = get().defById(id);
        return d ? validateDef(d) : ["Workflow not found."];
      },

      start: (input) => {
        const def = input.defId ? get().defById(input.defId) : get().defsForTrigger(input.triggerType)[0];
        if (!def) return { ok: false, error: `No active workflow configured for "${input.triggerType}".` };
        const sn = startNode(def);
        if (!sn) return { ok: false, error: "Workflow has no start node." };

        const me = useIdentity.getState().user.id;
        const id = `wfi-${rid()}`;
        const history: WorkflowEvent[] = [ev(sn.id, sn.label, "started", { actorId: input.context.initiatorId as string ?? me })];

        const res = walkFrom(def, sn.id, "default", input.context, (node, note) => history.push(ev(node.id, node.label, "auto", { comment: note })));
        const instance: WorkflowInstance = {
          id,
          defId: def.id,
          defName: def.name,
          triggerType: input.triggerType,
          subject: input.subject,
          reference: input.reference,
          context: input.context,
          initiatedBy: me,
          status: res.ended ? (res.ended === "approved" ? "Approved" : "Rejected") : "Running",
          active: res.active,
          history,
          createdAt: new Date().toISOString(),
          completedAt: res.ended ? new Date().toISOString() : undefined,
        };
        for (const a of instance.active) history.push(ev(a.nodeId, nodeById(def, a.nodeId)?.label ?? a.nodeId, "entered", { comment: a.approverLabel }));
        if (res.ended) history.push(ev("end", "Workflow", "completed", { comment: res.ended }));

        set((s) => ({ instances: [instance, ...s.instances] }));
        audit(`started "${def.name}" workflow — ${input.subject}`, `platform/workflow/instance/${input.reference}`);
        return { ok: true, instanceId: id, autoApproved: instance.status === "Approved" };
      },

      decide: (instanceId, nodeId, decision, opts) => {
        const inst = get().instances.find((i) => i.id === instanceId);
        if (!inst || inst.status !== "Running") return { ok: false, error: "Not a running workflow." };
        const def = get().defById(inst.defId);
        if (!def) return { ok: false, error: "Workflow definition missing." };
        const an = inst.active.find((a) => a.nodeId === nodeId);
        const node = nodeById(def, nodeId);
        if (!an || !node) return { ok: false, error: "That step is not active." };
        const actor = opts?.actorId ?? useIdentity.getState().user.id;

        // parallel member decision
        if (node.type === "parallel" && an.memberDecisions) {
          const mine = an.memberDecisions.find((m) => m.approverId === actor && m.decision === "pending");
          if (!mine) return { ok: false, error: "You have no pending part on this step." };
          mine.decision = decision === "approve" ? "approved" : "rejected";
          mine.at = new Date().toISOString();
          inst.history.push(ev(nodeId, node.label, decision === "approve" ? "approved" : "rejected", { actorId: actor, comment: opts?.comment ?? mine.label }));
          const decided = an.memberDecisions.filter((m) => m.decision !== "pending");
          const approvals = decided.filter((m) => m.decision === "approved").length;
          const rejections = decided.filter((m) => m.decision === "rejected").length;
          const need = node.joinMode === "any" ? 1 : node.joinMode === "quorum" ? node.quorum ?? an.memberDecisions.length : an.memberDecisions.length;
          let branch: "approve" | "reject" | undefined;
          if (rejections > 0 && node.joinMode !== "any") branch = "reject";
          else if (approvals >= need) branch = "approve";
          else if (decided.length === an.memberDecisions.length) branch = "reject";
          if (!branch) { set((s) => ({ instances: [...s.instances] })); return { ok: true }; }
          return applyBranch(inst, def, node, branch, actor, opts?.comment, set, get);
        }

        // single approver
        if (an.approverId && an.approverId !== actor) {
          // allow Finance Controller override style? keep strict for now
          return { ok: false, error: "This step is assigned to someone else." };
        }
        inst.history.push(ev(nodeId, node.label, decision === "approve" ? "approved" : "rejected", { actorId: actor, comment: opts?.comment }));
        return applyBranch(inst, def, node, decision, actor, opts?.comment, set, get);
      },

      cancel: (instanceId, reason) => {
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId && i.status === "Running"
              ? { ...i, status: "Cancelled", completedAt: new Date().toISOString(), active: [], history: [...i.history, ev("-", "Workflow", "cancelled", { comment: reason })] }
              : i,
          ),
        }));
      },

      tick: (nowIso) => {
        const now = new Date(nowIso ?? new Date().toISOString()).getTime();
        let escalated = 0;
        for (const inst of get().instances.filter((i) => i.status === "Running")) {
          const def = get().defById(inst.defId);
          if (!def) continue;
          for (const an of [...inst.active]) {
            const node = nodeById(def, an.nodeId);
            if (!node || (node.type !== "approval" && node.type !== "review")) continue;
            // is there a timeout edge out of this node (directly or via an escalation node)?
            const toEsc = edgeFor(def, an.nodeId, "timeout");
            if (!toEsc) continue;
            const escNode = nodeById(def, toEsc.to);
            const hours = escNode?.type === "escalation" ? escNode.afterHours ?? 48 : 48;
            if (now - new Date(an.enteredAt).getTime() < hours * 3600_000) continue;
            inst.history.push(ev(an.nodeId, node.label, "escalated", { comment: `no response in ${hours}h` }));
            const res = advanceThrough(def, an.nodeId, "timeout", inst.context, inst);
            inst.active = inst.active.filter((x) => x.nodeId !== an.nodeId).concat(res.active);
            finalizeIfEnded(inst, res.ended);
            escalated++;
          }
        }
        if (escalated) {
          set((s) => ({ instances: [...s.instances] }));
          audit(`escalated ${escalated} stalled workflow step(s)`, "platform/workflow/tick");
        }
        return { escalated };
      },

      instanceFor: (reference) => get().instances.find((i) => i.reference === reference),
      instancesForTrigger: (t) => get().instances.filter((i) => i.triggerType === t),
      pendingFor: (userId) => {
        const out: { instance: WorkflowInstance; node: WorkflowNode; activeNode: ActiveNode }[] = [];
        for (const inst of get().instances.filter((i) => i.status === "Running")) {
          const def = get().defById(inst.defId);
          if (!def) continue;
          for (const an of inst.active) {
            const node = nodeById(def, an.nodeId);
            if (!node) continue;
            if (node.type === "parallel") {
              if (an.memberDecisions?.some((m) => m.approverId === userId && m.decision === "pending")) out.push({ instance: inst, node, activeNode: an });
            } else if (!an.approverId || an.approverId === userId) {
              out.push({ instance: inst, node, activeNode: an });
            }
          }
        }
        return out;
      },
      isApproved: (reference) => get().instanceFor(reference)?.status === "Approved",
      outcomeOf: (reference) => get().instanceFor(reference)?.status,
    }),
    {
      pick: (s) => ({ defs: s.defs, instances: s.instances.slice(0, 300) }),
      // keep persisted defs, but add any seed def (by id) that shipped since the
      // store was last saved — so new triggers like "transfer" work without a wipe
      merge: (base, saved) => {
        const savedDefs = (saved.defs ?? []) as WorkflowDef[];
        const known = new Set(savedDefs.map((d) => d.id));
        const missingSeeds = base.defs.filter((d) => !known.has(d.id));
        return { ...base, ...saved, defs: [...savedDefs, ...missingSeeds] };
      },
    },
  ),
);

// ---------- helpers (module scope so `decide` stays readable) ----------

function advanceThrough(def: WorkflowDef, fromNodeId: string, branch: "approve" | "reject" | "true" | "false" | "timeout", ctx: WorkflowContext, inst: WorkflowInstance) {
  const res = walkFrom(def, fromNodeId, branch, ctx, (node, note) => inst.history.push(ev(node.id, node.label, "auto", { comment: note })));
  for (const a of res.active) inst.history.push(ev(a.nodeId, nodeById(def, a.nodeId)?.label ?? a.nodeId, "entered", { comment: a.approverLabel }));
  return res;
}

function finalizeIfEnded(inst: WorkflowInstance, ended?: "approved" | "rejected") {
  if (!ended) return;
  inst.status = ended === "approved" ? "Approved" : "Rejected";
  inst.completedAt = new Date().toISOString();
  inst.active = [];
  inst.history.push(ev("end", "Workflow", "completed", { comment: ended }));
}

function applyBranch(
  inst: WorkflowInstance,
  def: WorkflowDef,
  node: WorkflowNode,
  decision: "approve" | "reject",
  _actor: string,
  _comment: string | undefined,
  set: (fn: (s: WorkflowState) => Partial<WorkflowState>) => void,
  _get: () => WorkflowState,
): { ok: boolean; error?: string } {
  const res = advanceThrough(def, node.id, decision, inst.context, inst);
  inst.active = inst.active.filter((a) => a.nodeId !== node.id).concat(res.active);
  finalizeIfEnded(inst, res.ended);
  if (inst.status === "Running" && inst.active.length === 0) finalizeIfEnded(inst, "approved");
  set((s) => ({ instances: s.instances.map((i) => (i.id === inst.id ? { ...inst } : i)) }));
  return { ok: true };
}
