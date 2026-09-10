import type { WorkflowDef } from "./model";

const now = "2026-09-01T00:00:00.000Z";
const base = { active: true, version: 1, createdBy: "s1", createdAt: now, updatedAt: now };

// Three seeded workflows that exercise the whole engine: a linear one, a
// branching one (salary threshold), and one with a time escalation.

export const seedWorkflowDefs: WorkflowDef[] = [
  {
    ...base,
    id: "wf-leave",
    name: "Leave Request",
    description: "Line manager, then HR. If the leave is longer than 10 days, HR approval is required regardless.",
    triggerType: "leave",
    nodes: [
      { id: "n1", type: "start", label: "Leave requested", x: 60, y: 140 },
      { id: "n2", type: "approval", label: "Line manager", x: 260, y: 140, approverType: "line-manager" },
      { id: "n3", type: "condition", label: "More than 10 days?", x: 470, y: 140, conditions: [{ id: "c1", field: "durationDays", op: "gt", value: 10 }], conditionMatch: "all" },
      { id: "n4", type: "approval", label: "HR approval", x: 690, y: 60, approverType: "role", approverRef: "HR Administrator" },
      { id: "n5", type: "end", label: "Approved", x: 900, y: 140, outcome: "approved" },
      { id: "n6", type: "end", label: "Rejected", x: 470, y: 300, outcome: "rejected" },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2", branch: "default" },
      { id: "e2", from: "n2", to: "n3", branch: "approve" },
      { id: "e3", from: "n2", to: "n6", branch: "reject" },
      { id: "e4", from: "n3", to: "n4", branch: "true", label: ">10 days" },
      { id: "e5", from: "n3", to: "n5", branch: "false", label: "≤10 days" },
      { id: "e6", from: "n4", to: "n5", branch: "approve" },
      { id: "e7", from: "n4", to: "n6", branch: "reject" },
    ],
  },
  {
    ...base,
    id: "wf-promotion",
    name: "Promotion",
    description: "HOD, then HR. If the new salary is above ₦500,000/month, an executive director must also sign off.",
    triggerType: "promotion",
    nodes: [
      { id: "p1", type: "start", label: "Promotion proposed", x: 60, y: 160 },
      { id: "p2", type: "approval", label: "Head of Department", x: 250, y: 160, approverType: "hod" },
      { id: "p3", type: "approval", label: "HR review", x: 450, y: 160, approverType: "role", approverRef: "HR Administrator" },
      { id: "p4", type: "condition", label: "New salary > ₦500k/mo?", x: 650, y: 160, conditions: [{ id: "pc1", field: "newSalary", op: "gt", value: 500000 }], conditionMatch: "all" },
      { id: "p5", type: "approval", label: "Executive sign-off", x: 860, y: 80, approverType: "role", approverRef: "Finance Controller" },
      { id: "p6", type: "end", label: "Approved", x: 1060, y: 160, outcome: "approved" },
      { id: "p7", type: "end", label: "Rejected", x: 450, y: 320, outcome: "rejected" },
    ],
    edges: [
      { id: "pe1", from: "p1", to: "p2", branch: "default" },
      { id: "pe2", from: "p2", to: "p3", branch: "approve" },
      { id: "pe3", from: "p2", to: "p7", branch: "reject" },
      { id: "pe4", from: "p3", to: "p4", branch: "approve" },
      { id: "pe5", from: "p3", to: "p7", branch: "reject" },
      { id: "pe6", from: "p4", to: "p5", branch: "true", label: "high" },
      { id: "pe7", from: "p4", to: "p6", branch: "false", label: "standard" },
      { id: "pe8", from: "p5", to: "p6", branch: "approve" },
      { id: "pe9", from: "p5", to: "p7", branch: "reject" },
    ],
  },
  {
    ...base,
    id: "wf-transfer",
    name: "Branch Transfer",
    description: "Line manager confirms, then HR signs off, before an employee's branch/facility changes.",
    triggerType: "transfer",
    nodes: [
      { id: "t1", type: "start", label: "Transfer proposed", x: 60, y: 150 },
      { id: "t2", type: "approval", label: "Line manager", x: 260, y: 150, approverType: "line-manager" },
      { id: "t3", type: "approval", label: "HR sign-off", x: 470, y: 150, approverType: "role", approverRef: "HR Administrator" },
      { id: "t4", type: "end", label: "Approved", x: 690, y: 150, outcome: "approved" },
      { id: "t5", type: "end", label: "Rejected", x: 470, y: 300, outcome: "rejected" },
    ],
    edges: [
      { id: "te1", from: "t1", to: "t2", branch: "default" },
      { id: "te2", from: "t2", to: "t3", branch: "approve" },
      { id: "te3", from: "t2", to: "t5", branch: "reject" },
      { id: "te4", from: "t3", to: "t4", branch: "approve" },
      { id: "te5", from: "t3", to: "t5", branch: "reject" },
    ],
  },
  {
    ...base,
    id: "wf-vacancy",
    name: "Vacancy Request",
    description: "HOD raises, HR approves. If HR does not act within 48 hours it escalates to an executive.",
    triggerType: "vacancy",
    nodes: [
      { id: "v1", type: "start", label: "Vacancy raised", x: 60, y: 150 },
      { id: "v2", type: "approval", label: "HR approval", x: 280, y: 150, approverType: "role", approverRef: "HR Administrator" },
      { id: "v3", type: "escalation", label: "48h no response", x: 280, y: 300, afterHours: 48 },
      { id: "v4", type: "approval", label: "Executive approval", x: 500, y: 300, approverType: "role", approverRef: "Finance Controller" },
      { id: "v5", type: "end", label: "Approved", x: 540, y: 150, outcome: "approved" },
      { id: "v6", type: "end", label: "Rejected", x: 280, y: 440, outcome: "rejected" },
    ],
    edges: [
      { id: "ve1", from: "v1", to: "v2", branch: "default" },
      { id: "ve2", from: "v2", to: "v5", branch: "approve" },
      { id: "ve3", from: "v2", to: "v6", branch: "reject" },
      { id: "ve4", from: "v2", to: "v3", branch: "timeout" },
      { id: "ve5", from: "v3", to: "v4", branch: "timeout" },
      { id: "ve6", from: "v4", to: "v5", branch: "approve" },
      { id: "ve7", from: "v4", to: "v6", branch: "reject" },
    ],
  },
];
