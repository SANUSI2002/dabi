import { useMemo } from "react";
import { PageHeader, StatCard, Card, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { PatientLink } from "@/components/ui/PatientLink";
import { Bars } from "@/components/ui/Chart";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import { startOfISOWeek, format } from "date-fns";

const ANTIMALARIAL_NAMES = ["artemether", "lumefantrine", "artesunate", "act "];

export default function Malaria() {
  const { encounters, labOrders, patientById } = useEmr();

  const malariaEncounters = encounters.filter((encounter) => encounter.diagnoses.some((diagnosis) => diagnosis.name.toLowerCase().includes("malaria")));
  const suspectedEncounters = encounters.filter(
    (encounter) => encounter.complaint.toLowerCase().includes("fever") || encounter.diagnoses.some((diagnosis) => diagnosis.name.toLowerCase().includes("malaria")),
  );
  const malariaTests = labOrders.filter((order) => order.test.toLowerCase().includes("malaria"));
  const treatedWithAct = malariaEncounters.filter((encounter) =>
    encounter.prescriptions.some((prescription) => ANTIMALARIAL_NAMES.some((name) => prescription.drug.toLowerCase().includes(name))),
  );

  const weeklyTrend = useMemo(() => {
    const byWeek = new Map<string, { label: string; tested: number; positive: number }>();
    for (const order of malariaTests) {
      const weekStart = startOfISOWeek(new Date(order.orderedAt));
      const key = format(weekStart, "yyyy-'W'II");
      const entry = byWeek.get(key) ?? { label: format(weekStart, "dd MMM"), tested: 0, positive: 0 };
      entry.tested += 1;
      if (order.result && /positive|present/i.test(order.result)) entry.positive += 1;
      byWeek.set(key, entry);
    }
    return [...byWeek.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([, value]) => value);
  }, [malariaTests]);

  return (
    <div>
      <PageHeader title="Malaria Programme" subtitle="Testing, treatment & NHMIS malaria indicators — figures below are drawn from recorded encounters and lab orders" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Suspected (fever/malaria)" value={suspectedEncounters.length} tone="brand" />
        <StatCard label="Tested (RDT/Micro)" value={malariaTests.length} tone="mist" delay={0.05} />
        <StatCard label="Confirmed" value={malariaEncounters.length} tone="action" delay={0.1} />
        <StatCard label="Treated with ACT" value={treatedWithAct.length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Confirmed Cases", "Weekly Trend"]}>
        {(tab) =>
          tab === "Confirmed Cases" ? (
            <Table columns={["Patient", "Date", "Diagnosis", "Treatment"]} caption="Confirmed malaria cases">
              {malariaEncounters.length === 0 && <EmptyRow colSpan={4}>No malaria diagnoses recorded yet.</EmptyRow>}
              {malariaEncounters.map((encounter, index) => {
                const patient = patientById(encounter.patientId);
                return (
                  <Row key={encounter.id} index={index}>
                    <Cell className="font-semibold"><PatientLink patient={patient} /></Cell>
                    <Cell>{shortDate(encounter.date)}</Cell>
                    <Cell>{encounter.diagnoses.map((diagnosis) => diagnosis.name).join(", ")}</Cell>
                    <Cell>{encounter.prescriptions[0]?.drug ?? "—"}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Reveal>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Weekly testing &amp; positivity</h3>
                {weeklyTrend.length < 2 ? (
                  <SectionNote>Not enough weekly testing history yet to show a trend — this needs malaria test orders spanning at least two calendar weeks.</SectionNote>
                ) : (
                  <Bars
                    data={weeklyTrend}
                    x="label"
                    series={[
                      { key: "tested", label: "Tested", color: "#9ff9cb" },
                      { key: "positive", label: "Positive", color: "#0fc06d" },
                    ]}
                  />
                )}
              </Card>
            </Reveal>
          )
        }
      </Tabs>
    </div>
  );
}
