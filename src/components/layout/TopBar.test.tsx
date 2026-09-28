import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("EMR top bar", () => {
  it("opens a matching patient from the search field", () => {
    render(<MemoryRouter initialEntries={["/workspace"]}>
      <TopBar />
      <Routes><Route path="/patients/:id" element={<div>Patient chart opened</div>} /></Routes>
    </MemoryRouter>);

    fireEvent.change(screen.getByRole("textbox", { name: "Search patients and modules" }), { target: { value: "Chizaram" } });
    fireEvent.click(screen.getByRole("button", { name: /Chizaram Ajakarom/ }));
    expect(screen.getByText("Patient chart opened")).toBeInTheDocument();
  });

  it("shows an in-app notification panel without a fake browser alert", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("In-app alerts")).toBeInTheDocument();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });
});
