// Configurable workflow engine — graph model.
//
// A workflow is a directed graph of NODES connected by EDGES. It is triggered by
// a domain event ("leave", "promotion", "vacancy", "loan", "expense", "query",
// "lab-approval", …) and drives a WorkflowInstance to Approved / Rejected.
//
// The engine is domain-free: it never imports EMR / Workforce / Accounting. The
// consumer that starts an instance passes a `context` bag of pre-resolved facts
// (initiator, line-manager id, HOD id, department, amount, duration, …). Approval
// nodes read approver ids out of that context or off the node itself.

export type WorkflowNodeType =
  | "start"
  | "approval" // one person must approve or reject
  | "review" // like approval but framed as a check (approve = "reviewed")
  | "condition" // branch on the context: "true" edge vs "false" edge
  | "parallel" // fan out to several approvers; join on all / any / quorum
  | "notify" // side-effect only, then continue
  | "escalation" // waits N hours on the *incoming* approval, then follows "timeout"
  | "end"; // terminal — carries an outcome

export type ApproverType =
  | "initiator"
  | "line-manager"
  | "hod"
  | "deputy-hod"
  | "department-role" // approverRef = a role key resolved from context.roleHolders
  | "specific-person" // approverRef = staff id
  | "role"; // approverRef = a finance/workforce role name; first holder

export type ConditionOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";

export type Condition = {
  id: string;
  field: string; // key into instance.context, e.g. "amount", "durationDays", "salary", "departmentId", "employmentType"
  op: ConditionOp;
  value: string | number;
};

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  // approval / review / parallel members
  approverType?: ApproverType;
  approverRef?: string;
  // parallel
  joinMode?: "all" | "any" | "quorum";
  quorum?: number;
  members?: { approverType: ApproverType; approverRef?: string; label: string }[];
  // condition
  conditions?: Condition[];
  conditionMatch?: "all" | "any";
  // escalation
  afterHours?: number;
  // notify
  notifyText?: string;
  // end
  outcome?: "approved" | "rejected";
};

export type EdgeBranch = "approve" | "reject" | "true" | "false" | "timeout" | "default";

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  branch: EdgeBranch;
  label?: string;
};

export type WorkflowDef = {
  id: string;
  name: string;
  description?: string;
  triggerType: string; // master-data "approval-types" code, lowercased
  active: boolean;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ---------- runtime ----------

export type WorkflowContext = Record<string, string | number | boolean | undefined> & {
  initiatorId?: string;
  lineManagerId?: string;
  hodId?: string;
  deputyHodId?: string;
  departmentId?: string;
  roleHolders?: never; // (kept flat; role holders passed as roleHolder:<key> keys)
};

export type WorkflowEventAction =
  | "started"
  | "entered"
  | "approved"
  | "rejected"
  | "escalated"
  | "notified"
  | "auto"
  | "completed"
  | "cancelled";

export type WorkflowEvent = {
  id: string;
  nodeId: string;
  nodeLabel: string;
  action: WorkflowEventAction;
  actorId?: string;
  comment?: string;
  at: string;
};

export type ActiveNode = {
  nodeId: string;
  approverId?: string; // resolved when the node became active
  approverLabel?: string;
  enteredAt: string;
  // for parallel: per-member decisions
  memberDecisions?: { approverId?: string; label: string; decision: "pending" | "approved" | "rejected"; at?: string }[];
};

export type WorkflowInstance = {
  id: string;
  defId: string;
  defName: string;
  triggerType: string;
  subject: string;
  reference: string; // the domain document id
  context: WorkflowContext;
  initiatedBy: string;
  status: "Running" | "Approved" | "Rejected" | "Cancelled";
  active: ActiveNode[];
  history: WorkflowEvent[];
  createdAt: string;
  completedAt?: string;
};

export const NODE_META: Record<WorkflowNodeType, { label: string; color: string; hint: string }> = {
  start: { label: "Start", color: "brand", hint: "Where the request enters the workflow" },
  approval: { label: "Approval", color: "amber", hint: "One person approves or rejects" },
  review: { label: "Review", color: "amber", hint: "A checkpoint — reviewed or sent back" },
  condition: { label: "Condition", color: "mist", hint: "Branch on the request's data" },
  parallel: { label: "Parallel", color: "mist", hint: "Several approvers at once; join on all / any / quorum" },
  notify: { label: "Notify", color: "mist", hint: "Send a notification, then continue" },
  escalation: { label: "Escalation", color: "action", hint: "If the previous step stalls for N hours, take the timeout path" },
  end: { label: "End", color: "brand", hint: "Terminal — approved or rejected" },
};
