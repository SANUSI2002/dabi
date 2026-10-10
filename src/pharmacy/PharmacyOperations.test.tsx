import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PharmacyStockOperations, PharmacyReports } from "./PharmacyOperations";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  csv: vi.fn(),
}));
vi.mock("./liveApi", () => ({
  getLive: mocks.get,
  writeLive: mocks.write,
  money: (v: number) => `NGN ${v / 100}`,
}));
vi.mock("@/identity/liveIdentity", () => ({ liveApiCsvRequest: mocks.csv }));
const stock = {
  id: "stock-1",
  branchId: null,
  branchName: "Main",
  medicationName: "Synthetic device",
  batchNumber: "BATCH-1",
  expiryDate: "2027-01-01",
  availableQuantity: 2,
  reservedUnits: 3,
  orderAllocatedUnits: 1,
  unitPriceMinor: 10000,
  reorderPoint: 4,
  reorderTarget: 10,
  stockPolicyVersion: 2,
  isActive: true,
  suggestedReorderQuantity: 8,
  listingStatus: "PUBLISHED",
};
const stockReport = {
  items: [stock],
  summary: {
    batchCount: 1,
    availableUnits: 2,
    retailValueMinor: 20000,
    lowStockBatches: 1,
    expiredBatches: 0,
  },
  nextPage: null,
};
const sales = {
  summary: {
    paidFulfilments: 1,
    productSubtotalMinor: 20000,
    commissionMinor: 3000,
    deliveryFeesMinor: 1000,
    productNetBeforeRefundsMinor: 17000,
    refundReviewMinor: 500,
    legacyCommissionUnknown: 0,
  },
  daily: [],
  ordersByStatus: [],
  items: [],
  nextPage: null,
};
beforeEach(() => {
  mocks.get.mockReset();
  mocks.write.mockReset();
  mocks.csv.mockReset();
  mocks.write.mockResolvedValue({});
});
describe("pharmacy operations screens", () => {
  it("shows available, held and reorder figures and applies backend stock filters", async () => {
    mocks.get.mockResolvedValue(stockReport);
    render(<PharmacyStockOperations branches={[]} />);
    expect(await screen.findByText("Synthetic device")).toBeInTheDocument();
    expect(screen.getByText("3 / 1 units")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stock state"), {
      target: { value: "EXPIRING" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/api/v1/pharmacy-portal/stock?state=EXPIRING&expiryDays=90&page=1",
      ),
    );
  });
  it("saves reorder policy with the server version and required reason", async () => {
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("/adjustments")
          ? { items: [], nextPage: null }
          : stockReport,
      ),
    );
    render(<PharmacyStockOperations branches={[]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Stock actions & history" }),
    );
    const form = screen
      .getByRole("button", { name: "Save reorder policy" })
      .closest("form")!;
    fireEvent.change(within(form).getByLabelText("Reason"), {
      target: { value: "Replenish based on demand" },
    });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "/api/v1/pharmacy-portal/inventory/stock-1/reorder-policy",
        {
          reorderPoint: 4,
          reorderTarget: 10,
          version: 2,
          reason: "Replenish based on demand",
        },
        "PATCH",
      ),
    );
    expect(
      await screen.findByText("Stock change recorded successfully."),
    ).toBeInTheDocument();
  });
  it("keeps the same adjustment idempotency key when retrying an uncertain request", async () => {
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("/adjustments")
          ? { items: [], nextPage: null }
          : stockReport,
      ),
    );
    mocks.write
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({});
    render(<PharmacyStockOperations branches={[]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Stock actions & history" }),
    );
    const form = screen
      .getByRole("button", { name: "Record stock adjustment" })
      .closest("form")!;
    fireEvent.change(within(form).getByLabelText("Quantity change"), {
      target: { value: "5" },
    });
    fireEvent.change(within(form).getByLabelText("Reason"), {
      target: { value: "Synthetic stock delivery" },
    });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network timeout",
    );
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls[0][1]).toEqual(mocks.write.mock.calls[1][1]);
    expect(mocks.write.mock.calls[0][1]).toMatchObject({
      expectedQuantity: 2,
      quantityDelta: 5,
      idempotencyKey: expect.any(String),
    });
  });
  it("replaces failed history loading with an actionable retry", async () => {
    mocks.get.mockImplementation((path: string) =>
      path.includes("/adjustments")
        ? Promise.reject(new Error("History unavailable"))
        : Promise.resolve(stockReport),
    );
    render(<PharmacyStockOperations branches={[]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Stock actions & history" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History unavailable",
    );
    expect(
      screen.queryByText("Loading adjustment history…"),
    ).not.toBeInTheDocument();
    mocks.get.mockResolvedValue({ items: [], nextPage: null });
    fireEvent.click(
      screen.getByRole("button", { name: "Retry adjustment history" }),
    );
    expect(
      await screen.findByText("No manual adjustments recorded."),
    ).toBeInTheDocument();
  });
  it("never substitutes demo data for failed stock requests", async () => {
    mocks.get.mockRejectedValue(new Error("Access denied"));
    render(<PharmacyStockOperations branches={[]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Synthetic device")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export stock CSV" }),
    ).toBeDisabled();
  });
  it("reports confirmed paid totals separately from email delivery and passes date filters", async () => {
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("/communications")
          ? {
              items: [
                {
                  id: "email-1",
                  kind: "COMPLIANCE_DECISION",
                  status: "SENT",
                  attempts: 1,
                  createdAt: "2026-10-10",
                  lastErrorCode: null,
                },
              ],
              nextPage: null,
            }
          : sales,
      ),
    );
    render(<PharmacyReports branches={[]} />);
    expect(
      await screen.findByText("Product net before refunds"),
    ).toBeInTheDocument();
    expect(screen.getByText("NGN 170")).toBeInTheDocument();
    expect(
      await screen.findByText("COMPLIANCE DECISION · SENT"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not confirmed inbox delivery/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply date range" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/api/v1/pharmacy-portal/reports/sales?from=2026-10-01&to=2026-10-10&page=1",
      ),
    );
  });
  it("displays CSV authorization errors without pretending the export succeeded", async () => {
    mocks.get.mockResolvedValue(stockReport);
    mocks.csv.mockRejectedValue(new Error("Session expired"));
    render(<PharmacyStockOperations branches={[]} />);
    await screen.findByText("Synthetic device");
    fireEvent.click(screen.getByRole("button", { name: "Export stock CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session expired",
    );
    expect(
      screen.queryByText("Stock CSV downloaded. Store it securely."),
    ).not.toBeInTheDocument();
  });
});
