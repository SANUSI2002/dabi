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
import { useIsLiveEmr } from "@/emr-live/session";
import { useLiveMalariaLoad, useLiveProgrammes } from "@/emr-live/programmes";

const ANTIMALARIAL_NAMES = ["artemether", "lumefantrine", "artesunate", "act "];

export default function Malaria() {
  const { encounters, labOrders, patientById } = useEmr();
  const live = useIsLiveEmr();
  useLiveMalariaLoad(live);
  const liveMalaria = useLiveProgrammes((st) => st.malaria);
  const liveError = useLiveProgrammes((st) => st.error);

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

  // Live: the hospital's own figures, worked out on the server from the recorded visits, results and prescriptions.
  const stats = live
    ? { suspected: liveMalaria?.suspected ?? 0, tested: liveMalaria?.tested ?? 0, confirmed: liveMalaria?.confirmed ?? 0, treated: liveMalaria?.treatedWithAct ?? 0 }
    : { suspected: suspectedEncounters.length, tested: malariaTests.length, confirmed: malariaEncounters.length, treated: treatedWithAct.length };
  const cases = live
    ? (liveMalaria?.cases ?? []).map((c) => ({ id: c.encounterId, patient: c.patient, date: c.diagnosedAt, diagnosis: c.diagnoses.join(", "), treatment: c.treatment[0] ?? "—" }))
    : malariaEncounters.map((e) => ({ id: e.id, patient: patientById(e.patientId), date: e.date, diagnosis: e.diagnoses.map((d) => d.name).join(", "), treatment: e.prescriptions[0]?.drug ?? "—" }));
  const trend = live
    ? (liveMalaria?.weeklyTrend ?? []).map((w) => ({ label: format(new Date(`${w.weekStart}T00:00:00`), "dd MMM"), tested: w.tested, positive: w.positive }))
    : weeklyTrend;

  return (
    <div>
      <PageHeader title="Malaria Programme" subtitle="Testing, treatment & NHMIS malaria indicators — figures below are drawn from recorded encounters and lab orders" />
      {live && liveError && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{liveError}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Suspected (fever/malaria)" value={stats.suspected} tone="brand" />
        <StatCard label="Tested (RDT/Micro)" value={stats.tested} tone="mist" delay={0.05} />
        <StatCard label="Confirmed" value={stats.confirmed} tone="action" delay={0.1} />
        <StatCard label="Treated with ACT" value={stats.treated} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Confirmed Cases", "Weekly Trend"]}>
        {(tab) =>
          tab === "Confirmed Cases" ? (
            <Table columns={["Patient", "Date", "Diagnosis", "Treatment"]} caption="Confirmed malaria cases">
              {cases.length === 0 && <EmptyRow colSpan={4}>No malaria diagnoses recorded yet.</EmptyRow>}
              {cases.map((c, index) => (
                <Row key={c.id} index={index}>
                  <Cell className="font-semibold"><PatientLink patient={c.patient} /></Cell>
                  <Cell>{shortDate(c.date)}</Cell>
                  <Cell>{c.diagnosis}</Cell>
                  <Cell>{c.treatment}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Reveal>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Weekly testing &amp; positivity</h3>
                {trend.length < 2 ? (
                  <SectionNote>Not enough weekly testing history yet to show a trend — this needs malaria test orders spanning at least two calendar weeks.</SectionNote>
                ) : (
                  <Bars
                    data={trend}
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
