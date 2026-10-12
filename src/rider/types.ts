export type RiderAssignment = {
  id: string;
  reference: string;
  assignmentStatus: string;
  fulfilmentStatus: string;
  pickup: { name: string; address: string; contactPhone: string };
  recipient?: {
    recipientName: string;
    recipientPhone: string;
    address: string;
  };
  assignedAt?: string | null;
  respondedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  earningOfferMinor?: number | null;
};
export type RiderOverview = {
  profile: {
    id: string;
    userId: string;
    displayName: string;
    isActive: boolean;
  };
  stats: { pending: number; active: number; completed: number };
};
export type RiderHistory = {
  items: RiderAssignment[];
  nextOffset: number | null;
};
export const riderStatus = (item: RiderAssignment) =>
  item.assignmentStatus === "PENDING"
    ? "New offer"
    : item.assignmentStatus === "REJECTED"
      ? "Declined"
      : item.assignmentStatus === "COMPLETED"
        ? "Delivered"
        : item.fulfilmentStatus === "READY_FOR_PICKUP"
          ? "Ready to collect"
          : item.fulfilmentStatus === "PICKED_UP"
            ? "Collected"
            : "Out for delivery";
export const riderDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
