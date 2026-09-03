import { PageHeader, StatCard, Card, Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function Malaria() {
  const { encounters, patientById } = useEmr();
  const malariaEnc = encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria")));
  const tested = encounters.filter((e) => e.labs.some((l) => l.toLowerCase().includes("malaria"))).length;

  const trend = [
    { m: "Wk 1", tested: 22, positive: 14 },
    { m: "Wk 2", tested: 31, positive: 19 },
    { m: "Wk 3", tested: 27, positive: 16 },
    { m: "Wk 4", tested: 35, positive: 24 },
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
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={trend}>
                      <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip cursor={{ fill: "rgba(15,192,109,0.06)" }} />
                      <Bar dataKey="tested" fill="#9ff9cb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="positive" fill="#0fc06d" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-mist-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-200" /> Tested</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-500" /> Positive</span>
                </div>
              </Card>
            </Reveal>
          )
        }
      </Tabs>
    </div>
  );
}
