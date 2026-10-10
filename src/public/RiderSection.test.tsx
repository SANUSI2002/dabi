import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RiderSection from "./RiderSection";
import { RIDER_JOIN_URL, RIDER_SIGN_IN_URL } from "./ecosystemLinks";
beforeEach(() => vi.stubGlobal("IntersectionObserver", class {
  observe() {} unobserve() {} disconnect() {}
}));
describe("landing page rider entry", () => {
  it("links to the connected portal and explains the two handovers without invented stats", () => {
    render(
      <MemoryRouter>
        <RiderSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Rider sign in" })).toHaveAttribute(
      "href",
      RIDER_SIGN_IN_URL,
    );
    expect(
      screen.getByRole("link", { name: "Join the rider network" }),
    ).toHaveAttribute("href", RIDER_JOIN_URL);
    expect(
      screen.getByText("Pharmacy's code verifies pickup"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Patient's code verifies handover"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/4\.8|120k|2,400/)).not.toBeInTheDocument();
  });
});
