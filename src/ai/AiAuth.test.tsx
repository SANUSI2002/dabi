import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { AiLogin, AiSignup } from "./AiAuth";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  signIn: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("./api", () => ({
  aiAccountGet: mocks.get,
  aiAccountPost: mocks.post,
}));
vi.mock("@/identity/liveIdentity", () => ({
  liveSignIn: mocks.signIn,
  liveVerifyMfa: mocks.verify,
  restoreLiveIdentity: vi.fn(),
  liveApiRequest: vi.fn(),
}));
const show = (component: React.ReactNode) =>
  render(<MemoryRouter>{component}</MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({
    professions: [{ id: "DOCTOR", label: "Medical doctor", authority: "MDCN" }],
  });
});
describe("standalone Sabi AI signup and login", () => {
  it("offers personal, professional and hospital accounts without a knowledge catalogue", async () => {
    show(<AiSignup />);
    expect(screen.getByRole("button", { name: "For myself" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Professional" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Hospital / business" }),
    ).toBeVisible();
    expect(screen.queryByText("AI Knowledge Base")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/catalogue"));
  });
  it("asks professionals for licence number, authority and expiry rather than granting a role", async () => {
    show(<AiSignup />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Professional" }));
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Medical doctor" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Professional discipline"), {
      target: { value: "DOCTOR" },
    });
    expect(screen.getByLabelText("Issuing professional body")).toHaveValue(
      "MDCN",
    );
    expect(
      screen.getByLabelText("Registration / licence number"),
    ).toBeRequired();
    expect(screen.getByLabelText("Licence expiry date")).toBeRequired();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("asks a hospital for its own facility registration details", async () => {
    show(<AiSignup />);
    fireEvent.click(
      screen.getByRole("button", { name: "Hospital / business" }),
    );
    expect(
      screen.getByLabelText("Hospital / organisation name"),
    ).toBeRequired();
    expect(
      screen.getByLabelText("Facility / business registration number"),
    ).toBeRequired();
    expect(
      screen.queryByLabelText("Professional discipline"),
    ).not.toBeInTheDocument();
  });
  it("confirms account creation and provides verification resend without a fake session", async () => {
    mocks.post.mockResolvedValue({
      emailSent: true,
      message: "Account created. Check your email to verify it.",
    });
    show(<AiSignup />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Synthetic QA" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "qa@standalone.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "Synthetic-only-Password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Synthetic-only-Password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Check your inbox." }),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: "Resend verification email" }),
    ).toBeVisible();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("retains the signup form and shows a real API error", async () => {
    mocks.post.mockRejectedValue(new Error("An account already exists."));
    show(<AiSignup />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account already exists.",
      ),
    );
    expect(screen.getByLabelText("Email address")).toBeVisible();
  });
  it("preserves the real MFA sign-in flow", async () => {
    mocks.signIn.mockResolvedValue({ kind: "MFA" });
    show(<AiLogin />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "qa@standalone.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Synthetic-only-Password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Authenticator code")).toBeVisible(),
    );
    expect(mocks.signIn).toHaveBeenCalledWith(
      "qa@standalone.test",
      "Synthetic-only-Password",
    );
  });
});
