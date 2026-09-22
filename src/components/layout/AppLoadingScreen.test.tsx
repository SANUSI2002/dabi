import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLoadingScreen, EmrRouteLoadingScreen } from "./AppLoadingScreen";
import { routeLabel } from "./loadingRoutes";

describe("Sabi OS loading experience", () => {
  it.each([
    ["/workspace", "Workspace"],
    ["/billing/invoices/inv-1", "Billing"],
    ["/laboratory/test-settings", "Laboratory"],
    ["/accounting/general-ledger", "Accounting"],
    ["/unknown", "Sabi OS"],
  ])("maps %s to %s", (path, label) => {
    expect(routeLabel(path)).toBe(label);
  });

  it("renders a contextual full-page loader", () => {
    render(<AppLoadingScreen pathname="/billing" />);
    expect(screen.getByRole("status", { name: "Loading Sabi OS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loading Billing" })).toBeInTheDocument();
  });

  it("announces the tenant route being opened", () => {
    render(<EmrRouteLoadingScreen pathname="/laboratory" tenantName="Sabi Health Post" />);
    expect(screen.getByRole("status", { name: "Loading Laboratory" })).toBeInTheDocument();
    expect(screen.getByText("Sabi Health Post")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opening Laboratory" })).toBeInTheDocument();
  });
});
