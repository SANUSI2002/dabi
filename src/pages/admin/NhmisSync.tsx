import { useState } from "react";
import { RefreshCw, CheckCircle2, Cloud, Loader2 } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { timeAgo } from "@/lib/format";

const DATASETS = [
  { name: "OPD Morbidity (weekly)", records: 128, target: "DHIS2 · NHMIS_OPD" },
  { name: "Immunization (monthly)", records: 92, target: "DHIS2 · NHMIS_EPI" },
  { name: "Maternal Health (monthly)", records: 46, target: "DHIS2 · NHMIS_MNCH" },
  { name: "IDSR Notifiable (weekly)", records: 4, target: "SORMAS · IDSR_WK" },
  { name: "Commodity / LMIS (monthly)", records: 61, target: "NHLMIS" },
  { name: "Family Planning (monthly)", records: 12, target: "DHIS2 · NHMIS_FP" },
];

export default function NhmisSync() {
  const [state, setState] = useState<"idle" | "syncing" | "done">("idle");
  const [lastSync, setLastSync] = useState(new Date(Date.now() - 6 * 3600e3).toISOString());

  function run() {
    setState("syncing");
    setTimeout(() => {
      setState("done");
      setLastSync(new Date().toISOString());
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
        <StatCard label="Records Queued" value={DATASETS.reduce((n, d) => n + d.records, 0)} tone="mist" delay={0.05} />
        <StatCard label="Endpoints" value={4} tone="mist" delay={0.1} />
        <StatCard label="Status" value={state === "done" ? "Up to date" : "Pending"} tone={state === "done" ? "brand" : "action"} delay={0.15} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DATASETS.map((d, i) => (
          <Reveal key={d.name} delay={i * 0.05}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-mist-900">{d.name}</p>
                <p className="text-[11px] text-mist-400">{d.target} · {d.records} records</p>
              </div>
              {state === "done" ? (
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
        Transport: HTTPS · payloads signed · retries on failure · all sync events written to the audit log
      </p>
    </div>
  );
}
