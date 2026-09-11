import { useState } from "react";
import { RefreshCw, CheckCircle2, Cloud, Loader2 } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { useAudit } from "@/store/useAudit";
import { timeAgo } from "@/lib/format";

export default function NhmisSync() {
  const emr = useEmr();
  const log = useAudit((s) => s.log);
  const [state, setState] = useState<"idle" | "syncing" | "done">("idle");
  const [lastSync, setLastSync] = useState(new Date(Date.now() - 6 * 3600e3).toISOString());

  // Record counts are drawn only from what this EMR actually holds — no
  // dataset here is padded with an invented baseline. A dataset this build
  // has no real source for is marked unavailable rather than given a number.
  const DATASETS: { name: string; records: number | null; target: string }[] = [
    { name: "OPD Morbidity (weekly)", records: emr.encounters.length, target: "DHIS2 · NHMIS_OPD" },
    { name: "Immunization (monthly)", records: emr.immunizations.length, target: "DHIS2 · NHMIS_EPI" },
    { name: "Maternal Health (monthly)", records: emr.ancRecords.length + emr.deliveries.length + emr.pncVisits.length, target: "DHIS2 · NHMIS_MNCH" },
    { name: "Birth Notifications (monthly)", records: emr.birthRegister.length, target: "NPopC · e-Birth" },
    { name: "IDSR Notifiable (weekly)", records: emr.surveillanceCases.length, target: "SORMAS · IDSR_WK" },
    { name: "Commodity / LMIS (monthly)", records: null, target: "NHLMIS" },
    { name: "Family Planning (monthly)", records: emr.fpClients.length, target: "DHIS2 · NHMIS_FP" },
    { name: "Referrals (monthly)", records: emr.referrals.length, target: "DHIS2 · NHMIS_REF" },
    { name: "Patient Transfers (monthly)", records: emr.transfers.filter((t) => t.status !== "Cancelled").length, target: "DHIS2 · NHMIS_MOV" },
  ];
  const available = DATASETS.filter((dataset) => dataset.records !== null);
  const endpoints = new Set(DATASETS.map((dataset) => dataset.target.split(" · ")[0])).size;

  function run() {
    setState("syncing");
    setTimeout(() => {
      setState("done");
      setLastSync(new Date().toISOString());
      log("synced NHMIS", "nhmis/dhis2");
    }, 1800);
  }

  return (
    <div>
      <PageHeader
        title="NHMIS Sync"
        subtitle={`Push aggregated data to national platforms · last synced ${timeAgo(lastSync)}`}
        actions={
          <Button onClick={run} disabled={state === "syncing"}>
            {state === "syncing" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {state === "syncing" ? "Syncing…" : "Sync Now"}
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Datasets" value={DATASETS.length} tone="brand" icon={<Cloud size={18} />} />
        <StatCard label="Records Queued" value={available.reduce((n, d) => n + (d.records ?? 0), 0)} tone="mist" delay={0.05} />
        <StatCard label="Endpoints" value={endpoints} tone="mist" delay={0.1} />
        <StatCard label="Status" value={state === "done" ? "Up to date" : "Pending"} tone={state === "done" ? "brand" : "action"} delay={0.15} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DATASETS.map((d, i) => (
          <Reveal key={d.name} delay={i * 0.05}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-mist-900">{d.name}</p>
                <p className="text-[11px] text-mist-400">
                  {d.target} · {d.records === null ? "not tracked in this build" : `${d.records} records`}
                </p>
              </div>
              {d.records === null ? (
                <Badge tone="mist">Unavailable</Badge>
              ) : state === "done" ? (
                <Badge tone="brand"><CheckCircle2 size={12} /> Synced</Badge>
              ) : state === "syncing" ? (
                <Loader2 size={16} className="animate-spin text-brand-500" />
              ) : (
                <Badge tone="amber">Queued</Badge>
              )}
            </Card>
          </Reveal>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-mist-300">
        Frontend simulation — no live DHIS2/SORMAS connection is configured. Counts reflect only what is recorded in this EMR; sync events are written to the audit log.
      </p>
    </div>
  );
}
