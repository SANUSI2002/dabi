import { useMemo, useState } from "react";
import { ArrowRight, Building2, Filter, Plus, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { useCommandCenter } from "../useCommandCenter";
import type { Organization } from "../domain";
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, StatusPill } from "../components/ui";
import { formatDate } from "../format";

const PAGE_SIZE = 8;

export default function Organizations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const command = useCommandCenter();
  const { organizations, subscriptions, packages } = command;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [plan, setPlan] = useState("All");
  const [country, setCountry] = useState("All");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState<Pick<Organization, "name" | "type" | "country" | "state" | "email" | "phone" | "domain">>({ name: "", type: "Hospital", country: "Nigeria", state: "", email: "", phone: "", domain: "" });

  const rows = useMemo(() => organizations.filter((org) => {
    const subscription = subscriptions.find((item) => item.organizationId === org.id);
    const packageName = packages.find((item) => item.id === subscription?.packageId)?.name ?? "No plan";
    const needle = `${org.name} ${org.tenantId} ${org.email} ${org.phone} ${org.domain}`.toLowerCase();
    return (!query || needle.includes(query.toLowerCase())) && (status === "All" || org.status === status) && (plan === "All" || packageName === plan) && (country === "All" || org.country === country);
  }), [country, organizations, packages, plan, query, status, subscriptions]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <div>
    <CommandPageHeader eyebrow="Customers" title="Organizations" description="Tenant lifecycle, subscription, adoption and license posture in one operational view." actions={<CommandButton onClick={() => setCreateOpen(true)}><Plus size={15} /> Create organization</CommandButton>} />
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
      {[{ label: "Total", value: organizations.length }, { label: "Active", value: organizations.filter((o) => o.status === "Active").length }, { label: "Trial", value: organizations.filter((o) => o.status === "Trial").length }, { label: "Restricted", value: organizations.filter((o) => ["Suspended", "Expired", "Grace Period", "Payment Due"].includes(o.status)).length }, { label: "Onboarding", value: organizations.filter((o) => o.status === "Onboarding").length }].map((stat) => <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stat.value}</p></div>)}
    </div>
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[240px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, tenant ID, email, phone or domain" /></div>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Filter size={14} /> Filters</span>
        <CommandSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All</option>{[...new Set(organizations.map((o) => o.status))].map((item) => <option key={item}>{item}</option>)}</CommandSelect>
        <CommandSelect value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }}><option>All</option>{packages.map((item) => <option key={item.id}>{item.name}</option>)}</CommandSelect>
        <CommandSelect value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }}><option>All</option>{[...new Set(organizations.map((o) => o.country))].map((item) => <option key={item}>{item}</option>)}</CommandSelect>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px]">
          <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th sticky left-0 z-10 bg-slate-50">Organization</th><th className="cc-th">Tenant ID</th><th className="cc-th">Type</th><th className="cc-th">Location</th><th className="cc-th">Primary contact</th><th className="cc-th">Plan</th><th className="cc-th">Billing cycle</th><th className="cc-th">Users</th><th className="cc-th">Products</th><th className="cc-th">License</th><th className="cc-th">Subscription</th><th className="cc-th">Onboarding</th><th className="cc-th">Created</th><th className="cc-th">Expires</th><th className="cc-th">Last activity</th><th className="cc-th"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{shown.map((org) => { const subscription = subscriptions.find((item) => item.organizationId === org.id); const pkg = packages.find((item) => item.id === subscription?.packageId); const products = new Set(subscription?.snapshotModuleIds.map((m) => m.split(".")[0]) ?? []); return <tr key={org.id} onClick={() => navigate(`/command-center/organizations/${org.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35"><td className="cc-td sticky left-0 bg-white group-hover:bg-emerald-50"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Building2 size={15} /></span><span><span className="block max-w-[220px] truncate font-semibold text-slate-900">{org.name}</span><span className="block text-xs text-slate-400">{org.domain}</span></span></div></td><td className="cc-td font-mono text-xs">{org.tenantId}</td><td className="cc-td">{org.type}</td><td className="cc-td">{org.state}, {org.country}</td><td className="cc-td"><span className="block font-medium">{org.primaryContact}</span><span className="block text-xs text-slate-400">{org.email}</span></td><td className="cc-td font-semibold">{pkg?.name ?? "Prospect"}</td><td className="cc-td">{subscription?.billingCycle ?? "—"}</td><td className="cc-td"><span className="font-semibold text-slate-900">{org.activeUsers}</span><span className="text-slate-400"> / {org.licensedUsers}</span></td><td className="cc-td">{products.size}</td><td className="cc-td"><StatusPill status={org.expirationDate && new Date(org.expirationDate) < new Date("2026-09-14") ? "Expired" : org.status === "Payment Due" ? "Expiring Soon" : org.status === "Suspended" ? "Suspended" : "Active"} /></td><td className="cc-td"><StatusPill status={subscription?.status ?? "Prospect"} /></td><td className="cc-td"><StatusPill status={org.onboardingStatus} /></td><td className="cc-td">{formatDate(org.createdDate)}</td><td className="cc-td">{formatDate(org.expirationDate)}</td><td className="cc-td">{formatDate(org.lastActivityAt)}</td><td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td></tr>; })}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Showing {shown.length} of {rows.length} organizations</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Previous</button>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md font-semibold ${page === i + 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{i + 1}</button>)}<button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Next</button></div></div>
    </Panel>
    <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(""); }} title="Create organization" footer={<><CommandButton variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</CommandButton><CommandButton onClick={() => { try { const id = command.createOrganization(draft); setCreateOpen(false); navigate(`/command-center/organizations/${id}`); } catch (cause) { setCreateError(cause instanceof Error ? cause.message : "Unable to create organization."); } }}>Create prospect</CommandButton></>}>
      <p className="mb-4 text-sm leading-5 text-slate-500">Create the tenant shell first. Subscription, KYC, documents and entitlements are assigned during onboarding.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="cc-label">Organization name</span><CommandInput autoFocus className="w-full" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></label>
        <label><span className="cc-label">Organization type</span><CommandSelect className="w-full" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as typeof d.type }))}>{["Clinic", "Hospital", "Hospital Group", "Diagnostic Centre", "Pharmacy"].map((x) => <option key={x}>{x}</option>)}</CommandSelect></label>
        <label><span className="cc-label">Country</span><CommandInput className="w-full" value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} /></label>
        <label><span className="cc-label">State / region</span><CommandInput className="w-full" value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} /></label>
        <label><span className="cc-label">Primary email</span><CommandInput type="email" className="w-full" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></label>
        <label><span className="cc-label">Phone</span><CommandInput className="w-full" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></label>
        <label><span className="cc-label">Tenant domain</span><CommandInput className="w-full" placeholder="hospital.sabios.com" value={draft.domain} onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))} /></label>
      </div>
      {createError && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{createError}</p>}
    </Modal>
  </div>;
}
