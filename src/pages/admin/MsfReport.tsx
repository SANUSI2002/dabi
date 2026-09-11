import { useState } from "react";
import { FileSpreadsheet, Check, Send } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { useAudit } from "@/store/useAudit";

const SECTIONS = [
  { key: "OPD Attendance", fields: ["New attendances", "Re-attendances", "Referrals out", "Total visits"] },
  { key: "Maternal Health", fields: ["ANC 1st visits", "ANC 4+ visits", "Deliveries by SBA", "PNC within 48h", "Maternal deaths"] },
  { key: "Child Health & EPI", fields: ["BCG", "Penta 3", "Measles 1", "Fully immunized (1yr)", "Vitamin A"] },
  { key: "Family Planning", fields: ["New acceptors", "Revisits", "CYP delivered"] },
  { key: "Disease Burden", fields: ["Confirmed malaria", "Diarrhoea (<5)", "Pneumonia (<5)", "Suspected measles"] },
  { key: "Commodities", fields: ["ACT stock-out days", "ORS stock-out days", "Vaccine stock-out days"] },
];

export default function MsfReport() {
  const { encounters, ancRecords, deliveries, pncVisits, fpClients, referrals } = useEmr();
  const log = useAudit((s) => s.log);
  // Only fields this EMR actually has a source for are pre-filled; everything
  // else starts blank for the compiler to enter from paper/register counts —
  // never a placeholder number dressed up as a real figure.
  const [values, setValues] = useState<Record<string, number>>({
    "Referrals out": referrals.filter((r) => r.type === "Out").length,
    "Total visits": encounters.length,
    "Confirmed malaria": encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).length,
    "ANC 1st visits": ancRecords.length,
    "Deliveries by SBA": deliveries.length,
    "PNC within 48h": pncVisits.filter((v) => v.daysPP <= 2).length,
    "New acceptors": fpClients.filter((c) => c.firstTime).length,
    "Revisits": fpClients.filter((c) => !c.firstTime).length,
  });
  const [submitted, setSubmitted] = useState(false);

  const total = SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  const filled = Object.values(values).filter((v) => v > 0).length;
  const prefilled = new Set(Object.keys(values));

  return (
    <div>
      <PageHeader
        title="Monthly Summary Form (MSF)"
        subtitle={`Statutory NHMIS monthly return · ${new Date().toLocaleString("en", { month: "long", year: "numeric" })}`}
        actions={
          <Button
            variant={submitted ? "soft" : "primary"}
            disabled={submitted}
            onClick={() => { setSubmitted(true); log("submitted MSF return", "msf/monthly"); }}
          >
            {submitted ? <><Check size={15} /> Submitted</> : <><Send size={15} /> Submit to LGA</>}
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sections" value={SECTIONS.length} tone="brand" icon={<FileSpreadsheet size={18} />} />
        <StatCard label="Fields" value={total} tone="mist" delay={0.05} />
        <StatCard label="Completed" value={filled} tone="brand" delay={0.1} />
        <StatCard label="Status" value={submitted ? "Submitted" : "Draft"} tone={submitted ? "brand" : "action"} delay={0.15} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {SECTIONS.map((s, i) => (
          <Reveal key={s.key} delay={i * 0.05}>
            <Card>
              <h3 className="mb-3 font-display font-bold text-mist-900">{s.key}</h3>
              <div className="space-y-2">
                {s.fields.map((fld) => (
                  <div key={fld} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-mist-600">
                      {fld}
                      {prefilled.has(fld) ? (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-500">from EMR</span>
                      ) : (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-mist-300">manual entry</span>
                      )}
                    </span>
                    <input
                      type="number"
                      disabled={submitted}
                      value={values[fld] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [fld]: +e.target.value }))}
                      className="input w-24 py-1.5 text-right text-sm"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {submitted && (
        <div className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">
          <Badge tone="brand">Locked</Badge> Return submitted to Amuwo-Odofin LGA M&E. It will be picked up in the next NHMIS Sync.
        </div>
      )}
    </div>
  );
}
