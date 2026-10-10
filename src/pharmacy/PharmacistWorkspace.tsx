import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { liveSignOut } from "@/identity/liveIdentity";
import { getLive, writeLive, money } from "./liveApi";
type Stock = {
  id: string;
  branchId: string;
  branch: { name: string };
  expiryDate: string | null;
  medicationName: string;
  genericName: string | null;
  availableQuantity: number;
  unitPriceMinor: number;
};
type RxItem = {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
};
type Rx = {
  id: string;
  status: string;
  prescription: {
    reference: string;
    instructions: string | null;
    items: RxItem[];
  };
};
type Order = {
  id: string;
  status: string;
  fulfilmentMethod: string;
  totalMinor: number;
  order: { reference: string; status: string };
  allocations: {
    id: string;
    medicationName: string;
    selectedQuantity: number;
  }[];
};
const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cfe0d8] bg-white px-3 py-2";
const button =
  "min-h-11 rounded-xl bg-[#0d2c22] px-5 py-2 font-bold text-white disabled:opacity-50";
const matches = (item: RxItem, stock: Stock) =>
  stock.medicationName.toLowerCase() === item.medicationName.toLowerCase() ||
  stock.genericName?.toLowerCase() === item.medicationName.toLowerCase();
export default function PharmacistWorkspace({
  pharmacy,
}: {
  pharmacy: { id: string; name: string };
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"requests" | "orders">("requests"),
    [requests, setRequests] = useState<Rx[]>([]),
    [inventory, setInventory] = useState<Stock[]>([]),
    [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [branch, setBranch] = useState("");
  const query = `?pharmacyId=${encodeURIComponent(pharmacy.id)}`;
  async function refresh() {
    if (tab === "requests") {
      const result = await getLive<{ items: Rx[]; inventory: Stock[] }>(
        `/api/v1/pharmacy-portal/clinical/requests${query}`,
      );
      setRequests(result.items);
      setInventory(result.inventory);
    } else {
      const result = await getLive<{ items: Order[] }>(
        `/api/v1/pharmacy-portal/clinical/orders${query}`,
      );
      setOrders(result.items);
    }
  }
  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, pharmacy.id]);
  async function action(call: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await call();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The operation could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function quote(event: FormEvent<HTMLFormElement>, request: Rx) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const items = request.prescription.items.map((item) => {
      const stock = inventory.find(
        (s) => s.id === values.get(`stock:${item.id}`),
      );
      const quantity = Number(values.get(`quantity:${item.id}`));
      return {
        prescriptionItemId: item.id,
        inventoryItemId: stock?.id,
        requiredQuantity: item.quantity,
        availableQuantity: quantity,
        unitPriceMinor: stock?.unitPriceMinor || 0,
        availabilityStatus:
          quantity === 0
            ? "UNAVAILABLE"
            : quantity < item.quantity
              ? "PARTIAL"
              : "AVAILABLE",
        estimatedFulfilment: String(values.get("estimated")),
        pickupAvailable: values.get("pickup") === "on",
        deliveryAvailable: values.get("delivery") === "on",
      };
    });
    void action(
      () =>
        writeLive(
          `/api/v1/pharmacy-portal/clinical/requests/${request.id}/quotes${query}`,
          { items },
        ),
      "Quote issued. The patient can now review and reserve these items.",
    );
  }
  function decision(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void action(
      () =>
        writeLive(`/api/v1/fulfilments/${order.id}/decision`, {
          decision: values.get("decision"),
          note: values.get("note"),
          ...(values.get("patientMessage")
            ? { patientMessage: values.get("patientMessage") }
            : {}),
        }),
      "Pharmacist decision recorded.",
    );
  }
  return (
    <div className="min-h-screen bg-[#f5f8f4] text-[#17342a] lg:flex">
      <aside className="bg-[#071d16] p-5 text-white lg:min-h-screen lg:w-64">
        <h1 className="font-display text-xl font-bold">Sabi Pharmacy</h1>
        <p className="mt-3 text-sm text-white/70">{pharmacy.name}</p>
        <nav
          className="mt-6 flex gap-3 lg:flex-col"
          aria-label="Pharmacist workspace"
        >
          {(["requests", "orders"] as const).map((value) => (
            <button
              key={value}
              className={`min-h-11 rounded-xl px-4 text-left ${tab === value ? "bg-[#f5a524] text-[#13231e]" : ""}`}
              onClick={() => setTab(value)}
            >
              {value === "requests"
                ? "Prescriptions & quotes"
                : "Dispensing & orders"}
            </button>
          ))}
        </nav>
        <button
          className="mt-8 min-h-11 px-4"
          onClick={async () => {
            await liveSignOut();
            navigate("/pharmacy/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="mx-auto w-full max-w-6xl space-y-5 p-5 sm:p-8">
        <h2 className="font-display text-3xl font-bold">
          {tab === "requests" ? "Prescription requests" : "Dispensing queue"}
        </h2>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-green-50 p-4">
            {notice}
          </p>
        )}
        {loading ? (
          <p role="status">Loading pharmacy work…</p>
        ) : tab === "requests" ? (
          <>
            <label className="block max-w-md">
              Quote from one branch
              <select
                className={input}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="">Choose a branch</option>
                {[...new Set(inventory.map((s) => s.branchId))].map((id) => (
                  <option key={id} value={id}>
                    {inventory.find((s) => s.branchId === id)?.branch?.name ||
                      `Branch ${id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>
            {!requests.length && (
              <p>No issued-prescription requests received yet.</p>
            )}
            {requests.map((request) => (
              <section
                key={request.id}
                className="rounded-2xl border border-[#dbe9e2] bg-white p-5"
              >
                <h3 className="font-bold">{request.prescription.reference}</h3>
                {request.prescription.instructions && (
                  <p className="mt-2">{request.prescription.instructions}</p>
                )}
                <form
                  onSubmit={(e) => quote(e, request)}
                  className="mt-4 space-y-4"
                >
                  {request.prescription.items.map((item) => (
                    <fieldset
                      key={item.id}
                      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
                    >
                      <legend className="px-2 font-semibold">
                        {item.medicationName} · {item.quantity} prescribed
                      </legend>
                      <p className="text-sm sm:col-span-2">
                        {item.dosage} · {item.frequency} · {item.route} ·{" "}
                        {item.duration}
                      </p>
                      <label>
                        Matching inventory
                        <select
                          required
                          name={`stock:${item.id}`}
                          className={input}
                        >
                          <option value="">Choose inventory</option>
                          {inventory
                            .filter(
                              (s) => s.branchId === branch && matches(item, s),
                            )
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.medicationName} · {s.availableQuantity} units
                                · {money(s.unitPriceMinor)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Quantity offered
                        <input
                          required
                          name={`quantity:${item.id}`}
                          type="number"
                          min="0"
                          max={item.quantity}
                          defaultValue={item.quantity}
                          className={input}
                        />
                      </label>
                    </fieldset>
                  ))}
                  <label className="block">
                    Estimated fulfilment
                    <input
                      required
                      name="estimated"
                      minLength={2}
                      maxLength={120}
                      className={input}
                      placeholder="For example, ready within 2 hours"
                    />
                  </label>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex min-h-11 items-center gap-2">
                      <input name="pickup" type="checkbox" defaultChecked />{" "}
                      Pickup available
                    </label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input name="delivery" type="checkbox" /> Delivery
                      available
                    </label>
                  </div>
                  <button disabled={busy || !branch} className={button}>
                    Issue pharmacy quote
                  </button>
                </form>
              </section>
            ))}
          </>
        ) : (
          <>
            {!orders.length && <p>No fulfilments yet.</p>}
            {orders.map((order) => (
              <section
                key={order.id}
                className="rounded-2xl border border-[#dbe9e2] bg-white p-5"
              >
                <h3 className="font-bold">{order.order.reference}</h3>
                <p className="mt-2">
                  {order.status.replaceAll("_", " ")} ·{" "}
                  {money(order.totalMinor)} · {order.fulfilmentMethod}
                </p>
                <ul className="mt-3 list-disc pl-5">
                  {order.allocations.map((line) => (
                    <li key={line.id}>
                      {line.medicationName} · {line.selectedQuantity} units
                    </li>
                  ))}
                </ul>
                {order.status === "AWAITING_PHARMACIST_REVIEW" && (
                  <form
                    onSubmit={(e) => decision(e, order)}
                    className="mt-4 space-y-3"
                  >
                    <label className="block">
                      Decision
                      <select name="decision" className={input}>
                        <option value="APPROVED_FOR_DISPENSING">
                          Approve for dispensing
                        </option>
                        <option value="CLARIFICATION_REQUIRED">
                          Request clarification
                        </option>
                        <option value="REJECTED">Reject</option>
                        <option value="UNABLE_TO_FULFILL">
                          Unable to fulfil
                        </option>
                      </select>
                    </label>
                    <label className="block">
                      Review notes
                      <textarea
                        required
                        name="note"
                        minLength={3}
                        maxLength={1000}
                        className={input}
                      />
                    </label>
                    <label className="block">
                      Message to patient
                      <input
                        name="patientMessage"
                        maxLength={1000}
                        className={input}
                      />
                    </label>
                    <button disabled={busy} className={button}>
                      Confirm pharmacist decision
                    </button>
                  </form>
                )}
                {["APPROVED_FOR_DISPENSING", "PREPARING"].includes(
                  order.status,
                ) && (
                  <button
                    disabled={busy}
                    className={`${button} mt-4`}
                    onClick={() =>
                      action(
                        () =>
                          writeLive(
                            `/api/v1/fulfilments/${order.id}/preparation`,
                            {
                              transition:
                                order.status === "APPROVED_FOR_DISPENSING"
                                  ? "PREPARING"
                                  : "READY_FOR_PICKUP",
                            },
                          ),
                        "Preparation status updated.",
                      )
                    }
                  >
                    {order.status === "APPROVED_FOR_DISPENSING"
                      ? "Start preparing"
                      : "Mark ready for pickup"}
                  </button>
                )}
              </section>
            ))}
          </>
        )}
        <button
          disabled={busy || loading}
          className="min-h-11 rounded-xl border px-5"
          onClick={() => action(refresh, "Queue refreshed.")}
        >
          Refresh
        </button>
      </main>
    </div>
  );
}
