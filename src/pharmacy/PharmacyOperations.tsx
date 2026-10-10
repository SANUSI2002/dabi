import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, RefreshCw } from "lucide-react";
import { liveApiCsvRequest } from "@/identity/liveIdentity";
import { getLive, writeLive, money, type PharmacyBranch } from "./liveApi";

const input =
  "min-h-11 w-full rounded-xl border border-[#cfe0d8] bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#0b8a63]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe0d8] bg-white px-4 py-2 font-semibold hover:bg-[#edf6f0] disabled:opacity-50";
const card = "rounded-2xl border border-[#dbe9e2] bg-white p-5";
const dateText = (value: string | null) => value?.slice(0, 10) || "No expiry";
function downloadPharmacyCsv(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
      {message}
    </p>
  ) : null;
}
function Pagination({
  page,
  next,
  onChange,
}: {
  page: number;
  next: number | null;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className={button}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>Page {page}</span>
      <button
        className={button}
        disabled={next === null}
        onClick={() => onChange(next!)}
      >
        Next
      </button>
    </div>
  );
}
function BranchSelect({ branches }: { branches: PharmacyBranch[] }) {
  return (
    <label>
      Branch
      <select name="branchId" className={input}>
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
type StockRow = {
  id: string;
  branchId: string | null;
  branchName: string | null;
  medicationName: string;
  batchNumber: string | null;
  expiryDate: string | null;
  availableQuantity: number;
  reservedUnits: number;
  orderAllocatedUnits: number;
  unitPriceMinor: number;
  reorderPoint: number;
  reorderTarget: number | null;
  stockPolicyVersion: number;
  isActive: boolean;
  suggestedReorderQuantity: number | null;
  listingStatus: string | null;
};
type StockReport = {
  items: StockRow[];
  summary: {
    batchCount: number;
    availableUnits: number;
    retailValueMinor: number;
    lowStockBatches: number;
    expiredBatches: number;
  };
  nextPage: number | null;
};
type History = {
  items: {
    id: string;
    quantityDelta: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
    createdAt: string;
  }[];
  nextPage: number | null;
};
function StockActions({
  item,
  onSaved,
}: {
  item: StockRow;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [historyError, setHistoryError] = useState(""),
    [history, setHistory] = useState<History | null>(null),
    [page, setPage] = useState(1),
    [historyRevision, setHistoryRevision] = useState(0);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    let current = true;
    setHistory(null);
    setHistoryError("");
    getLive<History>(
      `/api/v1/pharmacy-portal/inventory/${item.id}/adjustments?page=${page}`,
    )
      .then((r) => {
        if (current) setHistory(r);
      })
      .catch((e) => {
        if (current) setHistoryError(e.message);
      });
    return () => {
      current = false;
    };
  }, [item.id, page, historyRevision]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "policy" | "adjust",
  ) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      if (kind === "policy")
        await writeLive(
          `/api/v1/pharmacy-portal/inventory/${item.id}/reorder-policy`,
          {
            reorderPoint: Number(values.get("point")),
            reorderTarget:
              values.get("target") === "" ? null : Number(values.get("target")),
            version: item.stockPolicyVersion,
            reason: values.get("reason"),
          },
          "PATCH",
        );
      else {
        const payload = {
          expectedQuantity: item.availableQuantity,
          quantityDelta: Number(values.get("delta")),
          reason: String(values.get("reason")),
        };
        const signature = JSON.stringify(payload);
        if (retry.current?.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        await writeLive(`/api/v1/pharmacy-portal/inventory/${item.id}/adjust`, {
          ...payload,
          idempotencyKey: retry.current!.key,
        });
        retry.current = null;
      }
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Refresh and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`${card} space-y-5`}
      aria-label={`Stock controls for ${item.medicationName}`}
    >
      <h2 className="text-xl font-bold">
        {item.medicationName} · {item.batchNumber || "No batch"}
      </h2>
      <ErrorNotice message={error} />
      <div className="grid gap-5 lg:grid-cols-2">
        <form className="grid gap-3" onSubmit={(e) => void submit(e, "policy")}>
          <h3 className="font-bold">Reorder policy</h3>
          <label>
            Low-stock threshold
            <input
              required
              name="point"
              type="number"
              min={0}
              max={1000000}
              step={1}
              defaultValue={item.reorderPoint}
              className={input}
            />
          </label>
          <label>
            Target available units (optional)
            <input
              name="target"
              type="number"
              min={0}
              max={1000000}
              step={1}
              defaultValue={item.reorderTarget ?? ""}
              className={input}
            />
          </label>
          <label>
            Reason
            <input
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              className={input}
            />
          </label>
          <p className="text-sm text-[#5b766a]">
            Recommendations use available units; this does not create or pay a
            purchase order.
          </p>
          <button className={button} disabled={busy}>
            {busy ? "Saving…" : "Save reorder policy"}
          </button>
        </form>
        <form className="grid gap-3" onSubmit={(e) => void submit(e, "adjust")}>
          <h3 className="font-bold">Receive / adjust stock</h3>
          <p>Available balance: {item.availableQuantity} units</p>
          <label>
            Quantity change
            <input
              name="delta"
              required
              type="number"
              min={-1000000}
              max={1000000}
              step={1}
              placeholder="20 received or -3 damaged"
              className={input}
            />
          </label>
          <label>
            Reason
            <input
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              className={input}
            />
          </label>
          <p className="text-sm text-[#5b766a]">
            Changes are recorded permanently. Reserved stock is not editable
            here. A different batch needs a new catalogue inventory entry.
          </p>
          <button className={button} disabled={busy}>
            {busy ? "Saving…" : "Record stock adjustment"}
          </button>
        </form>
      </div>
      <h3 className="font-bold">Recorded manual stock adjustments</h3>
      <p className="text-sm text-[#5b766a]">
        This history covers receipts/corrections, not a complete stock ledger.
        Reservation and order allocations are shown separately.
      </p>
      {history ? (
        <>
          <div className="space-y-3">
            {history.items.map((row) => (
              <article key={row.id} className="rounded-xl border p-4">
                <p className="font-semibold">
                  {row.quantityDelta > 0 ? "+" : ""}
                  {row.quantityDelta} units · {row.balanceBefore} →{" "}
                  {row.balanceAfter}
                </p>
                <p className="mt-1 break-words">{row.reason}</p>
                <p className="mt-1 text-sm text-[#5b766a]">
                  {new Date(row.createdAt).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}
                </p>
              </article>
            ))}
            {!history.items.length && <p>No manual adjustments recorded.</p>}
          </div>
          <Pagination page={page} next={history.nextPage} onChange={setPage} />
        </>
      ) : historyError ? (
        <div className="space-y-3">
          <ErrorNotice message={historyError} />
          <button
            className={button}
            onClick={() => setHistoryRevision((r) => r + 1)}
          >
            Retry adjustment history
          </button>
        </div>
      ) : (
        <p role="status">Loading adjustment history…</p>
      )}
    </section>
  );
}
export function PharmacyStockOperations({
  branches,
}: {
  branches: PharmacyBranch[];
}) {
  const [query, setQuery] = useState("state=ALL&expiryDays=90"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [report, setReport] = useState<StockReport | null>(null),
    [loading, setLoading] = useState(true),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<StockRow | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    getLive<StockReport>(`/api/v1/pharmacy-portal/stock?${query}&page=${page}`)
      .then((r) => {
        if (current) setReport(r);
      })
      .catch((e) => {
        if (current) {
          setReport(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, page, revision]);
  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      downloadPharmacyCsv(
        await liveApiCsvRequest(
          `/api/v1/pharmacy-portal/stock/export?${query}`,
        ),
        "sabi-pharmacy-stock.csv",
      );
      setMessage("Stock CSV downloaded. Store it securely.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <p className="max-w-2xl text-[#5b766a]">
          Batch-level stock, expiry and replenishment. Expiry dates are checked
          in UTC; selling eligibility is always rechecked by the backend.
        </p>
        <button
          className={button}
          disabled={exporting || loading || !report}
          onClick={() => void exportCsv()}
        >
          <Download size={18} aria-hidden="true" />
          {exporting ? "Exporting…" : "Export stock CSV"}
        </button>
      </div>
      <form
        className={`${card} grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5`}
        onSubmit={(e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget);
          const p = new URLSearchParams();
          for (const key of ["branchId", "search", "state", "expiryDays"])
            if (v.get(key)) p.set(key, String(v.get(key)));
          setQuery(p.toString());
          setPage(1);
          setSelected(null);
          setMessage("");
        }}
      >
        <BranchSelect branches={branches} />
        <label>
          Product or batch
          <input name="search" maxLength={100} className={input} />
        </label>
        <label>
          Stock state
          <select name="state" className={input}>
            <option value="ALL">All stock</option>
            <option value="LOW">Low stock</option>
            <option value="OUT">Out of stock</option>
            <option value="EXPIRING">Expiring soon</option>
            <option value="EXPIRED">Expired</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label>
          Expiry horizon (days)
          <input
            name="expiryDays"
            type="number"
            min={1}
            max={365}
            defaultValue={90}
            required
            className={input}
          />
        </label>
        <button className={button}>Apply filters</button>
      </form>
      <ErrorNotice message={error} />
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-emerald-900"
        >
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading stock report…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Batches", report.summary.batchCount],
              ["Low stock", report.summary.lowStockBatches],
              ["Expired batches", report.summary.expiredBatches],
              [
                "Available retail value",
                money(report.summary.retailValueMinor),
              ],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-sm text-[#5b766a]">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#5b766a]">
            Totals match your filters. Retail value is available quantity ×
            selling price, not purchase cost or profit.
          </p>
          {selected && (
            <>
              <button className={button} onClick={() => setSelected(null)}>
                Close stock controls
              </button>
              <StockActions
                key={`${selected.id}:${selected.stockPolicyVersion}`}
                item={selected}
                onSaved={() => {
                  setSelected(null);
                  setRevision((r) => r + 1);
                  setMessage("Stock change recorded successfully.");
                }}
              />
            </>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {report.items.map((item) => (
              <article className={card} key={item.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="text-lg font-bold">{item.medicationName}</h2>
                  <span className="text-sm font-semibold">
                    {!item.isActive
                      ? "Inactive"
                      : item.availableQuantity === 0
                        ? "Out of stock"
                        : item.availableQuantity <= item.reorderPoint
                          ? "Low stock"
                          : "Available"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#5b766a]">
                  {item.branchName || "Legacy unassigned branch"} · Batch{" "}
                  {item.batchNumber || "Not specified"} ·{" "}
                  {dateText(item.expiryDate)}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt>Available</dt>
                    <dd className="font-bold">
                      {item.availableQuantity} units
                    </dd>
                  </div>
                  <div>
                    <dt>Reserved / order allocated</dt>
                    <dd className="font-bold">
                      {item.reservedUnits} / {item.orderAllocatedUnits} units
                    </dd>
                  </div>
                  <div>
                    <dt>Reorder point / target</dt>
                    <dd>
                      {item.reorderPoint} / {item.reorderTarget ?? "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Suggested replenishment</dt>
                    <dd>
                      {item.suggestedReorderQuantity ?? "Set a target"}
                      {item.suggestedReorderQuantity !== null ? " units" : ""}
                    </dd>
                  </div>
                </dl>
                <button
                  className={`${button} mt-4`}
                  onClick={() => {
                    setSelected(item);
                    setMessage("");
                  }}
                >
                  Stock actions & history
                </button>
              </article>
            ))}
          </div>
          {!report.items.length && (
            <p className={card}>
              No stock matches these filters. Add inventory in Catalogue &
              inventory or adjust your filters.
            </p>
          )}
          <Pagination
            page={page}
            next={report.nextPage}
            onChange={(p) => {
              setPage(p);
              setSelected(null);
            }}
          />
        </>
      ) : (
        <button className={button} onClick={() => setRevision((r) => r + 1)}>
          <RefreshCw size={18} aria-hidden="true" />
          Retry stock report
        </button>
      )}
    </div>
  );
}

type SalesReport = {
  summary: {
    paidFulfilments: number;
    productSubtotalMinor: number;
    commissionMinor: number;
    deliveryFeesMinor: number;
    productNetBeforeRefundsMinor: number;
    refundReviewMinor: number;
    legacyCommissionUnknown: number;
  };
  daily: {
    day: string;
    paidFulfilments: number;
    productSubtotalMinor: number;
    commissionMinor: number;
  }[];
  ordersByStatus: { status: string; count: number }[];
  items: {
    id: string;
    reference: string;
    status: string;
    fulfilmentMethod: string;
    subtotalMinor: number;
    commissionMinor: number | null;
    paidAt: string;
  }[];
  nextPage: number | null;
};
type Communications = {
  items: {
    id: string;
    kind: string;
    status: string;
    attempts: number;
    lastErrorCode: string | null;
    createdAt: string;
    sentAt: string | null;
  }[];
  nextPage: number | null;
};
const lagosDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join("-");
};
export function PharmacyReports({ branches }: { branches: PharmacyBranch[] }) {
  const [{ today, start }] = useState(() => ({
    today: lagosDate(new Date()),
    start: lagosDate(new Date(Date.now() - 29 * 86400000)),
  }));
  const [query, setQuery] = useState(`from=${start}&to=${today}`),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [report, setReport] = useState<SalesReport | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [emails, setEmails] = useState<Communications | null>(null),
    [emailPage, setEmailPage] = useState(1),
    [emailError, setEmailError] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    getLive<SalesReport>(
      `/api/v1/pharmacy-portal/reports/sales?${query}&page=${page}`,
    )
      .then((r) => {
        if (current) setReport(r);
      })
      .catch((e) => {
        if (current) {
          setError(e.message);
          setReport(null);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, page, revision]);
  useEffect(() => {
    let current = true;
    setEmails(null);
    setEmailError("");
    getLive<Communications>(
      `/api/v1/pharmacy-portal/communications?page=${emailPage}`,
    )
      .then((r) => {
        if (current) setEmails(r);
      })
      .catch((e) => {
        if (current) setEmailError(e.message);
      });
    return () => {
      current = false;
    };
  }, [emailPage, revision]);
  async function exportCsv() {
    setBusy(true);
    setError("");
    try {
      downloadPharmacyCsv(
        await liveApiCsvRequest(
          `/api/v1/pharmacy-portal/reports/sales/export?${query}`,
        ),
        "sabi-pharmacy-sales.csv",
      );
      setMessage(
        "Sales CSV downloaded. This is not a payout or settlement statement.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <p className="max-w-2xl text-[#5b766a]">
          Paid sales use server-confirmed successful payment timestamps, not
          browser checkout success. Date filters use Africa/Lagos.
        </p>
        <button
          className={button}
          disabled={busy || loading || !report}
          onClick={() => void exportCsv()}
        >
          <Download size={18} aria-hidden="true" />
          {busy ? "Exporting…" : "Export sales CSV"}
        </button>
      </div>
      <form
        className={`${card} grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4`}
        onSubmit={(e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget),
            p = new URLSearchParams({
              from: String(v.get("from")),
              to: String(v.get("to")),
            });
          if (v.get("branchId")) p.set("branchId", String(v.get("branchId")));
          setQuery(p.toString());
          setPage(1);
          setMessage("");
        }}
      >
        <label>
          From
          <input
            name="from"
            type="date"
            required
            defaultValue={start}
            className={input}
          />
        </label>
        <label>
          To
          <input
            name="to"
            type="date"
            required
            defaultValue={today}
            className={input}
          />
        </label>
        <BranchSelect branches={branches} />
        <button className={button}>Apply date range</button>
        <p className="text-sm text-[#5b766a] lg:col-span-4">
          Up to 366 days. Branch filters include whole fulfilments containing
          that branch’s stock; mixed-branch prescription orders are not
          prorated.
        </p>
      </form>
      <ErrorNotice message={error} />
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Loading sales report…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Paid fulfilments", report.summary.paidFulfilments],
              ["Product sales", money(report.summary.productSubtotalMinor)],
              ["Commission", money(report.summary.commissionMinor)],
              [
                "Product net before refunds",
                money(report.summary.productNetBeforeRefundsMinor),
              ],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-sm text-[#5b766a]">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            These are operational figures, not profit or money paid out.
            Delivery fees: {money(report.summary.deliveryFeesMinor)}. Pending
            refund review: {money(report.summary.refundReviewMinor)}.{" "}
            {report.summary.legacyCommissionUnknown > 0 &&
              `${report.summary.legacyCommissionUnknown} legacy fulfilments have unknown commission and are excluded from product net.`}
          </p>
          <section className={card}>
            <h2 className="text-xl font-bold">
              Orders created during this period
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {report.ordersByStatus.map((row) => (
                <p key={row.status} className="rounded-xl border p-3">
                  {row.status.replaceAll("_", " ")}:{" "}
                  <strong>{row.count}</strong>
                </p>
              ))}
              {!report.ordersByStatus.length && (
                <p>No orders created in this period.</p>
              )}
            </div>
          </section>
          <section className={card}>
            <h2 className="text-xl font-bold">
              Daily paid sales · Lagos dates
            </h2>
            <div className="mt-4 space-y-3">
              {report.daily.map((row) => (
                <div
                  key={row.day}
                  className="flex flex-wrap justify-between gap-3 border-b pb-3"
                >
                  <strong>{row.day}</strong>
                  <span>
                    {row.paidFulfilments} fulfilments ·{" "}
                    {money(row.productSubtotalMinor)} · Commission{" "}
                    {money(row.commissionMinor)}
                  </span>
                </div>
              ))}
              {!report.daily.length && (
                <p>No confirmed paid sales for this range.</p>
              )}
            </div>
          </section>
          <section className={card}>
            <h2 className="text-xl font-bold">Paid fulfilments</h2>
            <div className="mt-4 space-y-3">
              {report.items.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-wrap justify-between gap-3 rounded-xl border p-4"
                >
                  <div>
                    <h3 className="font-semibold">{row.reference}</h3>
                    <p className="text-sm text-[#5b766a]">
                      {new Date(row.paidAt).toLocaleString("en-NG", {
                        timeZone: "Africa/Lagos",
                      })}{" "}
                      · {row.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <p>
                    {money(row.subtotalMinor)} · Commission{" "}
                    {row.commissionMinor === null
                      ? "Unknown (legacy)"
                      : money(row.commissionMinor)}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-4">
              <Pagination
                page={page}
                next={report.nextPage}
                onChange={setPage}
              />
            </div>
          </section>
        </>
      ) : (
        <button className={button} onClick={() => setRevision((r) => r + 1)}>
          Retry reports
        </button>
      )}
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-bold">
            Approval emails & licence reminders
          </h2>
          <button className={button} onClick={() => setRevision((r) => r + 1)}>
            <RefreshCw size={18} aria-hidden="true" />
            Refresh status
          </button>
        </div>
        <p className="text-sm text-[#5b766a]">
          Reminders are queued within 30, 14, 7 and 1 days of licence expiry,
          and once after expiry. “Sent” means accepted by the email provider,
          not confirmed inbox delivery. Failed emails do not undo approval.
        </p>
        <ErrorNotice message={emailError} />
        {emails ? (
          <>
            <div className="space-y-3">
              {emails.items.map((row) => (
                <article key={row.id} className="rounded-xl border p-4">
                  <p className="font-semibold">
                    {row.kind.replaceAll("_", " ")} · {row.status}
                  </p>
                  <p className="mt-1 text-sm text-[#5b766a]">
                    {new Date(row.createdAt).toLocaleString("en-NG", {
                      timeZone: "Africa/Lagos",
                    })}{" "}
                    · {row.attempts} attempts
                    {row.lastErrorCode
                      ? ` · ${row.lastErrorCode.replaceAll("_", " ")}`
                      : ""}
                  </p>
                </article>
              ))}
              {!emails.items.length && (
                <p>No approval emails or expiry reminders queued yet.</p>
              )}
            </div>
            <Pagination
              page={emailPage}
              next={emails.nextPage}
              onChange={setEmailPage}
            />
          </>
        ) : (
          !emailError && <p role="status">Loading email history…</p>
        )}
      </section>
    </div>
  );
}
