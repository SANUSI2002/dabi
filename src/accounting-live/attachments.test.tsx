import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
import { Attachments } from "@/pages/accounting/_attachments";
import { useLiveEmr } from "@/emr-live/session";

const signIn = () => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view", "acct.post"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("accounting attachments", () => {
  it("say plainly that a live hospital's files are not stored yet, instead of keeping them in the browser", () => {
    signIn();
    render(<Attachments entityType="bill" entityId="b1" entityLabel="BILL-1" />);
    expect(screen.getByRole("button", { name: /Attach/ })).toBeDisabled();
    expect(screen.getByText(/aren't stored for live hospitals yet/)).toBeInTheDocument();
  });

  it("keep working on the sample data", () => {
    render(<Attachments entityType="bill" entityId="b1" entityLabel="BILL-1" />);
    expect(screen.getByRole("button", { name: /Attach/ })).toBeEnabled();
  });
});
