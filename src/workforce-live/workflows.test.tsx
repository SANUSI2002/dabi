import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import WorkflowInbox from "@/pages/platform/WorkflowInbox";
import WorkflowBuilder from "@/pages/platform/WorkflowBuilder";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveWorkflowMeta } from "./workflows";
import type { WorkflowDef } from "@/platform/workflow/model";
import { useWorkforceSync } from "./sync";

const graph: Pick<WorkflowDef, "nodes" | "edges"> = {
  nodes: [
    { id: "o1", type: "start", label: "Submitted for review", x: 60, y: 150 },
    { id: "o2", type: "approval", label: "HR review", x: 280, y: 150, approverType: "role", approverRef: "HR Administrator" },
    { id: "o3", type: "end", label: "Cleared to convert", x: 500, y: 150, outcome: "approved" },
    { id: "o4", type: "end", label: "Sent back", x: 280, y: 300, outcome: "rejected" },
  ],
  edges: [{ id: "oe1", from: "o1", to: "o2", branch: "default" }, { id: "oe2", from: "o2", to: "o3", branch: "approve" }, { id: "oe3", from: "o2", to: "o4", branch: "reject" }],
};
const def: WorkflowDef = { id: "d1", name: "New-Hire Conversion", triggerType: "onboarding", active: true, version: 2, createdBy: "Sabi starter", createdAt: "2026-10-20T08:00:00.000Z", updatedAt: "2026-10-20T08:00:00.000Z", ...graph };
const instance = {
  id: "i1", defId: "d1", defName: "New-Hire Conversion", triggerType: "onboarding", subject: "Convert Ada Obi to employee", reference: "op1", context: {}, isTest: false,
  initiatedBy: "e2", status: "Running", version: 1, graph, createdAt: "2026-10-20T09:00:00.000Z",
  active: [{ nodeId: "o2", approverId: "e1", approverIds: ["e1"], approverLabel: "HR Administrator", enteredAt: "2026-10-20T09:00:00.000Z" }],
  history: [{ id: "h1", nodeId: "o1", nodeLabel: "Submitted for review", action: "started", actorId: "e2", at: "2026-10-20T09:00:00.000Z" }],
};
const workflows = { selfEmployeeId: "e1", canManage: true, connectedTriggers: [], defs: [def], instances: [instance], inbox: [{ instanceId: "i1", nodeId: "o2" }] };

beforeEach(() => {
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/workflows" ? { data: workflows } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "HR Officer", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["workforce.self", "workflow.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live approval workflows", () => {
  it("connects the Approvals inbox for every staff role and the Builder for designers", () => {
    expect(liveRouteState("/workflows/inbox", ["workforce.self"])).toBe("connected");
    expect(liveRouteState("/settings/workflows", ["workforce.self"])).toBe("no-permission");
    expect(liveRouteState("/settings/workflows", ["workflow.manage"])).toBe("connected");
  });

  it("shows the steps the server says are yours, and sends your decision", async () => {
    render(<LiveWorkforceSync />);
    render(<MemoryRouter><WorkflowInbox /></MemoryRouter>);
    expect(await screen.findByText("Convert Ada Obi to employee")).toBeInTheDocument();
    useWorkflow.getState().decide("i1", "o2", "approve", { comment: "Checklist complete" });
    await waitFor(() => expect(api.workforceRequest).toHaveBeenCalledWith("/workflows/instances/i1/decide", expect.objectContaining({ method: "POST", body: { nodeId: "o2", decision: "approve", comment: "Checklist complete" } })));
  });

  it("starts approval only for connected documents; Builder test runs carry their context", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveWorkflowMeta.getState().loaded).toBe(true));
    const refused = useWorkflow.getState().start({ triggerType: "expense", subject: "Taxi", reference: "exp-1", context: {} });
    expect(refused).toEqual({ ok: false, error: expect.stringMatching(/not connected/) });
    const run = useWorkflow.getState().start({ triggerType: "onboarding", subject: "Test run", reference: "test-abc", context: { initiatorId: "e2" }, defId: "d1" });
    expect(run.ok).toBe(true);
    await waitFor(() => expect(api.workforceRequest).toHaveBeenCalledWith("/workflows/instances", expect.objectContaining({ body: { id: run.instanceId, triggerType: "onboarding", defId: "d1", subject: "Test run", context: { initiatorId: "e2" } } })));
  });

  it("saves Builder edits with the definition's version and opens before the records arrive", async () => {
    useWorkflow.setState({ defs: [], instances: [] });
    render(<MemoryRouter><WorkflowBuilder /></MemoryRouter>);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useWorkflow.getState().defs).toHaveLength(1));
    useWorkflow.getState().saveDef({ ...def, name: "Conversion review" });
    await waitFor(() => expect(api.workforceRequest).toHaveBeenCalledWith("/workflows/defs/d1", expect.objectContaining({ method: "PUT", version: 2 })));
  });
});
