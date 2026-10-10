import { useState, type FormEvent } from "react";
import { writeLive, type LiveInventory } from "./liveApi";

const input =
  "min-h-11 w-full rounded-lg border border-[#cfe0d8] bg-white px-3 py-2";
const button =
  "min-h-11 rounded-lg border border-[#cfe0d8] px-4 font-semibold disabled:opacity-50";
export default function InventoryControls({
  item,
  busy,
  perform,
}: {
  item: LiveInventory;
  busy: boolean;
  perform: (action: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const listing = item.listing;
  function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void perform(
      () =>
        writeLive(`/api/v1/pharmacy-portal/inventory/${item.id}/adjust`, {
          idempotencyKey: key,
          expectedQuantity: item.availableQuantity,
          quantityDelta: Number(values.get("quantityDelta")),
          reason: values.get("reason"),
        }),
      "Stock adjustment recorded.",
    );
  }
  function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    const values = new FormData(event.currentTarget);
    void perform(
      () =>
        writeLive(
          `/api/v1/pharmacy-portal/listings/${listing.id}`,
          {
            version: listing.version,
            medicationName: values.get("name"),
            genericName: values.get("generic") || null,
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate?.slice(0, 10) || null,
            unitPriceMinor: Math.round(Number(values.get("price")) * 100),
            category: values.get("category"),
            description: values.get("description"),
            productClass: values.get("productClass"),
            nafdacNumber: values.get("nafdac") || null,
            isActive: values.get("active") === "on",
            reason: values.get("reason"),
          },
          "PATCH",
        ),
      "Product updated. It is a private draft again and requires marketplace review before publication.",
    );
  }
  return (
    <div className="space-y-4 p-5">
      {item.batchNumber && (
        <p className="text-sm text-[#5b766a]">
          Batch {item.batchNumber} · expiry{" "}
          {item.expiryDate
            ? new Date(item.expiryDate).toLocaleDateString()
            : "Not supplied"}
          . Batch identity cannot be changed; create separate stock for a new
          batch.
        </p>
      )}
      <details className="rounded-xl border border-[#dbe9e2] p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Receive or adjust stock
        </summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={adjust}>
          <label>
            Quantity change
            <input
              required
              type="number"
              name="quantityDelta"
              min="-1000000"
              max="1000000"
              step="1"
              placeholder="For example 20 or -3"
              className={input}
            />
          </label>
          <label>
            Reason
            <input
              required
              minLength={10}
              maxLength={1000}
              name="reason"
              className={input}
            />
          </label>
          <p className="text-sm text-[#5b766a] sm:col-span-2">
            Current available stock: {item.availableQuantity}. Positive
            quantities receive stock; negative quantities remove it. Reserved
            stock is not part of this balance.
          </p>
          <button disabled={busy} className={button}>
            Record stock change
          </button>
        </form>
      </details>
      {listing && (
        <details className="rounded-xl border border-[#dbe9e2] p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Edit product and price
          </summary>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={edit}>
            <label>
              Product name
              <input
                required
                name="name"
                defaultValue={item.medicationName}
                minLength={2}
                maxLength={120}
                className={input}
              />
            </label>
            <label>
              Generic name
              <input
                name="generic"
                defaultValue={item.genericName || ""}
                maxLength={120}
                className={input}
              />
            </label>
            <label>
              Unit price (NGN)
              <input
                required
                name="price"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue={item.unitPriceMinor / 100}
                className={input}
              />
            </label>
            <label>
              Category
              <select
                name="category"
                defaultValue={listing.category}
                className={input}
              >
                {[
                  "OTC",
                  "DEVICES",
                  "BABY",
                  "HYGIENE",
                  "SUPPLEMENTS",
                  "WELLNESS",
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              Product class
              <select
                name="productClass"
                defaultValue={listing.productClass}
                className={input}
              >
                <option value="OTC">OTC medicine</option>
                <option value="PRESCRIPTION_ONLY">Prescription only</option>
                <option value="NON_MEDICINAL">Non-medicinal essential</option>
              </select>
            </label>
            <label>
              NAFDAC registration
              <input
                name="nafdac"
                defaultValue={listing.nafdacNumber || ""}
                maxLength={100}
                className={input}
              />
            </label>
            <label className="sm:col-span-2">
              Description
              <textarea
                required
                name="description"
                minLength={5}
                maxLength={1500}
                defaultValue={listing.description}
                className={input}
              />
            </label>
            <label className="sm:col-span-2">
              Reason for change
              <input
                required
                name="reason"
                minLength={10}
                maxLength={1000}
                className={input}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                name="active"
                type="checkbox"
                defaultChecked={item.isActive}
              />{" "}
              Active inventory item
            </label>
            <p className="text-sm text-[#5b766a] sm:col-span-2">
              Editing removes this product from the marketplace until the
              updated listing is reviewed.
            </p>
            <button className={button} disabled={busy}>
              Save product changes
            </button>
          </form>
        </details>
      )}
      {listing && ["PUBLISHED", "SUBMITTED"].includes(listing.status) && (
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            void perform(
              () =>
                writeLive(
                  `/api/v1/pharmacy-portal/listings/${listing.id}/withdraw`,
                  { version: listing.version },
                ),
              "Listing withdrawn from the marketplace.",
            )
          }
        >
          Withdraw listing
        </button>
      )}
    </div>
  );
}
