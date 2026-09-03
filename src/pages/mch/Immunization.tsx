import { useState } from "react";
import { Syringe, Printer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { ImmunizationCardDoc } from "@/components/print/documents";
import { useEmr } from "@/store/useEmr";
import { VACCINES } from "@/data/catalog";
import { cn } from "@/lib/cn";
import { differenceInWeeks } from "date-fns";

export default function Immunization() {
  const { patients, patientById } = useEmr();
  const [pid, setPid] = useState<string | null>(patients.find((p) => p.category === "U5")?.id ?? null);
  const [given, setGiven] = useState<Record<string, string>>({});
  const [printCard, setPrintCard] = useState(false);
  const child = patientById(pid);
  const ageWeeks = child ? differenceInWeeks(new Date(), new Date(child.dob)) : 0;

  const schedule = VACCINES.map((v) => {
    const status = given[v.code]
      ? "Given"
      : ageWeeks >= v.ageWeeks + 4
        ? "Overdue"
        : ageWeeks >= v.ageWeeks
          ? "Due"
          : "Upcoming";
    return { ...v, status };
  });

  const dosesGiven = Object.keys(given).length;

  return (
    <div>
      <PageHeader title="Immunization" subtitle="Routine EPI schedule, defaulter tracking & AEFI" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Doses Given" value={dosesGiven} tone="brand" icon={<Syringe size={18} />} />
        <StatCard label="Antigens" value={new Set(Object.keys(given)).size} tone="mist" delay={0.05} />
        <StatCard label="Overdue" value={schedule.filter((s) => s.status === "Overdue").length} tone="action" delay={0.1} />
        <StatCard label="AEFI reported" value={0} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Give Vaccine", "Women (TD)", "AEFI"]}>
        {(t) =>
          t === "Give Vaccine" ? (
            <div className="space-y-4">
              <div className="card flex flex-wrap items-center gap-4">
                <div className="min-w-[280px] flex-1"><PatientPicker value={pid} onChange={setPid} placeholder="Search child…" /></div>
                {child && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-mist-400">Age: <b className="text-mist-700">{ageWeeks} weeks</b></span>
                    <Button variant="ghost" className="text-xs" onClick={() => setPrintCard(true)}>
                      <Printer size={13} /> Print Immunization Card
                    </Button>
                  </div>
                )}
              </div>

              {child && (
                <div className="card p-0">
                  <table className="w-full">
                    <thead className="border-b border-mist-200 bg-mist-50/60">
                      <tr>{["Vaccine", "Due age", "Dose", "Route / Site", "Status", ""].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-mist-100">
                      {schedule.map((v) => (
                        <tr key={v.code} className={cn(v.status === "Overdue" && "bg-action-50/40")}>
                          <td className="td font-medium">{v.name}<span className="block text-[11px] text-mist-400">{v.code}</span></td>
                          <td className="td">{v.ageLabel}</td>
                          <td className="td">{v.dose}</td>
                          <td className="td text-mist-500">{v.route} · {v.site}</td>
                          <td className="td">
                            <Badge tone={v.status === "Given" ? "brand" : v.status === "Overdue" ? "action" : v.status === "Due" ? "amber" : "mist"}>
                              {v.status}
                            </Badge>
                          </td>
                          <td className="td text-right">
                            {!given[v.code] && (v.status === "Due" || v.status === "Overdue") && (
                              <button
                                onClick={() => setGiven((g) => ({ ...g, [v.code]: new Date().toISOString() }))}
                                className="btn-primary px-2.5 py-1 text-xs"
                              >
                                Give
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : t === "Women (TD)" ? (
            <div className="card">
              <p className="mb-3 text-sm text-mist-500">Tetanus–Diphtheria (TD) immunization for pregnant & non-pregnant women (15–49 years). Schedule: TD1–TD5.</p>
              <div className="grid gap-2 sm:grid-cols-5">
                {["TD1", "TD2", "TD3", "TD4", "TD5"].map((d, i) => (
                  <div key={d} className="rounded-xl bg-mist-50 p-3 text-center text-sm ring-1 ring-mist-200">
                    <p className="font-bold text-mist-800">{d}</p>
                    <p className="text-[11px] text-mist-400">{["At contact", "+4 weeks", "+6 months", "+1 year", "+1 year"][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="text-sm text-mist-500">No Adverse Events Following Immunization (AEFI) recorded. Any reaction recorded during a "Give" action is logged here and flagged to Surveillance.</p>
            </div>
          )
        }
      </Tabs>

      {child && printCard && (
        <ImmunizationCardDoc patient={child} given={given} open onClose={() => setPrintCard(false)} />
      )}
    </div>
  );
}
