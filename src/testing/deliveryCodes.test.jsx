import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DeliveryCodes from "../../apps/telemedicine/packages/patient-portal/src/pages/delivery-tracking/DeliveryCodes";
const mocks = vi.hoisted(() => ({ get: vi.fn(), renew: vi.fn() }));
vi.mock(
  "../../apps/telemedicine/packages/patient-portal/src/api/commerceApi",
  () => ({ getDeliveryCodes: mocks.get, renewDeliveryCode: mocks.renew }),
);
beforeEach(() => {
  vi.clearAllMocks();
});
it("shows separate delivery codes for separate pharmacies, never a pickup code", async () => {
  mocks.get.mockResolvedValue([
    {
      fulfilmentId: "f1",
      pharmacyName: "First Pharmacy",
      fulfilmentStatus: "OUT_FOR_DELIVERY",
      code: "012345",
      expiresAt: "2026-10-11T12:00:00Z",
    },
    {
      fulfilmentId: "f2",
      pharmacyName: "Second Pharmacy",
      fulfilmentStatus: "READY_FOR_PICKUP",
      code: null,
    },
  ]);
  render(<DeliveryCodes orderId="order" />);
  expect(
    await screen.findByLabelText("Delivery code 0 1 2 3 4 5"),
  ).toBeInTheDocument();
  expect(screen.getByText("Second Pharmacy")).toBeInTheDocument();
  expect(
    screen.getByText(/appears after the courier confirms collection/),
  ).toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledWith("order");
  expect(mocks.renew).not.toHaveBeenCalled();
});
it("renews only the selected package after confirmation and reloads server-owned codes", async () => {
  mocks.get.mockResolvedValue([
    {
      fulfilmentId: "f",
      pharmacyName: "Pharmacy",
      fulfilmentStatus: "OUT_FOR_DELIVERY",
      expired: true,
      code: null,
    },
  ]);
  mocks.renew.mockResolvedValue({});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DeliveryCodes orderId="order" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Generate new code" }),
  );
  await waitFor(() => expect(mocks.renew).toHaveBeenCalledWith("f"));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "New delivery code generated",
  );
});
it("does not fetch unpaid order codes and reports errors without fabricating delivery proof", async () => {
  const { rerender } = render(
    <DeliveryCodes orderId="unpaid" enabled={false} />,
  );
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.get.mockRejectedValue(new Error("Authentication required"));
  rerender(<DeliveryCodes orderId="paid" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Authentication required",
  );
});
