import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileDown, Printer, BarChart3 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { shortDate, isoDate } from "@/lib/format";
import { useEmr } from "@/store/useEmr";
import { useAssets } from "@/store/useAssets";
import { useWards } from "@/store/useWards";
import { useAudit } from "@/store/useAudit";
import { REPORTS } from "./reports/config";
import { ReportView } from "./reports/ReportView";
import type { EmrSnapshot } from "./reports/types";
import { DATE_PRESETS, resolveRange, scopeSnapshot, type DatePreset } from "./reports/dateScope";

export default function Reports() {
  const emr = useEmr();
  const assets = useAssets((s) => s.assets);
  const maintenanceJobs = useAssets((s) => s.jobs);
  const wards = useWards((s) => s.wards);
  const beds = useWards((s) => s.beds);
  const snap: EmrSnapshot = useMemo(() => ({
    patients: emr.patients, queue: emr.queue, encounters: emr.encounters, labOrders: emr.labOrders,
    admissions: emr.admissions, appointments: emr.appointments, referrals: emr.referrals, transfers: emr.transfers,
    ancRecords: emr.ancRecords, fpClients: emr.fpClients, childVisits: emr.childVisits,
    deliveries: emr.deliveries, birthRegister: emr.birthRegister, immunizations: emr.immunizations, pncVisits: emr.pncVisits, cmamScreenings: emr.cmamScreenings,
    outreachActivities: emr.outreachActivities, surveillanceCases: emr.surveillanceCases,
    ncdClients: emr.ncdClients, patientById: emr.patientById,
    assets, maintenanceJobs, wards, beds,
  }), [emr, assets, maintenanceJobs, wards, beds]);

  const [familyName, setFamilyName] = useState(REPORTS[14].name); // Service Performance
  const [preset, setPreset] = useState<DatePreset>("This month");
  const [customFrom, setCustomFrom] = useState(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const scopedSnap = useMemo(() => scopeSnapshot(snap, range), [snap, range]);
  const family = useMemo(() => REPORTS.find((f) => f.name === familyName)!, [familyName]);
  const [tabName, setTabName] = useState(family.tabs[0].name);
  const tab = family.tabs.find((t) => t.name === tabName) ?? family.tabs[0];
  const log = useAudit((s) => s.log);

  useEffect(() => {
    log("viewed report", `report/${familyName.toLowerCase().replace(/[^a-z]+/g, "-")}`);
  }, [familyName, log]);

  function pick(name: string) {
    setFamilyName(name);
    setTabName(REPORTS.find((f) => f.name === name)!.tabs[0].name);
  }
  function exportAs(fmt: string) {
    log("exported report", `report/${familyName.toLowerCase().replace(/[^a-z]+/g, "-")}.${fmt}`);
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Computed from recorded EMR activity · NHMIS-style layout · not connected to DHIS2"
        actions={
          <>
            <button className="btn-ghost text-xs" onClick={() => exportAs("csv")}><FileDown size={13} /> CSV</button>
            <button className="btn-ghost text-xs" onClick={() => exportAs("xlsx")}><FileDown size={13} /> Excel</button>
            <button className="btn-ghost text-xs" onClick={() => { exportAs("pdf"); window.print(); }}><Printer size={13} /> Print</button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[236px_1fr]">
        <div className="card h-fit p-2 lg:sticky lg:top-20">
          {REPORTS.map((f) => (
            <button
              key={f.name}
              onClick={() => pick(f.name)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition",
                familyName === f.name ? "bg-brand-gradient text-white shadow-glow" : "text-mist-600 hover:bg-mist-50",
              )}
            >
              <BarChart3 size={14} className="shrink-0" /> <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={cn("chip", preset === p ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200")}
                >
                  {p}
                </button>
              ))}
            </div>
            {preset === "Custom" && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Field label="From"><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
                <Field label="To"><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
              </div>
            )}
            <p className="mt-2 text-[11px] text-mist-400">
              Applies to dated activity — encounters, orders, admissions, deliveries, referrals, and similar events. The NCD,
              Family Planning, and ANC registers, and asset/ward data, always reflect current state rather than the period above.
            </p>
          </div>

          <motion.div key={familyName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="mb-4 font-display text-lg font-bold text-mist-900">Reports · {family.name}</h2>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {family.stats(scopedSnap).map((st, i) => (
                <StatCard key={st.label} label={st.label} value={st.value} tone={st.tone ?? "mist"} delay={i * 0.04} />
              ))}
            </div>

            <div className="mb-4 flex flex-wrap gap-1 border-b border-mist-200">
              {family.tabs.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTabName(t.name)}
                  className={cn(
                    "relative px-3 py-2.5 text-[13px] font-semibold transition-colors",
                    tabName === t.name ? "text-brand-700" : "text-mist-400 hover:text-mist-600",
                  )}
                >
                  {t.name}
                  {tabName === t.name && (
                    <motion.span layoutId="rpt-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient" />
                  )}
                </button>
              ))}
            </div>

            <div>
              <ReportView tab={tab} snap={scopedSnap} />
            </div>

            <p className="mt-4 text-center text-[11px] text-mist-300">
              {family.name} · {tab.name} · {shortDate(range.from)} – {shortDate(range.to)} · generated {new Date().toLocaleString("en-NG")}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
