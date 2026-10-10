import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { liveApiRequest } from "@/identity/liveIdentity";
import {
  getLive,
  writeLive,
  money,
  latestPharmacyCredentials,
  type LivePharmacy,
  type PharmacyTier,
  type LiveListing,
  type PharmacyCredential,
} from "@/pharmacy/liveApi";
import {
  CommandPageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "./components/ui";
const input =
  "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600";
const button =
  "min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
function TierEditor({
  tier,
  save,
  busy,
}: {
  tier: PharmacyTier;
  save: (v: PharmacyTier, reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [value, setValue] = useState(tier),
    [reason, setReason] = useState("");
  useEffect(() => setValue(tier), [tier]);
  return (
    <Panel>
      <PanelHeader
        title={`Tier ${tier.level}`}
        description={`Policy version ${tier.version}; changes apply to new orders only.`}
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await save(value, reason);
        }}
        className="grid gap-4 p-5 sm:grid-cols-2"
      >
        <label className="text-sm font-semibold">
          Name
          <input
            required
            className={input}
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          Commission (%)
          <input
            required
            type="number"
            min={0}
            max={100}
            step="0.01"
            className={input}
            value={value.commissionBps / 100}
            onChange={(e) =>
              setValue({
                ...value,
                commissionBps: Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Maximum delivery radius (km)
          <input
            required
            type="number"
            min={1}
            max={100}
            className={input}
            value={value.deliveryRadiusKm}
            onChange={(e) =>
              setValue({ ...value, deliveryRadiusKm: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Branch limit
          <input
            type="number"
            min={1}
            max={10000}
            placeholder="Unlimited"
            className={input}
            value={value.maxBranches ?? ""}
            onChange={(e) =>
              setValue({
                ...value,
                maxBranches: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Minimum order (NGN)
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className={input}
            value={value.minimumOrderMinor / 100}
            onChange={(e) =>
              setValue({
                ...value,
                minimumOrderMinor: Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </label>
        <fieldset className="flex flex-wrap gap-4 self-center">
          <legend className="sr-only">Available fulfilment options</legend>
          {(["deliveryEnabled", "pickupEnabled", "enabled"] as const).map(
            (key) => (
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                key={key}
              >
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(e) =>
                    setValue({ ...value, [key]: e.target.checked })
                  }
                />
                {key === "enabled"
                  ? "Tier enabled"
                  : key === "deliveryEnabled"
                    ? "Delivery"
                    : "Pickup"}
              </label>
            ),
          )}
        </fieldset>
        <label className="text-sm font-semibold sm:col-span-2">
          Reason for audit
          <textarea
            required
            minLength={10}
            maxLength={1000}
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button disabled={busy} className={`${button} sm:col-span-2`}>
          {busy ? "Saving…" : "Save policy"}
        </button>
      </form>
    </Panel>
  );
}
export default function LivePharmaciesPage() {
  const path = useLocation().pathname,
    tiersPage = path === "/command-center/pharmacy-tiers",
    listingsPage = path === "/command-center/pharmacy-listings";
  const id = path.split("/")[4];
  const [tiers, setTiers] = useState<PharmacyTier[]>([]),
    [pharmacies, setPharmacies] = useState<LivePharmacy[]>([]),
    [pharmacy, setPharmacy] = useState<LivePharmacy | null>(null),
    [listings, setListings] = useState<LiveListing[]>([]);
  const [page, setPage] = useState(1),
    [nextPage, setNextPage] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<PharmacyCredential | null>(null),
    [decision, setDecision] = useState("VERIFIED"),
    [sourceName, setSourceName] = useState(""),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [tierLevel, setTierLevel] = useState(1),
    [decisionNote, setDecisionNote] = useState(""),
    [confirm, setConfirm] = useState("");
  const [images, setImages] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<string[] | null>(null);
  useEffect(() => {
    if (!id || !pharmacy) return;
    let current = true;
    setReadiness(null);
    getLive<{ blockers: string[] }>(
      `/api/v1/platform/pharmacies/${id}/readiness?tierLevel=${tierLevel}`,
    )
      .then((result) => {
        if (current) setReadiness(result.blockers);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [id, tierLevel, pharmacy]);
  useEffect(
    () => () => {
      Object.values(images).forEach((url) => URL.revokeObjectURL(url));
    },
    [images],
  );
  async function refresh() {
    if (tiersPage) {
      const result = await getLive<{ items: PharmacyTier[] }>(
        "/api/v1/platform/pharmacies/tiers",
      );
      setTiers(result.items);
    } else if (listingsPage) {
      const result = await getLive<{
        items: LiveListing[];
        nextPage: number | null;
      }>(`/api/v1/platform/pharmacies/listings?page=${page}`);
      setListings(result.items);
      setNextPage(result.nextPage);
    } else if (id) {
      const result = await getLive<LivePharmacy>(
        `/api/v1/platform/pharmacies/${id}`,
      );
      setPharmacy(result);
      setTierLevel(result.tier?.level || 1);
    } else {
      const result = await getLive<{
        items: LivePharmacy[];
        nextPage: number | null;
      }>(`/api/v1/platform/pharmacies?page=${page}`);
      setPharmacies(result.items);
      setNextPage(result.nextPage);
    }
  }
  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, page]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  async function preview(doc: PharmacyCredential) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError(
        "Allow popups for Command Center to open the private document preview.",
      );
      return;
    }
    tab.opener = null;
    await run(async () => {
      try {
        const result = await getLive<{ url: string }>(
          `/api/v1/platform/pharmacies/${id}/credentials/${doc.id}/preview`,
        );
        tab.location.replace(result.url);
      } catch (e) {
        tab.close();
        throw e;
      }
    }, "Private preview opened. The link expires in 60 seconds.");
  }
  async function review(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await run(
      () =>
        writeLive(
          `/api/v1/platform/pharmacies/${id}/credentials/${selected.id}/review`,
          { decision, sourceName, reference, note },
        ),
      "Document review recorded.",
    );
    setSelected(null);
  }
  async function previewImage(listing: LiveListing) {
    // Image endpoints are protected. Fetch with the in-memory Sabi token rather
    // than putting a credential into an img URL or making the image public.
    await run(async () => {
      const result = await liveApiRequest<{ data: { base64: string } }>(
        `/api/v1/platform/pharmacies/listings/${listing.id}/image-data`,
      );
      setImages((old) => ({
        ...old,
        [listing.id]: `data:image/jpeg;base64,${result.data.base64}`,
      }));
    }, "Product image loaded.");
  }
  const title = tiersPage
    ? "Pharmacy tier policies"
    : listingsPage
      ? "Marketplace review"
      : pharmacy
        ? pharmacy.name
        : "Pharmacies";
  return (
    <>
      <CommandPageHeader
        eyebrow="Sabi Health · Pharmacy operations"
        title={title}
        description={
          tiersPage
            ? "Commission is calculated on product subtotal, excluding delivery. Existing order snapshots never change."
            : "Review business credentials, premises and public product listings independently."
        }
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading pharmacy operations…</p>
      ) : tiersPage ? (
        <div className="space-y-5">
          {tiers.map((tier) => (
            <TierEditor
              key={tier.level}
              tier={tier}
              busy={busy}
              save={(value, reason) =>
                run(
                  () =>
                    writeLive(
                      `/api/v1/platform/pharmacies/tiers/${tier.level}`,
                      {
                        ...Object.fromEntries(
                          Object.entries(value).filter(
                            ([key]) => key !== "level",
                          ),
                        ),
                        reason,
                      },
                      "PATCH",
                    ),
                  "Tier policy saved. New orders will use this version.",
                )
              }
            />
          ))}
        </div>
      ) : listingsPage ? (
        <div className="space-y-4">
          {!listings.length && (
            <Panel>
              <p className="p-5 text-slate-600">No listings awaiting review.</p>
            </Panel>
          )}
          {listings.map((listing) => (
            <Panel key={listing.id}>
              <PanelHeader
                title={listing.inventoryItem?.medicationName || "Product"}
                description={`${listing.inventoryItem?.pharmacy.name} · ${listing.productClass} · ${money(listing.inventoryItem?.unitPriceMinor || 0)}`}
              />
              <div className="space-y-3 p-5">
                <p className="text-sm">{listing.description}</p>
                <p className="text-sm">
                  NAFDAC number: {listing.nafdacNumber || "Not provided"}
                </p>
                {images[listing.id] ? (
                  <img
                    src={images[listing.id]}
                    alt={
                      listing.inventoryItem?.medicationName ||
                      "Product submitted for review"
                    }
                    className="h-48 w-48 rounded-xl object-contain"
                  />
                ) : (
                  <button
                    disabled={busy}
                    className="min-h-11 rounded-lg border px-4"
                    onClick={() => previewImage(listing)}
                  >
                    View product image
                  </button>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    run(
                      () =>
                        writeLive(
                          `/api/v1/platform/pharmacies/listings/${listing.id}/decision`,
                          {
                            version: listing.version,
                            status: data.get("status"),
                            note: data.get("note"),
                          },
                        ),
                      "Listing decision recorded.",
                    );
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <label className="text-sm font-semibold">
                    Decision
                    <select name="status" className={input}>
                      <option value="REJECTED">Reject</option>
                      <option value="PUBLISHED">Publish to marketplace</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Review findings
                    <input
                      required
                      minLength={10}
                      maxLength={2000}
                      name="note"
                      className={input}
                    />
                  </label>
                  <button disabled={busy} className={button}>
                    Confirm listing decision
                  </button>
                </form>
              </div>
            </Panel>
          ))}
        </div>
      ) : pharmacy ? (
        <div className="space-y-4">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700"
            to="/command-center/sabi-health/pharmacies"
          >
            Back to pharmacies
          </Link>
          <Panel>
            <PanelHeader
              title="Application"
              action={<StatusPill status={pharmacy.complianceStatus} />}
            />
            <div className="p-5 text-sm">
              <p>
                {pharmacy.address}, {pharmacy.city}, {pharmacy.state}
              </p>
              <p className="mt-2">
                {pharmacy.contactEmail} · {pharmacy.contactPhone}
              </p>
              <p className="mt-2">
                CAC: {pharmacy.registrationDetails?.cacNumber || "Not supplied"}
              </p>
              <p className="mt-2">
                Superintendent:{" "}
                {pharmacy.registrationDetails?.superintendentName ||
                  "Not supplied"}{" "}
                · PCN{" "}
                {pharmacy.registrationDetails
                  ?.superintendentRegistrationNumber || "Not supplied"}
              </p>
              <p className="mt-2">
                Superintendent licence expiry:{" "}
                {pharmacy.registrationDetails?.superintendentLicenceExpiresAt
                  ? new Date(
                      pharmacy.registrationDetails
                        .superintendentLicenceExpiresAt,
                    ).toLocaleDateString()
                  : "Not supplied"}
              </p>
              <p className="mt-2">
                {pharmacy.applicationSubmittedAt
                  ? `Submitted ${new Date(pharmacy.applicationSubmittedAt).toLocaleString()}`
                  : "Not submitted yet"}
              </p>
            </div>
          </Panel>
          {pharmacy.branches.map((branch) => (
            <Panel key={branch.id}>
              <PanelHeader
                title={branch.name}
                action={<StatusPill status={branch.status} />}
              />
              <div className="p-5 text-sm">
                <p>{branch.address}</p>
                <p className="mt-1">
                  PCN premises: {branch.premisesLicenceNumber} · expiry{" "}
                  {new Date(branch.licenceExpiresAt).toLocaleDateString()}
                </p>
              </div>
            </Panel>
          ))}
          <Panel>
            <PanelHeader title="Credential documents" />
            <div className="divide-y p-5">
              {latestPharmacyCredentials(pharmacy.credentials).map((doc) => (
                <article key={doc.id} className="py-4">
                  <h2 className="font-semibold">
                    {doc.kind.replaceAll("_", " ")}{" "}
                    {doc.branchId &&
                      `· ${pharmacy.branches.find((b) => b.id === doc.branchId)?.name}`}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Screening: {doc.scanStatus} · Authenticity:{" "}
                    {doc.reviewStatus}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {doc.scanStatus === "FAILED" && (
                      <button
                        disabled={busy}
                        className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-40"
                        onClick={() =>
                          run(
                            () =>
                              writeLive(
                                `/api/v1/platform/pharmacies/${id}/credentials/${doc.id}/retry-scan`,
                                {},
                              ),
                            "Security screening queued again. Preview remains blocked until a clean result.",
                          )
                        }
                      >
                        Retry security screening
                      </button>
                    )}
                    <button
                      disabled={busy || doc.scanStatus !== "CLEAN"}
                      onClick={() => preview(doc)}
                      className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-40"
                    >
                      Preview
                    </button>
                    <button
                      disabled={
                        busy ||
                        doc.scanStatus !== "CLEAN" ||
                        doc.reviewStatus !== "PENDING"
                      }
                      onClick={() => {
                        setSelected(doc);
                        setSourceName("");
                        setReference("");
                        setNote("");
                      }}
                      className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-40"
                    >
                      Record authenticity review
                    </button>
                  </div>
                </article>
              ))}
              {!pharmacy.credentials.length && (
                <p className="text-sm text-slate-600">
                  No credentials uploaded yet.
                </p>
              )}
            </div>
          </Panel>
          {selected && (
            <Panel>
              <PanelHeader
                title={`Review ${selected.kind.replaceAll("_", " ")}`}
              />
              <form onSubmit={review} className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Decision
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    className={input}
                  >
                    <option value="VERIFIED">Verified</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Authority or source
                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Reference
                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Findings
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={input}
                  />
                </label>
                <div className="flex gap-3">
                  <button disabled={busy} className={button}>
                    Save review
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="min-h-11 rounded-lg border px-4"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Pharmacy approval" />
            <div className="space-y-4 p-5">
              {readiness === null && (
                <p role="status">
                  Checking approval requirements for this tier…
                </p>
              )}
              {(readiness || pharmacy.blockers).length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {(readiness || pharmacy.blockers).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <label className="block text-sm font-semibold">
                Assigned tier
                <select
                  className={input}
                  value={tierLevel}
                  onChange={(e) => setTierLevel(Number(e.target.value))}
                >
                  {[1, 2, 3].map((level) => (
                    <option key={level} value={level}>
                      Tier {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Decision reason
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className={input}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                {["VERIFIED", "REJECTED", "SUSPENDED"].map((status) => (
                  <button
                    key={status}
                    disabled={
                      busy ||
                      decisionNote.trim().length < 10 ||
                      (status === "VERIFIED" &&
                        (!readiness || readiness.length > 0))
                    }
                    onClick={() => setConfirm(status)}
                    className={`${status === "VERIFIED" ? button : "min-h-11 rounded-lg border px-4 text-sm"} disabled:opacity-40`}
                  >
                    {status === "VERIFIED"
                      ? "Approve pharmacy"
                      : status === "REJECTED"
                        ? "Reject application"
                        : "Suspend pharmacy"}
                  </button>
                ))}
              </div>
              {confirm && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">
                    Confirm {confirm.toLowerCase()} for this pharmacy? This
                    affects all its branches and marketplace availability.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        run(
                          () =>
                            writeLive(
                              `/api/v1/platform/pharmacies/${id}/decision`,
                              {
                                status: confirm,
                                tierLevel,
                                expectedStatus: pharmacy.complianceStatus,
                                note: decisionNote,
                              },
                            ),
                          "Pharmacy decision recorded.",
                        )
                      }
                    >
                      Confirm decision
                    </button>
                    <button
                      className="min-h-11 px-4 text-sm"
                      onClick={() => setConfirm("")}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      ) : (
        <Panel>
          <PanelHeader title="Registered pharmacies" />
          <div className="divide-y">
            {pharmacies.map((p) => (
              <Link
                key={p.id}
                to={`/command-center/sabi-health/pharmacies/${p.id}`}
                className="flex min-h-20 flex-wrap items-center justify-between gap-3 p-5 hover:bg-slate-50"
              >
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Tier {p.tier?.level || "Unassigned"} · {p.branches.length}{" "}
                    branches · {p.city}, {p.state}
                  </p>
                </div>
                <StatusPill status={p.complianceStatus} />
              </Link>
            ))}
            {!pharmacies.length && (
              <p className="p-5 text-slate-600">
                No pharmacies have registered yet.
              </p>
            )}
          </div>
        </Panel>
      )}
      {!tiersPage && !id && (
        <div className="mt-4 flex justify-between">
          <button
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
            disabled={loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
            disabled={loading || !nextPage}
            onClick={() => nextPage && setPage(nextPage)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
