// Pure workflow-engine functions. No zustand, no domain imports.

import type {
  Condition,
  WorkflowContext,
  WorkflowDef,
  WorkflowNode,
  WorkflowEdge,
  EdgeBranch,
  ActiveNode,
} from "./model";

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(+v) ? +v : NaN);

export function evalCondition(c: Condition, ctx: WorkflowContext): boolean {
  const left = ctx[c.field];
  const right = c.value;
  switch (c.op) {
    case "eq":
      return String(left ?? "") === String(right);
    case "ne":
      return String(left ?? "") !== String(right);
    case "gt":
      return num(left) > num(right);
    case "gte":
      return num(left) >= num(right);
    case "lt":
      return num(left) < num(right);
    case "lte":
      return num(left) <= num(right);
    case "contains":
      return String(left ?? "").toLowerCase().includes(String(right).toLowerCase());
    case "in":
      return String(right)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(String(left ?? "").toLowerCase());
    default:
      return false;
  }
}

export function evalNode(node: WorkflowNode, ctx: WorkflowContext): boolean {
  const list = node.conditions ?? [];
  if (list.length === 0) return true;
  return node.conditionMatch === "any" ? list.some((c) => evalCondition(c, ctx)) : list.every((c) => evalCondition(c, ctx));
}

export const nodeById = (def: WorkflowDef, id: string) => def.nodes.find((n) => n.id === id);
export const startNode = (def: WorkflowDef) => def.nodes.find((n) => n.type === "start");
export const outgoing = (def: WorkflowDef, nodeId: string) => def.edges.filter((e) => e.from === nodeId);

/** the edge to follow out of `nodeId` for a given branch, falling back to "default" */
export function edgeFor(def: WorkflowDef, nodeId: string, branch: EdgeBranch): WorkflowEdge | undefined {
  const outs = outgoing(def, nodeId);
  return outs.find((e) => e.branch === branch) ?? outs.find((e) => e.branch === "default") ?? outs[0];
}

/** who approves `node`, given the request context. undefined = unresolvable */
export function resolveApprover(node: WorkflowNode, ctx: WorkflowContext): { id?: string; label: string } {
  switch (node.approverType) {
    case "initiator":
      return { id: ctx.initiatorId as string, label: "Initiator" };
    case "line-manager":
      return { id: ctx.lineManagerId as string, label: "Line manager" };
    case "hod":
      return { id: ctx.hodId as string, label: "Head of Department" };
    case "deputy-hod":
      return { id: ctx.deputyHodId as string, label: "Deputy HOD" };
    case "department-role":
      return { id: ctx[`roleHolder:${node.approverRef}`] as string, label: node.approverRef ?? "Department role" };
    case "specific-person":
      return { id: node.approverRef, label: "Named approver" };
    case "role":
      return { id: ctx[`roleHolder:${node.approverRef}`] as string, label: node.approverRef ?? "Role" };
    default:
      return { label: "Unassigned" };
  }
}

/**
 * Given a def, a node just satisfied and the branch taken, walk forward through
 * auto nodes (start / condition / notify) and return the next set of nodes that
 * need human action (approval / review / parallel / escalation) or an end node.
 *
 * Returns `{ active, ended }`. `ended` set means the instance terminates with
 * that outcome.
 */
export function walkFrom(
  def: WorkflowDef,
  fromNodeId: string,
  branch: EdgeBranch,
  ctx: WorkflowContext,
  onAuto?: (node: WorkflowNode, note: string) => void,
): { active: ActiveNode[]; ended?: "approved" | "rejected"; unresolved?: string[] } {
  const now = new Date().toISOString();
  const visited = new Set<string>();
  const queue: { nodeId: string; branch: EdgeBranch }[] = [];
  const active: ActiveNode[] = [];
  const unresolved: string[] = [];

  const edge = edgeFor(def, fromNodeId, branch);
  if (!edge) return { active: [], ended: "approved" }; // dead end after an approval → treat as approved
  queue.push({ nodeId: edge.to, branch: "default" });

  while (queue.length) {
    const { nodeId } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeById(def, nodeId);
    if (!node) continue;

    if (node.type === "end") {
      return { active: [], ended: node.outcome ?? "approved" };
    }

    if (node.type === "condition") {
      const pass = evalNode(node, ctx);
      onAuto?.(node, `condition ${pass ? "true" : "false"}`);
      const e = edgeFor(def, node.id, pass ? "true" : "false");
      if (e) queue.push({ nodeId: e.to, branch: "default" });
      else return { active, ended: "approved" };
      continue;
    }

    if (node.type === "notify") {
      onAuto?.(node, node.notifyText ?? "notification sent");
      const e = edgeFor(def, node.id, "default");
      if (e) queue.push({ nodeId: e.to, branch: "default" });
      continue;
    }

    if (node.type === "start") {
      const e = edgeFor(def, node.id, "default");
      if (e) queue.push({ nodeId: e.to, branch: "default" });
      continue;
    }

    // an escalation node reached via a timeout edge is a pass-through: follow its
    // own "timeout" (or default) edge to the fallback approver
    if (node.type === "escalation") {
      onAuto?.(node, `escalated after ${node.afterHours ?? 48}h`);
      const e = edgeFor(def, node.id, "timeout") ?? edgeFor(def, node.id, "default");
      if (e) queue.push({ nodeId: e.to, branch: "default" });
      continue;
    }

    // human nodes → become active
    if (node.type === "parallel") {
      const members = (node.members ?? []).map((m) => {
        const r = resolveApprover({ ...node, approverType: m.approverType, approverRef: m.approverRef } as WorkflowNode, ctx);
        if (!r.id) unresolved.push(`${node.label}: ${m.label}`);
        return { approverId: r.id, label: m.label, decision: "pending" as const };
      });
      active.push({ nodeId: node.id, enteredAt: now, memberDecisions: members, approverLabel: `Parallel (${node.joinMode ?? "all"})` });
      continue;
    }

    const r = resolveApprover(node, ctx);
    if (!r.id && node.approverType !== "specific-person") unresolved.push(node.label);
    active.push({ nodeId: node.id, approverId: r.id, approverLabel: r.label, enteredAt: now });
  }

  return { active, ended: active.length === 0 ? "approved" : undefined, unresolved: unresolved.length ? unresolved : undefined };
}

/** basic structural validation for the builder */
export function validateDef(def: WorkflowDef): string[] {
  const errs: string[] = [];
  const starts = def.nodes.filter((n) => n.type === "start");
  if (starts.length !== 1) errs.push("Exactly one Start node is required.");
  if (!def.nodes.some((n) => n.type === "end")) errs.push("At least one End node is required.");
  for (const n of def.nodes) {
    if (n.type === "start" && outgoing(def, n.id).length === 0) errs.push("Start node has no outgoing connection.");
    if ((n.type === "approval" || n.type === "review") && !n.approverType) errs.push(`"${n.label}" has no approver set.`);
    if (n.type === "condition") {
      const outs = outgoing(def, n.id);
      if (!outs.some((e) => e.branch === "true") || !outs.some((e) => e.branch === "false"))
        errs.push(`Condition "${n.label}" needs both a true and a false path.`);
    }
    if (n.type === "escalation" && !n.afterHours) errs.push(`Escalation "${n.label}" has no timeout hours.`);
  }
  // reachability from start
  const start = startNode(def);
  if (start) {
    const seen = new Set<string>();
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const e of outgoing(def, id)) stack.push(e.to);
    }
    for (const n of def.nodes) if (!seen.has(n.id)) errs.push(`"${n.label}" is not reachable from Start.`);
  }
  return errs;
}
