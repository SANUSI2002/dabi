import { useEffect, useState } from "react";
import { getLive, money } from "./liveApi";
type Stock = {
  id: string;
  medicationName: string;
  batchNumber: string | null;
  expiryDate: string | null;
  availableQuantity: number;
  unitPriceMinor: number;
  isActive: boolean;
  branch: { name: string } | null;
};
export default function PharmacyStaffWorkspace({
  pharmacy,
}: {
  pharmacy: { id: string; name: string };
}) {
  const [items, setItems] = useState<Stock[]>([]),
    [page, setPage] = useState(1),
    [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    getLive<{ items: Stock[]; nextPage: number | null }>(
      `/api/v1/pharmacy-portal/staff/inventory?pharmacyId=${pharmacy.id}&page=${page}`,
    )
      .then((result) => {
        if (current) {
          setItems(result.items);
          setNextPage(result.nextPage);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [pharmacy.id, page, retry]);
  return (
    <main className="min-h-screen bg-[#f5f8f4] p-5 text-[#17342a] sm:p-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <p className="text-sm font-semibold">
            Sabi Pharmacy · Inventory access
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            {pharmacy.name}
          </h1>
        </header>
        <p className="text-sm text-[#5b766a]">
          Your staff role has read-only inventory access. Product changes belong
          to pharmacy administrators; prescription review and dispensing require
          verified pharmacists.
        </p>
        {error ? (
          <div role="alert" className="rounded-xl bg-red-50 p-4">
            <p>{error}</p>
            <button
              className="mt-3 min-h-11 rounded-xl border px-4"
              onClick={() => setRetry((v) => v + 1)}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <p role="status">Loading branch inventory…</p>
        ) : (
          <>
            {!items.length && <p>No inventory items in this pharmacy yet.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border bg-white p-5"
                >
                  <h2 className="font-semibold">{item.medicationName}</h2>
                  <p className="mt-2 text-sm">
                    {item.branch?.name || "Legacy stock"} ·{" "}
                    {item.availableQuantity} available ·{" "}
                    {money(item.unitPriceMinor)}
                  </p>
                  <p className="mt-2 text-sm text-[#5b766a]">
                    {item.isActive ? "Active stock" : "Inactive stock"}
                    {item.batchNumber && ` · Batch ${item.batchNumber}`}
                    {item.expiryDate &&
                      ` · Expiry ${new Date(item.expiryDate).toLocaleDateString()}`}
                  </p>
                </article>
              ))}
            </div>
            <div className="flex justify-between">
              <button
                className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
                disabled={!nextPage}
                onClick={() => nextPage && setPage(nextPage)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
