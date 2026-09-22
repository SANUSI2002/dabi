import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useSabiHealth, getVerificationBlockers } from "../../useSabiHealth";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { cn } from "@/lib/cn";
import type { NetworkVerificationStatus } from "../../sabihealth/domain";
import {
  BackLink, CommandButton, CommandPageHeader, Field, Mini, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

const TABS = ["Overview", "Verification", "Orders", "Audit"];

export default function PharmacyDetail() {
  const { pharmacyId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "Overview";
  const state = useSabiHealth();
  const actorId = useAuth((s) => s.identity?.platformUserId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const pharmacy = state.pharmacies.find((item) => item.id === pharmacyId);

  if (!pharmacy) return <NotFound label="Pharmacy not found" backTo="/command-center/sabi-health/pharmacies" backLabel="Back to pharmacies" />;

  const selectTab = (tab: string) => setSearchParams(tab === "Overview" ? {} : { tab });
  const orders = state.medicationOrders.filter((o) => o.pharmacyId === pharmacyId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Pharmacy" && e.resourceId === pharmacyId);

  const transition = (status: NetworkVerificationStatus, description: string, danger = false) => setPending({
    title: `Set ${pharmacy.businessName} to ${status.replaceAll("_", " ")}`,
    description,
    confirm: status.replaceAll("_", " "),
    danger,
    onConfirm: (reason) => { const result = state.setPharmacyStatus(pharmacyId, status, reason, actorId); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/pharmacies" label="Pharmacies" />
    <CommandPageHeader eyebrow={pharmacy.legalEntity} title={pharmacy.businessName} description={`${pharmacy.city}, ${pharmacy.country} · License ${pharmacy.licenseNumber} · Joined ${formatDate(pharmacy.joinedAt)}`} actions={<>
      <StatusPill status={pharmacy.status.replaceAll("_", " ")} />
      {(pharmacy.status === "APPLICATION" || pharmacy.status === "PENDING_VERIFICATION") && (
        <CommandButton onClick={() => navigate(`/command-center/sabi-health/verification/${pharmacyId}`)}><ClipboardCheck size={15} />Review verification case</CommandButton>
      )}
      {pharmacy.status === "VERIFIED" && <CommandButton onClick={() => transition("ACTIVE", "Activates the pharmacy to receive orders on the network.")}>Activate</CommandButton>}
      {pharmacy.status === "ACTIVE" && <CommandButton variant="danger" onClick={() => transition("SUSPENDED", "Immediately stops new orders from routing to this pharmacy.", true)}>Suspend</CommandButton>}
      {pharmacy.status === "SUSPENDED" && <CommandButton variant="secondary" onClick={() => transition("ACTIVE", "Restores the pharmacy to active order routing.")}>Restore</CommandButton>}
    </>} />

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Coverage radius" value={`${pharmacy.coverageRadiusKm} km`} />
      <Summary label="Active orders" value={pharmacy.activeOrderCount} />
      <Summary label="Fulfilled orders" value={pharmacy.fulfilledOrderCount} />
      <Summary label="License expiry" value={formatDate(pharmacy.licenseExpiresAt)} />
    </div>

    <div className="mb-4 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"><div role="tablist" aria-label="Pharmacy sections" className="flex min-w-max gap-1">{TABS.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => selectTab(tab)} className={cn("border-b-2 px-3 py-2.5 text-xs font-semibold transition", activeTab === tab ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab}</button>)}</div></div>

    {activeTab === "Overview" && (
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <Panel><PanelHeader title="Pharmacy profile" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Legal entity" value={pharmacy.legalEntity} /><Field label="License number" value={pharmacy.licenseNumber} /><Field label="Location" value={`${pharmacy.city}, ${pharmacy.country}`} /><Field label="Coverage radius" value={`${pharmacy.coverageRadiusKm} km`} /><Field label="Joined" value={formatDate(pharmacy.joinedAt)} /><Field label="License expiry" value={formatDate(pharmacy.licenseExpiresAt)} /></div></Panel>
        <Panel><PanelHeader title="Order volume" /><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:divide-y-0"><Mini label="Active" value={pharmacy.activeOrderCount} /><Mini label="Fulfilled" value={pharmacy.fulfilledOrderCount} /></div></Panel>
      </div>
    )}
    {activeTab === "Verification" && (() => {
      const documents = state.verificationDocuments.filter((doc) => doc.subjectType === "Pharmacy" && doc.subjectId === pharmacyId);
      const blockers = getVerificationBlockers(state.verificationDocuments, "Pharmacy", pharmacyId);
      return <Panel><PanelHeader title="Verification status" description="Document-backed review — open the verification case to decide individual documents" action={<CommandButton variant="secondary" onClick={() => navigate(`/command-center/sabi-health/verification/${pharmacyId}`)}><ClipboardCheck size={14} />Open case</CommandButton>} />
        <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Current status" value={<StatusPill status={pharmacy.status.replaceAll("_", " ")} />} /><Field label="Documents verified" value={`${documents.filter((d) => d.status === "VERIFIED").length} / ${documents.length}`} /><Field label="License number" value={pharmacy.licenseNumber} /><Field label="License expiry" value={formatDate(pharmacy.licenseExpiresAt)} /><Field label="Legal entity" value={pharmacy.legalEntity} /></div>
        {blockers.length > 0 && <div className="border-t border-slate-100 p-4"><p className="mb-2 text-xs font-bold text-amber-800">Outstanding before approval</p><ul className="space-y-1 text-xs leading-5 text-amber-800">{blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div>}
      </Panel>;
    })()}
    {activeTab === "Orders" && (
      <Panel><PanelHeader title="Medication orders" /><div className="overflow-x-auto">{orders.length === 0 ? <p className="p-4 text-sm text-slate-500">No orders recorded for this pharmacy.</p> : <table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Order</th><th className="cc-th">Status</th><th className="cc-th">Total</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id} className="border-b border-slate-100 last:border-0"><td className="cc-td font-mono text-xs">{o.id}</td><td className="cc-td"><StatusPill status={o.status.replaceAll("_", " ")} /></td><td className="cc-td">{o.currency} {o.total.toLocaleString()}</td></tr>)}</tbody></table>}</div></Panel>
    )}
    {activeTab === "Audit" && (
      <Panel><PanelHeader title="Audit log" description="Every Command Center action taken on this pharmacy" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No Command Center actions recorded for this pharmacy yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
    )}

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
