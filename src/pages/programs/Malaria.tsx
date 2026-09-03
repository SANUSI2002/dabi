import { PageHeader, StatCard, Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Bars } from "@/components/ui/Chart";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";

export default function Malaria() {
  const { encounters, patientById } = useEmr();
  const malariaEnc = encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria")));
  const tested = encounters.filter((e) => e.labs.some((l) => l.toLowerCase().includes("malaria"))).length;

  const trend = [
    { label: "Wk 1", tested: 22, positive: 14 },
    { label: "Wk 2", tested: 31, positive: 19 },
    { label: "Wk 3", tested: 27, positive: 16 },
    { label: "Wk 4", tested: 35, positive: 24 },
  ];

  return (
    <div>
      <PageHeader title="Malaria Programme" subtitle="Testing, treatment & NHMIS malaria indicators" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Suspected (fever)" value={malariaEnc.length + 4} tone="brand" />
        <StatCard label="Tested (RDT/Micro)" value={tested + 3} tone="mist" delay={0.05} />
        <StatCard label="Confirmed" value={malariaEnc.length} tone="action" delay={0.1} />
        <StatCard label="Treated with ACT" value={malariaEnc.length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Confirmed Cases", "Weekly Trend"]}>
        {(t) =>
          t === "Confirmed Cases" ? (
            <Table columns={["Patient", "Date", "Diagnosis", "Treatment"]}>
              {malariaEnc.map((e, i) => {
                const p = patientById(e.patientId);
                return (
                  <Row key={e.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{shortDate(e.date)}</Cell>
                    <Cell>{e.diagnoses.map((d) => d.name).join(", ")}</Cell>
                    <Cell>{e.prescriptions[0]?.drug ?? "—"}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Reveal>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Weekly testing &amp; positivity</h3>
                <Bars
                  data={trend}
                  x="label"
                  series={[
                    { key: "tested", label: "Tested", color: "#9ff9cb" },
                    { key: "positive", label: "Positive", color: "#0fc06d" },
                  ]}
                />
              </Card>
            </Reveal>
          )
        }
      </Tabs>
    </div>
  );
}
