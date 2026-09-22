import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useSabiHealth, getVerificationBlockers } from "../../useSabiHealth";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { cn } from "@/lib/cn";
import type { NetworkVerificationStatus } from "../../sabihealth/domain";
import {
  BackLink, CommandButton, CommandPageHeader, Field, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

const TABS = ["Overview", "Verification", "Audit"];

export default function LaboratoryDetail() {
  const { laboratoryId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "Overview";
  const state = useSabiHealth();
  const actorId = useAuth((s) => s.identity?.platformUserId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const laboratory = state.laboratories.find((item) => item.id === laboratoryId);

  if (!laboratory) return <NotFound label="Laboratory not found" backTo="/command-center/sabi-health/laboratories" backLabel="Back to laboratories" />;

  const selectTab = (tab: string) => setSearchParams(tab === "Overview" ? {} : { tab });
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Laboratory" && e.resourceId === laboratoryId);

  const transition = (status: NetworkVerificationStatus, description: string, danger = false) => setPending({
    title: `Set ${laboratory.name} to ${status.replaceAll("_", " ")}`,
    description,
    confirm: status.replaceAll("_", " "),
    danger,
    onConfirm: (reason) => { const result = state.setLaboratoryStatus(laboratoryId, status, reason, actorId); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/laboratories" label="Laboratories" />
    <CommandPageHeader eyebrow={laboratory.legalEntity} title={laboratory.name} description={`${laboratory.city}, ${laboratory.country} · License ${laboratory.licenseNumber} · Joined ${formatDate(laboratory.joinedAt)}`} actions={<>
      <StatusPill status={laboratory.status.replaceAll("_", " ")} />
      {(laboratory.status === "APPLICATION" || laboratory.status === "PENDING_VERIFICATION") && (
        <CommandButton onClick={() => navigate(`/command-center/sabi-health/verification/${laboratoryId}`)}><ClipboardCheck size={15} />Review verification case</CommandButton>
      )}
      {laboratory.status === "VERIFIED" && <CommandButton onClick={() => transition("ACTIVE", "Activates the laboratory to receive referrals on the network.")}>Activate</CommandButton>}
      {laboratory.status === "ACTIVE" && <CommandButton variant="danger" onClick={() => transition("SUSPENDED", "Immediately stops new referrals from routing to this laboratory.", true)}>Suspend</CommandButton>}
      {laboratory.status === "SUSPENDED" && <CommandButton variant="secondary" onClick={() => transition("ACTIVE", "Restores the laboratory to active referral routing.")}>Restore</CommandButton>}
    </>} />

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
      <Summary label="Services" value={laboratory.services.length === 0 ? "Not tracked" : laboratory.services.join(", ")} />
      <Summary label="License expiry" value={formatDate(laboratory.licenseExpiresAt)} />
      <Summary label="Joined" value={formatDate(laboratory.joinedAt)} />
    </div>

    <div className="mb-4 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"><div role="tablist" aria-label="Laboratory sections" className="flex min-w-max gap-1">{TABS.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => selectTab(tab)} className={cn("border-b-2 px-3 py-2.5 text-xs font-semibold transition", activeTab === tab ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab}</button>)}</div></div>

    {activeTab === "Overview" && (
      <Panel><PanelHeader title="Laboratory profile" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Legal entity" value={laboratory.legalEntity} /><Field label="License number" value={laboratory.licenseNumber} /><Field label="Location" value={`${laboratory.city}, ${laboratory.country}`} /><Field label="Services" value={laboratory.services.length === 0 ? "Not tracked" : laboratory.services.join(", ")} /><Field label="Joined" value={formatDate(laboratory.joinedAt)} /><Field label="License expiry" value={formatDate(laboratory.licenseExpiresAt)} /></div></Panel>
    )}
    {activeTab === "Verification" && (() => {
      const documents = state.verificationDocuments.filter((doc) => doc.subjectType === "Laboratory" && doc.subjectId === laboratoryId);
      const blockers = getVerificationBlockers(state.verificationDocuments, "Laboratory", laboratoryId);
      return <Panel><PanelHeader title="Verification status" description="Document-backed review — open the verification case to decide individual documents" action={<CommandButton variant="secondary" onClick={() => navigate(`/command-center/sabi-health/verification/${laboratoryId}`)}><ClipboardCheck size={14} />Open case</CommandButton>} />
        <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Current status" value={<StatusPill status={laboratory.status.replaceAll("_", " ")} />} /><Field label="Documents verified" value={`${documents.filter((d) => d.status === "VERIFIED").length} / ${documents.length}`} /><Field label="License number" value={laboratory.licenseNumber} /><Field label="License expiry" value={formatDate(laboratory.licenseExpiresAt)} /><Field label="Legal entity" value={laboratory.legalEntity} /></div>
        {blockers.length > 0 && <div className="border-t border-slate-100 p-4"><p className="mb-2 text-xs font-bold text-amber-800">Outstanding before approval</p><ul className="space-y-1 text-xs leading-5 text-amber-800">{blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div>}
      </Panel>;
    })()}
    {activeTab === "Audit" && (
      <Panel><PanelHeader title="Audit log" description="Every Command Center action taken on this laboratory" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No Command Center actions recorded for this laboratory yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
    )}

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
