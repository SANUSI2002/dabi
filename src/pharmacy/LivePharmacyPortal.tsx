import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Pill,
  Building2,
  Package,
  FileText,
  ShoppingBag,
  LogOut,
  ShieldCheck,
  Users,
  BarChart3,
  Boxes,
} from "lucide-react";
import {
  restoreLiveIdentity,
  liveSignOut,
  type LiveIdentity,
} from "@/identity/liveIdentity";
import {
  getLive,
  writeLive,
  uploadLive,
  money,
  latestPharmacyCredentials,
  type LivePharmacy,
  type LiveInventory,
} from "./liveApi";
import { Panel, PanelHeader, StatusPill } from "@/command-center/components/ui";
import InvitationManager from "@/identity/components/InvitationManager";
import InventoryControls from "./InventoryControls";
import LicenceRenewalForm from "./LicenceRenewalForm";
import { PharmacyStockOperations, PharmacyReports } from './PharmacyOperations';
import DeliveryHandover from './DeliveryHandover';
const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cfe0d8] bg-white px-3 py-2 text-base text-[#17342a] focus:outline-none focus:ring-2 focus:ring-[#0b8a63]";
const button =
  "min-h-11 rounded-xl bg-[#0d2c22] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#174a3a] disabled:opacity-50";
type RequestRow = {
  id: string;
  prescriptionId: string;
  status: string;
  createdAt: string;
  quotes: { id: string; status: string; revision: number }[];
};
type OrderRow = {
  id: string;
  status: string;
  fulfilmentMethod: string;
  totalMinor: number;
  commissionMinor: number | null;
  order: { reference: string; status: string };
};
const sections = [
  ["overview", "Overview", ShieldCheck],
  ["branches", "Branches", Building2],
  ["catalogue", "Catalogue & inventory", Package],
  ["stock", "Stock operations", Boxes],
  ["reports", "Reports & reminders", BarChart3],
  ["prescriptions", "Prescriptions", FileText],
  ["orders", "Orders", ShoppingBag],
  ["team", "Team", Users],
] as const;
export default function LivePharmacyPortal() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<LiveIdentity | null>(null),
    [pharmacy, setPharmacy] = useState<LivePharmacy | null>(null),
    [section, setSection] = useState("overview"),
    [inventory, setInventory] = useState<LiveInventory[]>([]),
    [requests, setRequests] = useState<RequestRow[]>([]),
    [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [cataloguePage, setCataloguePage] = useState(1),
    [nextCatalogue, setNextCatalogue] = useState<number | null>(null);
  async function refresh() {
    setPharmacy(await getLive<LivePharmacy>("/api/v1/pharmacy-portal/me"));
  }
  async function loadCatalogue() {
    const result = await getLive<{
      items: LiveInventory[];
      nextPage: number | null;
    }>(`/api/v1/pharmacy-portal/catalogue?page=${cataloguePage}`);
    setInventory(result.items);
    setNextCatalogue(result.nextPage);
  }
  useEffect(() => {
    let current = true;
    (async () => {
      const restored = await restoreLiveIdentity();
      if (!restored) {
        navigate("/pharmacy/login", { replace: true });
        return;
      }
      if (current) setIdentity(restored);
      await refresh();
    })()
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [navigate]);
  useEffect(() => {
    if (!pharmacy) return;
    let current = true;
    setLoading(true);
    const call =
      section === "catalogue"
        ? loadCatalogue()
        : section === "prescriptions"
          ? getLive<{ items: RequestRow[] }>(
              "/api/v1/pharmacy-portal/requests",
            ).then((r) => {
              if (current) setRequests(r.items);
            })
          : section === "orders"
            ? getLive<{ items: OrderRow[] }>(
                "/api/v1/pharmacy-portal/orders",
              ).then((r) => {
                if (current) setOrders(r.items);
              })
            : Promise.resolve();
    call
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [section, cataloguePage, pharmacy?.id]);
  useEffect(() => {
    if (!pharmacy?.credentials.some((d) => d.scanStatus === "PENDING")) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [pharmacy]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete this operation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createBranch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      values = new FormData(form);
    await run(async () => {
      await writeLive("/api/v1/pharmacy-portal/branches", {
        name: values.get("name"),
        address: values.get("address"),
        latitude: Number(values.get("latitude")),
        longitude: Number(values.get("longitude")),
        premisesLicenceNumber: values.get("licence"),
        licenceExpiresAt: new Date(
          `${values.get("expiry")}T23:59:59.999Z`,
        ).toISOString(),
      });
      form.reset();
    }, "Branch added. Its premises licence is required before activation.");
  }
  async function uploadCredential(
    kind: string,
    selectedFile: File,
    branchId?: string,
  ) {
    await run(
      () =>
        uploadLive(
          `/api/v1/pharmacy-portal/credentials/${kind}${branchId ? `?branchId=${branchId}` : ""}`,
          selectedFile,
        ),
      "Document received. Malware screening runs automatically in the background.",
    );
  }
  async function createProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const form = e.currentTarget,
      values = new FormData(form),
      image = file;
    await run(async () => {
      const listing = await writeLive<{ id: string }>(
        "/api/v1/pharmacy-portal/listings",
        {
          branchId: values.get("branchId"),
          medicationName: values.get("name"),
          ...(values.get("genericName")
            ? { genericName: values.get("genericName") }
            : {}),
          availableQuantity: Number(values.get("quantity")),
          batchNumber: values.get("batchNumber") || null,
          expiryDate: values.get("expiryDate") || null,
          unitPriceMinor: Math.round(Number(values.get("price")) * 100),
          category: values.get("category"),
          description: values.get("description"),
          productClass: values.get("productClass"),
          ...(values.get("nafdac")
            ? { nafdacNumber: values.get("nafdac") }
            : {}),
        },
      );
      // The draft is persisted first, but cannot be submitted/public without a
      // successfully sanitized image. Failed image uploads are retried on that draft.
      form.reset();
      setFile(null);
      await loadCatalogue();
      await uploadLive(
        `/api/v1/pharmacy-portal/listings/${listing.id}/image`,
        image,
      );
      await loadCatalogue();
    }, "Product saved privately with its image. Submit it for marketplace review when ready.");
  }
  const membership = identity?.organizations.find(
    (m) => m.organization.type === "PHARMACY" && m.status === "ACTIVE",
  );
  function credentialField(kind: string, label: string, branchId?: string) {
    const doc =
      pharmacy &&
      latestPharmacyCredentials(pharmacy.credentials).find(
        (d) => d.kind === kind && (d.branchId || undefined) === branchId,
      );
    return (
      <label className="block rounded-xl border border-[#dbe9e2] bg-white p-4">
        <span className="block text-sm font-bold">{label}</span>
        {doc && (
          <span className="mt-2 block text-sm text-[#5b766a]">
            Screening: {doc.scanStatus} · Review: {doc.reviewStatus}
          </span>
        )}
        <input
          disabled={busy}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          aria-label={`${doc ? "Replace" : "Upload"} ${label}`}
          className="mt-3 block w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-[#edf5ef] file:px-4 file:font-semibold"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) uploadCredential(kind, selectedFile, branchId);
            e.target.value = "";
          }}
        />
      </label>
    );
  }
  return (
    <div className="min-h-screen bg-[#f5f8f4] text-[#17342a] lg:flex">
      <aside className="border-b border-[#254337] bg-[#071d16] p-4 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0">
        <Link
          to="/pharmacy-portal"
          className="flex min-h-11 items-center gap-3 font-display text-xl font-bold"
        >
          <Pill className="text-[#f5b94e]" />
          Sabi Pharmacy
        </Link>
        <p className="mt-4 text-sm font-semibold text-[#f5b94e]">
          {pharmacy?.name || "Pharmacy workspace"}
        </p>
        <nav
          aria-label="Pharmacy sections"
          className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2"
        >
          {sections.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={section === key ? "page" : undefined}
              onClick={() => {
                setSection(key);
                setError("");
                setMessage("");
              }}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold lg:w-full ${section === key ? "bg-[#f5b94e] text-[#071d16]" : "text-white/80 hover:bg-white/10"}`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <button
          className="mt-5 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/80"
          onClick={async () => {
            await liveSignOut();
            navigate("/pharmacy/login", { replace: true });
          }}
        >
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5b766a]">
                Pharmacy operations
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                {sections.find((s) => s[0] === section)?.[1]}
              </h1>
            </div>
            {pharmacy && <StatusPill status={pharmacy.complianceStatus} />}
          </header>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              {message}
            </p>
          )}
          {loading ? (
            <p role="status">Loading your pharmacy…</p>
          ) : !pharmacy ? (
            <p>Your pharmacy workspace could not be loaded.</p>
          ) : section === "stock" ? (
            <PharmacyStockOperations branches={pharmacy.branches}/>
          ) : section === "reports" ? (
            <PharmacyReports branches={pharmacy.branches}/>
          ) : section === "overview" ? (
            <div className="space-y-5">
              <section className="rounded-3xl bg-[#0d2c22] p-6 text-white sm:p-8">
                <p className="text-sm font-bold text-[#f5b94e]">
                  Your pharmacy, connected.
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold">
                  {pharmacy.name}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/80">
                  Manage your branches, publish reviewed products and receive
                  prescription requests from Sabi Health.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="min-h-11 rounded-xl bg-[#f5b94e] px-5 font-bold text-[#071d16]"
                    onClick={() => setSection("catalogue")}
                  >
                    Manage catalogue
                  </button>
                  <button
                    className="min-h-11 rounded-xl border border-white/30 px-5 text-sm"
                    onClick={() => setSection("branches")}
                  >
                    Manage branches
                  </button>
                </div>
              </section>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Assigned tier",
                    pharmacy.tier
                      ? `Tier ${pharmacy.tier.level}`
                      : "Awaiting assignment",
                  ],
                  [
                    "Commission",
                    pharmacy.tier
                      ? `${pharmacy.tier.commissionBps / 100}%`
                      : "Not configured",
                  ],
                  [
                    "Delivery radius",
                    pharmacy.tier
                      ? `${pharmacy.tier.deliveryRadiusKm} km`
                      : "Not configured",
                  ],
                ].map(([label, value]) => (
                  <Panel key={label}>
                    <div className="p-5">
                      <p className="text-sm text-[#5b766a]">{label}</p>
                      <p className="mt-2 text-2xl font-bold">{value}</p>
                    </div>
                  </Panel>
                ))}
              </div>
              <Panel>
                <PanelHeader title="Business verification" />
                <div className="space-y-4 p-5">
                  <p className="text-sm text-[#5b766a]">
                    Credentials remain private. Screening runs in the
                    background; Sabi operations independently confirms
                    authenticity.
                  </p>
                  <LicenceRenewalForm
                    key={JSON.stringify(pharmacy.registrationDetails)}
                    pharmacy={pharmacy}
                    busy={busy}
                    perform={run}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    {credentialField("CAC_CERTIFICATE", "CAC certificate")}
                    {credentialField(
                      "SUPERINTENDENT_LICENCE",
                      "Superintendent pharmacist licence",
                    )}
                    {credentialField(
                      "SUPERINTENDENT_APPOINTMENT",
                      "Superintendent appointment evidence",
                    )}
                  </div>
                  <p className="text-sm text-[#5b766a]">
                    PDF, JPEG or PNG; maximum 3.5 MB per file on the current
                    scanner plan. No patient records.
                  </p>
                  {pharmacy.applicationSubmittedAt ? (
                    <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                      Application submitted{" "}
                      {new Date(
                        pharmacy.applicationSubmittedAt,
                      ).toLocaleString()}
                      . Your credentials are in the review queue.
                    </p>
                  ) : (
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        run(
                          () => writeLive("/api/v1/pharmacy-portal/submit", {}),
                          "Application submitted successfully. Sabi operations will review your documents.",
                        )
                      }
                    >
                      Submit application for review
                    </button>
                  )}
                  {pharmacy.decisionNote && (
                    <p className="text-sm">
                      Review note: {pharmacy.decisionNote}
                    </p>
                  )}
                </div>
              </Panel>
            </div>
          ) : section === "branches" ? (
            <div className="space-y-5">
              <Panel>
                <PanelHeader
                  title="Add a branch"
                  description={`Your tier allows ${pharmacy.tier?.maxBranches ?? "multiple"} branches. Every premises requires its own current licence.`}
                />
                <form
                  onSubmit={createBranch}
                  className="grid gap-4 p-5 sm:grid-cols-2"
                >
                  {[
                    ["name", "Branch name", "text"],
                    ["address", "Branch address", "text"],
                    ["latitude", "Latitude", "number"],
                    ["longitude", "Longitude", "number"],
                    ["licence", "PCN premises licence number", "text"],
                    ["expiry", "Licence expiry", "date"],
                  ].map(([name, label, type]) => (
                    <label key={name} className="text-sm font-semibold">
                      {label}
                      <input
                        required
                        name={name}
                        type={type}
                        step={type === "number" ? "any" : undefined}
                        className={input}
                      />
                    </label>
                  ))}
                  <button disabled={busy} className={button}>
                    Add branch
                  </button>
                </form>
              </Panel>
              {pharmacy.branches.map((branch) => (
                <Panel key={branch.id}>
                  <PanelHeader
                    title={branch.name}
                    description={branch.address}
                    action={<StatusPill status={branch.status} />}
                  />
                  <div className="p-5">
                    <LicenceRenewalForm
                      key={branch.version}
                      pharmacy={pharmacy}
                      branch={branch}
                      busy={busy}
                      perform={run}
                    />
                    {credentialField(
                      "PREMISES_LICENCE",
                      "PCN premises licence",
                      branch.id,
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          ) : section === "catalogue" ? (
            <div className="space-y-5">
              <Panel>
                <PanelHeader
                  title="Add inventory product"
                  description="An image is mandatory for marketplace submission. Prescription-only medicines remain outside the public catalogue."
                />
                <form
                  onSubmit={createProduct}
                  className="grid gap-4 p-5 sm:grid-cols-2"
                >
                  <label className="text-sm font-semibold">
                    Branch
                    <select required name="branchId" className={input}>
                      <option value="">Select a branch</option>
                      {pharmacy.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[
                    ["name", "Product name", "text"],
                    ["genericName", "Generic name (optional)", "text"],
                    ["quantity", "Available units", "number"],
                    ["price", "Unit price (NGN)", "number"],
                    ["nafdac", "NAFDAC number", "text"],
                  ].map(([name, label, type]) => (
                    <label key={name} className="text-sm font-semibold">
                      {label}
                      <input
                        required={name !== "genericName" && name !== "nafdac"}
                        name={name}
                        type={type}
                        min={0}
                        max={
                          name === "quantity"
                            ? 1000000
                            : name === "price"
                              ? 10000000
                              : undefined
                        }
                        step={
                          name === "price"
                            ? "0.01"
                            : name === "quantity"
                              ? "1"
                              : undefined
                        }
                        className={input}
                      />
                    </label>
                  ))}
                  <label className="text-sm font-semibold">
                    Product class
                    <select name="productClass" className={input}>
                      <option value="OTC">Over-the-counter medicine</option>
                      <option value="PRESCRIPTION_ONLY">
                        Prescription-only medicine
                      </option>
                      <option value="NON_MEDICINAL">
                        Non-medicinal product
                      </option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Category
                    <select name="category" className={input}>
                      {[
                        "OTC",
                        "DEVICES",
                        "BABY",
                        "HYGIENE",
                        "SUPPLEMENTS",
                        "WELLNESS",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Batch number
                    <input
                      name="batchNumber"
                      minLength={2}
                      maxLength={100}
                      className={input}
                    />
                    <span className="block text-sm text-[#5b766a]">
                      Required for medicines. Create a separate inventory item
                      for each batch.
                    </span>
                  </label>
                  <label className="text-sm font-semibold">
                    Batch expiry date
                    <input name="expiryDate" type="date" className={input} />
                  </label>
                  <label className="text-sm font-semibold">
                    Description
                    <textarea
                      required
                      minLength={5}
                      maxLength={1500}
                      name="description"
                      className={input}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Product image
                    <input
                      required
                      name="image"
                      type="file"
                      accept="image/png,image/jpeg"
                      className={input}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <span className="mt-1 block text-xs font-normal text-[#5b766a]">
                      Product packaging only; JPEG or PNG up to 3 MB. Personal
                      documents must never be used.
                    </span>
                  </label>
                  <button disabled={busy || !file} className={button}>
                    Save product with image
                  </button>
                </form>
              </Panel>
              {!inventory.length && (
                <Panel>
                  <p className="p-5 text-sm text-[#5b766a]">
                    No inventory products yet. Add your first product above.
                  </p>
                </Panel>
              )}
              {inventory.map((item) => (
                <Panel key={item.id}>
                  <PanelHeader
                    title={item.medicationName}
                    description={`${money(item.unitPriceMinor)} · ${item.availableQuantity} units · ${pharmacy.branches.find((b) => b.id === item.branchId)?.name || "Legacy stock"}`}
                    action={
                      <StatusPill status={item.listing?.status || "PRIVATE"} />
                    }
                  />
                  {item.listing && (
                    <div className="space-y-3 p-5">
                      <p className="text-sm text-[#5b766a]">
                        {item.listing.imageHash
                          ? "Image uploaded"
                          : "Image required"}{" "}
                        · {item.listing.productClass.replaceAll("_", " ")}
                      </p>
                      <label className="block text-sm font-semibold">
                        {item.listing.imageHash
                          ? "Replace product image"
                          : "Add product image"}
                        <input
                          disabled={busy}
                          type="file"
                          accept="image/png,image/jpeg"
                          className={input}
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0];
                            if (selectedFile)
                              run(async () => {
                                await uploadLive(
                                  `/api/v1/pharmacy-portal/listings/${item.listing!.id}/image`,
                                  selectedFile,
                                );
                                await loadCatalogue();
                              }, "Product image updated; the listing is a private draft again.");
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {item.listing.reviewNote && (
                        <p className="text-sm">
                          Review note: {item.listing.reviewNote}
                        </p>
                      )}
                      <button
                        disabled={
                          busy ||
                          !item.listing.imageHash ||
                          !["DRAFT", "REJECTED", "WITHDRAWN"].includes(
                            item.listing.status,
                          ) ||
                          item.listing.productClass === "PRESCRIPTION_ONLY"
                        }
                        className={button}
                        onClick={() =>
                          run(async () => {
                            await writeLive(
                              `/api/v1/pharmacy-portal/listings/${item.listing!.id}/submit`,
                              { version: item.listing!.version },
                            );
                            await loadCatalogue();
                          }, "Product submitted to Command Center for marketplace review.")
                        }
                      >
                        Submit marketplace listing
                      </button>
                    </div>
                  )}
                  <InventoryControls
                    key={`${item.id}:${item.availableQuantity}:${item.listing?.version}`}
                    item={item}
                    busy={busy}
                    perform={(action, success) =>
                      run(async () => {
                        await action();
                        await loadCatalogue();
                      }, success)
                    }
                  />
                </Panel>
              ))}
              <div className="flex justify-between">
                <button
                  disabled={cataloguePage === 1 || busy}
                  className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
                  onClick={() => setCataloguePage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={!nextCatalogue || busy}
                  className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
                  onClick={() =>
                    nextCatalogue && setCataloguePage(nextCatalogue)
                  }
                >
                  Next
                </button>
              </div>
            </div>
          ) : section === "prescriptions" ? (
            <Panel>
              <PanelHeader
                title="Prescription requests"
                description="Requests from issued Sabi prescriptions appear here. Clinical review and quotation require a verified pharmacist."
              />
              <div className="divide-y">
                {requests.map((request) => (
                  <article key={request.id} className="p-5">
                    <StatusPill status={request.status} />
                    <p className="mt-2 text-sm [overflow-wrap:anywhere]">
                      Prescription {request.prescriptionId}
                    </p>
                    <p className="mt-2 text-sm text-[#5b766a]">
                      {request.quotes.length} quote revisions · received{" "}
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </article>
                ))}
                {!requests.length && (
                  <p className="p-5 text-sm text-[#5b766a]">
                    No prescription requests received yet.
                  </p>
                )}
              </div>
            </Panel>
          ) : section === "orders" ? (
            <Panel>
              <PanelHeader
                title="Pharmacy order fulfilments"
                description="Payment state and commissions are calculated by the server."
              />
              <div className="divide-y">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="flex flex-wrap justify-between gap-4 p-5"
                  >
                    <div>
                      <h2 className="font-semibold">{order.order.reference}</h2>
                      <p className="mt-1 text-sm">
                        {money(order.totalMinor)} · {order.fulfilmentMethod}
                      </p>
                      <p className="mt-1 text-sm text-[#5b766a]">
                        Payment: {order.order.status} · Commission:{" "}
                        {order.commissionMinor === null
                          ? "Legacy order"
                          : money(order.commissionMinor)}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                    {order.fulfilmentMethod === 'DELIVERY' && order.order.status === 'PAID' && ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) && <DeliveryHandover fulfilmentId={order.id} status={order.status} />}
                  </article>
                ))}
                {!orders.length && (
                  <p className="p-5 text-sm text-[#5b766a]">No orders yet.</p>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <PanelHeader title="Pharmacy team" />
              <div className="p-5">
                {membership && pharmacy.complianceStatus === "VERIFIED" ? (
                  <>
                    <form
                      className="mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const email = new FormData(form).get("email");
                        run(async () => {
                          await writeLive(
                            "/api/v1/pharmacy-portal/pharmacists/invite",
                            { email },
                          );
                          form.reset();
                        }, "Pharmacist invitation created. They can sign in to Sabi Pharmacy with their existing Sabi ID and accept the membership.");
                      }}
                    >
                      <label className="block text-sm font-semibold">
                        Verified pharmacist’s email
                        <input
                          required
                          type="email"
                          name="email"
                          className={input}
                        />
                      </label>
                      <button disabled={busy} className={`${button} self-end`}>
                        Invite pharmacist
                      </button>
                      <p className="text-sm text-[#5b766a] sm:col-span-2">
                        Clinical access requires a separately verified
                        pharmacist account. General pharmacy staff invitations
                        below do not grant dispensing permissions.
                      </p>
                    </form>
                    <InvitationManager
                      organizationId={membership.organization.id}
                      title="Invite pharmacy staff"
                    />
                  </>
                ) : (
                  <p className="text-sm text-[#5b766a]">
                    Team invitations become available after pharmacy approval.
                  </p>
                )}
              </div>
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}
