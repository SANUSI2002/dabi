import { Download, Cloud } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";

export default function NhmisSync() {
  const emr = useEmr();

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

  function downloadSummary() {
    const rows = [["Dataset", "Destination", "Local record count", "Connection status"], ...DATASETS.map((dataset) => [dataset.name, dataset.target, dataset.records === null ? "Unavailable" : String(dataset.records), "Not connected"])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sabi-emr-nhmis-local-summary.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div>
      <PageHeader
        title="NHMIS Sync"
        subtitle="Local dataset preview only · no national-platform connection"
        actions={
          <Button onClick={downloadSummary}><Download size={15} /> Download summary CSV</Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Datasets" value={DATASETS.length} tone="brand" icon={<Cloud size={18} />} />
        <StatCard label="Local records" value={available.reduce((n, d) => n + (d.records ?? 0), 0)} tone="mist" delay={0.05} />
        <StatCard label="Named destinations" value={endpoints} tone="mist" delay={0.1} />
        <StatCard label="Connection" value="Not connected" tone="amber" delay={0.15} />
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
              <Badge tone={d.records === null ? "mist" : "amber"}>{d.records === null ? "Unavailable" : "Local only"}</Badge>
            </Card>
          </Reveal>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-mist-300">
        No data is sent to DHIS2, SORMAS or another national platform. This CSV contains aggregate counts only and is not evidence of a submission.
      </p>
    </div>
  );
}
