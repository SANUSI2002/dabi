import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getLive, writeLive } from "./liveApi";
import { deliveryButton, deliveryInput } from './deliveryUi';

export type Handover = {
  fulfilmentId: string;
  pharmacyName: string;
  fulfilmentStatus: string;
  assignment: {
    id: string;
    status: string;
    courierName: string;
    pickedUpAt: string | null;
    deliveredAt: string | null;
  } | null;
  code: string | null;
  expired?: boolean;
  expiresAt?: string;
  lockedUntil?: string | null;
};

export default function DeliveryHandover({
  fulfilmentId,
  status,
}: {
  fulfilmentId: string;
  status: string;
}) {
  const pendingAction = useRef(false);
  const [data, setData] = useState<Handover | null>(null),
    [partners, setPartners] = useState<{ id: string; displayName: string }[]>(
      [],
    );
  const [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const result = await getLive<Handover>(
      `/api/v1/delivery/fulfilments/${fulfilmentId}/pickup-code`,
    );
    setData(result);
    if (!result.assignment && result.fulfilmentStatus === "READY_FOR_PICKUP")
      setPartners(await getLive("/api/v1/delivery/partners"));
  }, [fulfilmentId]);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (active)
        refresh().catch((e) => {
          if (active) setError(e.message);
        });
    };
    load();
    return () => {
      active = false;
    };
  }, [refresh, status]);
  async function run(work: () => Promise<unknown>, confirmation: string) {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await refresh();
      setMessage(confirmation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update delivery.");
    } finally {
      pendingAction.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="mt-4 w-full rounded-xl border border-[#dbe9e2] bg-[#f5f8f4] p-4"
      aria-label="Courier handover"
    >
      <h3 className="font-bold">Courier handover</h3>
      <button
        className="min-h-11 rounded-xl border px-3 text-sm"
        disabled={busy}
        onClick={() => run(refresh, "Delivery information refreshed.")}
      >
        Refresh delivery
      </button>
      {error && (
        <p role="alert" className="my-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="my-2 text-sm text-[#174a3a]">
          {message}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="mt-2">
          Loading delivery…
        </p>
      )}
      {data &&
        !data.assignment &&
        data.fulfilmentStatus === "READY_FOR_PICKUP" && (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  writeLive(
                    `/api/v1/delivery/fulfilments/${fulfilmentId}/assignment`,
                    { partnerId: selected },
                  ),
                "Courier assigned. Waiting for acceptance.",
              );
            }}
          >
            <label className="block">
              Delivery partner
              <select
                className={deliveryInput}
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy}
              >
                <option value="">Select a configured courier</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            {!partners.length && (
              <p className="text-sm">
                No active delivery partners are configured. Sabi operations must
                activate an existing courier account.
              </p>
            )}
            <button className={deliveryButton} disabled={busy || !selected}>
              {busy ? "Assigning…" : "Assign courier"}
            </button>
          </form>
        )}
      {data?.assignment && (
        <div className="mt-2 space-y-2">
          <p>
            {data.assignment.courierName} ·{" "}
            {data.assignment.status.replaceAll("_", " ")}
          </p>
          {data.assignment.status === "PENDING" && (
            <p className="text-sm">
              Waiting for the courier to accept this collection.
            </p>
          )}
          {data.code && (
            <>
              <p className="text-sm">Collection code</p>
              <p
                className="font-mono text-3xl font-bold tracking-[0.2em]"
                aria-label={`Collection code ${data.code.split("").join(" ")}`}
              >
                {data.code}
              </p>
              <p className="text-sm">
                Give this code to the assigned courier only when handing over
                the package. They must enter it to confirm collection.
              </p>
            </>
          )}
          {data.expired && (
            <p className="text-sm text-amber-800">
              Collection code expired. Generate a replacement before handover.
            </p>
          )}
          {data.lockedUntil && new Date(data.lockedUntil) > new Date() && (
            <p className="text-sm text-amber-800">
              Verification locked until{" "}
              {new Date(data.lockedUntil).toLocaleTimeString()}. A replacement
              does not remove the lock.
            </p>
          )}
          {data.assignment.status === "ACCEPTED" &&
            data.fulfilmentStatus === "READY_FOR_PICKUP" && (
              <button
                className="min-h-11 rounded-xl border border-[#cfe0d8] px-4 font-semibold"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Replace this collection code? The previous code will stop working.",
                    )
                  )
                    run(
                      () =>
                        writeLive(
                          `/api/v1/delivery/fulfilments/${fulfilmentId}/pickup-code`,
                          {},
                        ),
                      "New collection code generated. The previous code is invalid.",
                    );
                }}
              >
                Generate new code
              </button>
            )}
          {data.assignment.pickedUpAt && (
            <p className="text-sm">
              Collected: {new Date(data.assignment.pickedUpAt).toLocaleString()}
            </p>
          )}
          {data.assignment.deliveredAt && (
            <p className="text-sm">
              Delivered:{" "}
              {new Date(data.assignment.deliveredAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
      <Link
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline"
        to="/pharmacy/courier/login"
      >
        Delivery partner sign in
      </Link>
    </section>
  );
}
