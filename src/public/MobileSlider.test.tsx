import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileSlider } from "./MobileSlider";

describe("mobile landing slider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("moves between cards with accessible controls", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    render(<MobileSlider label="Sabi experiences" desktopColumns="lg:grid-cols-3"><article>Patients</article><article>Hospitals</article><article>Pharmacies</article></MobileSlider>);

    expect(screen.getByRole("region", { name: "Sabi experiences" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous Sabi experiences" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next Sabi experiences" }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Next Sabi experiences" }));
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next Sabi experiences" })).toBeDisabled();
  });
});
