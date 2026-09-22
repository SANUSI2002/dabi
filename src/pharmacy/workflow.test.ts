import { afterEach, describe, expect, it } from "vitest";
import { usePharmacyWorkflow, workflowForOrganization, type PharmacyRequest } from "./workflow";

const request: PharmacyRequest = {
  id: "request-a",
  organizationId: "org-alpha",
  branchId: "branch-alpha-1",
  patientId: "patient-a",
  patientName: "Patient Alpha",
  prescriptionNumber: "RX-A",
  prescriberName: "Dr Test",
  receivedAt: new Date().toISOString(),
  deliveryPreference: "PICKUP",
  status: "NEW",
  items: [{ id: "line-a", masterDrugId: "d2", name: "Paracetamol 500mg", directions: "One daily", quantity: 2 }],
};

describe("pharmacy fulfilment workflow", () => {
  afterEach(() => usePharmacyWorkflow.setState({ requests: [], quotes: [], orders: [], events: [] }));

  it("moves a tenant-scoped request through quote acceptance into an unpaid order", () => {
    usePharmacyWorkflow.setState({ requests: [request], quotes: [], orders: [], events: [] });
    usePharmacyWorkflow.getState().startReview(request.id, request.organizationId);

    const saved = usePharmacyWorkflow.getState().saveQuote(request.organizationId, {
      requestId: request.id,
      items: [{ ...request.items[0], available: true, unitPriceMinor: 1200 }],
      deliveryFeeMinor: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(saved.error).toBeUndefined();
    expect(saved.quote?.status).toBe("DRAFT");

    expect(usePharmacyWorkflow.getState().sendQuote(saved.quote!.id, request.organizationId).error).toBeUndefined();
    const accepted = usePharmacyWorkflow.getState().acceptQuote(saved.quote!.id, request.organizationId);

    expect(accepted.order?.paymentStatus).toBe("PENDING");
    expect(accepted.order?.totalMinor).toBe(2400);
    expect(workflowForOrganization("org-alpha").orders).toHaveLength(1);
    expect(workflowForOrganization("org-beta").orders).toHaveLength(0);
  });

  it("rejects cross-tenant workflow mutations", () => {
    usePharmacyWorkflow.setState({ requests: [request], quotes: [], orders: [], events: [] });
    const result = usePharmacyWorkflow.getState().saveQuote("org-beta", {
      requestId: request.id,
      items: [{ ...request.items[0], available: true, unitPriceMinor: 1200 }],
      deliveryFeeMinor: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(result.error).toContain("not found");
    expect(usePharmacyWorkflow.getState().quotes).toHaveLength(0);
  });
});
