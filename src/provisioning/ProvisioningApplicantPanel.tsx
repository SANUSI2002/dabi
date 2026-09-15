import { useEffect } from "react";
import { Building2, CheckCircle2, Clock3, ServerCog } from "lucide-react";
import type { OrganizationApplication } from "@/registration/domain";
import { useCommercialOnboarding } from "@/commercial/useCommercialOnboarding";
import { useTenantProvisioning } from "./useTenantProvisioning";

export function ProvisioningApplicantPanel({ application }: { application: OrganizationApplication }) {
  const agreements = useCommercialOnboarding((state) => state.opportunities);
  const jobs = useTenantProvisioning((state) => state.jobs);
  const syncActiveAgreements = useTenantProvisioning((state) => state.syncActiveAgreements);
  const agreement = agreements.find((item) => item.applicationId === application.id);
  const job = jobs.find((item) => item.applicationId === application.id);
  useEffect(() => { if (agreement?.status === "ACTIVE") syncActiveAgreements(); }, [agreement?.status, syncActiveAgreements]);
  if (!agreement || !["ACTIVE"].includes(agreement.status)) return null;
  return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-emerald-300"><ServerCog size={18}/></span><div><h2 className="font-display text-lg font-bold text-slate-900">Tenant provisioning</h2><p className="mt-1 text-sm leading-6 text-slate-500">Your commercial agreement is active. Tenant setup remains isolated from clinical access.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Stage icon={<Clock3 size={16}/>} label="Queued" active={!!job}/><Stage icon={<Building2 size={16}/>} label="Configuring" active={job?.status === "PROVISIONING" || job?.status === "CONFIGURING"}/><Stage icon={<CheckCircle2 size={16}/>} label="Ready for setup" active={job?.status === "READY"}/></div>{job && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">Current status: {job.status.replaceAll("_", " ")}</p>}{!job && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Awaiting entry into the controlled provisioning queue.</p>}</section>;
}

function Stage({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) { return <div className={`flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-400"}`}>{icon}{label}</div>; }
