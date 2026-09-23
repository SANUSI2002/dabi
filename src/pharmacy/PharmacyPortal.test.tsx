import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PharmacyPortal from "./PharmacyPortal";

describe("pharmacy portal navigation", () => {
  afterEach(cleanup);

  it("renders the dashboard and operational pharmacy sections without a render loop", () => {
    render(<MemoryRouter><PharmacyPortal /></MemoryRouter>);

    expect(screen.getByText("Prescription to handover")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Prescription requests/i }));
    expect(screen.getByText("Prescription inbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    expect(screen.getByText("No orders yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Inventory" }));
    expect(screen.getByRole("button", { name: /Add inventory item/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marketplace" }));
    expect(screen.getByText("What patients can see")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Pharmacy identity and contact")).toBeInTheDocument();
  }, 15_000);
});
