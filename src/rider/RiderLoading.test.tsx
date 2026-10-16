import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLoadingScreen } from "@/components/layout/AppLoadingScreen";
import { riderSkeletonPage } from "./RiderLoading";

describe("rider loading", () => {
  it("uses the rider portal outline instead of the clinical Sabi OS loader", () => {
    render(<AppLoadingScreen pathname="/rider/dashboard" />);
    expect(screen.getByRole("status", { name: "Opening your rider portal" })).toBeInTheDocument();
    expect(screen.queryByText(/Secure clinical workspace|Sabi OS/)).not.toBeInTheDocument();
  });

  it("shows the sign-in outline on rider sign-in and sign-up", () => {
    render(<AppLoadingScreen pathname="/rider/register" />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it.each([
    ["/rider/dashboard", "dashboard"],
    ["/rider/offers", "list"],
    ["/rider/history", "list"],
    ["/rider/history/abc", "delivery"],
    ["/rider/delivery/abc", "delivery"],
    ["/rider/earnings", "earnings"],
    ["/rider/support", "account"],
  ])("matches %s to the %s outline", (path, page) => {
    expect(riderSkeletonPage(path)).toBe(page);
  });
});
