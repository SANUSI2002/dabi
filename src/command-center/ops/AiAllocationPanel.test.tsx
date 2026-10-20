import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import AiAllocationPanel from "./AiAllocationPanel";
import { CcProvider } from "./kit";
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./api", async (original) => ({
  ...(await original()),
  ccGet: get,
  ccPost: post,
}));
const settings = {
  personalDailyRequests: 10,
  professionalDailyRequests: 20,
  personalTokenAllowance: 100000,
  professionalTokenAllowance: 200000,
  tokenResetCadence: "DAILY",
  resetTime: "00:00",
  timeZone: "UTC",
  monthlyResetDay: 1,
  maxTokensPerRequest: 12000,
  maxOutputTokens: 2048,
  globalDailyRequests: 30,
  globalTotalRequests: 1000,
  warningPercent: 80,
};
const policy = { version: 3, settings };
const balance = {
  userId: "synthetic-user",
  accountVersion: 2,
  plan: "PERSONAL",
  overrides: { dailyRequests: null, tokenAllowance: null },
  requests: {
    limit: 10,
    used: 2,
    remaining: 8,
    resetsAt: "2026-10-21T00:00:00Z",
  },
  tokens: {
    allocated: 100000,
    used: 1000,
    reserved: 12000,
    remaining: 87000,
    resetsAt: "2026-10-21T00:00:00Z",
    status: "AVAILABLE",
  },
  ledger: [],
  uncertainReservations: [],
};
const me = {
  id: "admin",
  name: "Synthetic operator",
  email: "operator@example.test",
  roles: ["SABI_PLATFORM_ADMIN"],
  permissions: ["platform.ops.read", "platform.settings.manage"],
  twoStepVerification: true,
};
function open(permissions = me.permissions) {
  get.mockImplementation(async (path: string) =>
    path === "/ai/allowances"
      ? policy
      : path.startsWith("/ai/allowances/users?")
        ? {
            items: [
              {
                id: balance.userId,
                email: "synthetic@example.test",
                full_name: "Synthetic Patient",
                accountStatus: "ACTIVE",
                allowance: balance,
              },
            ],
            total: 1,
          }
        : balance,
  );
  return render(
    <CcProvider me={{ ...me, permissions }}>
      <AiAllocationPanel />
    </CcProvider>,
  );
}
afterEach(() => {
  cleanup();
  get.mockReset();
  post.mockReset();
});
describe("AI token allocation controls", () => {
  it("publishes versioned token, request and reset settings only after a reasoned confirmation", async () => {
    open();
    await screen.findByLabelText("Personal requests per day");
    fireEvent.change(screen.getByLabelText("Personal requests per day"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Token reset frequency"), {
      target: { value: "MONTHLY" },
    });
    fireEvent.change(screen.getByLabelText("Reset timezone"), {
      target: { value: "Africa/Lagos" },
    });
    fireEvent.change(screen.getByLabelText("Reset time"), {
      target: { value: "06:30" },
    });
    fireEvent.change(screen.getByLabelText("Monthly reset day"), {
      target: { value: "15" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review & publish allocations" }),
    );
    const modal = screen.getByRole("dialog");
    expect(
      within(modal).getByText(
        /Existing usage and open reset boundaries are preserved/,
      ),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(within(modal).getByRole("textbox"), {
      target: { value: "Publish the approved allocation schedule" },
    });
    post.mockResolvedValue({ version: 4 });
    fireEvent.click(
      within(modal).getByRole("button", { name: "Publish allocation policy" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/ai/allowances/policy", {
        expectedVersion: 3,
        settings: {
          ...settings,
          personalDailyRequests: 25,
          tokenResetCadence: "MONTHLY",
          timeZone: "Africa/Lagos",
          resetTime: "06:30",
          monthlyResetDay: 15,
        },
        reason: "Publish the approved allocation schedule",
      }),
    );
  });
  it("marks invalid bounds and prevents publishing an output limit above its request limit", async () => {
    open();
    await screen.findByLabelText("Maximum total tokens per request");
    fireEvent.change(
      screen.getByLabelText("Maximum total tokens per request"),
      { target: { value: "1000" } },
    );
    fireEvent.blur(screen.getByLabelText("Maximum total tokens per request"));
    expect(
      screen.getByText(
        "Output limit cannot exceed the total per-request limit.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Review & publish allocations" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it("does not expose account balances or mutation controls to a read-only operator", async () => {
    open(["platform.ops.read"]);
    await screen.findByLabelText("Personal requests per day");
    expect(screen.getByLabelText("Personal requests per day")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Review & publish allocations" }),
    ).not.toBeInTheDocument();
    expect(
      get.mock.calls.some(([path]) => String(path).includes("/users")),
    ).toBe(false);
  });
  it("shows real per-user remaining balances and sends a retry-safe current-period adjustment", async () => {
    open();
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Manage allocation" }));
    await screen.findByText("87,000");
    fireEvent.click(
      screen.getByRole("button", { name: "Adjust current tokens" }),
    );
    const modal = screen.getByRole("dialog");
    fireEvent.change(within(modal).getByRole("spinbutton"), {
      target: { value: "5000" },
    });
    fireEvent.change(within(modal).getByRole("textbox"), {
      target: { value: "Approved current-period token grant" },
    });
    post.mockResolvedValue(balance);
    fireEvent.click(
      within(modal).getByRole("button", { name: "Apply token adjustment" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/ai/allowances/users/synthetic-user/adjust",
        {
          expectedVersion: 2,
          clientRequestId: expect.stringMatching(/^[\da-f-]{36}$/),
          deltaTokens: 5000,
          reason: "Approved current-period token grant",
        },
      ),
    );
  });
  it("keeps the policy form and error visible when publishing fails", async () => {
    open();
    await screen.findByLabelText("Personal requests per day");
    fireEvent.click(
      screen.getByRole("button", { name: "Review & publish allocations" }),
    );
    const modal = screen.getByRole("dialog");
    fireEvent.change(within(modal).getByRole("textbox"), {
      target: { value: "Approved policy change attempt" },
    });
    post.mockRejectedValue(new Error("Policy version changed. Refresh."));
    fireEvent.click(
      within(modal).getByRole("button", { name: "Publish allocation policy" }),
    );
    expect(
      await screen.findByText("Policy version changed. Refresh."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
