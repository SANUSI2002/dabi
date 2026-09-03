import { useState } from "react";
import { motion } from "framer-motion";
import { FileDown, Printer, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import {
  patientFlow, utilization, topDiagnoses, monthlyTargets,
} from "@/data/mock";

const FAMILIES = [
  "OPD Reports", "Maternal Health", "Child Health", "Nutrition (CMAM)", "Immunization",
  "Malaria", "Laboratory", "Pharmacy / Drugs", "NCDs", "Family Planning", "Inpatient",
  "Referrals", "Community Outreach", "Surveillance", "Service Performance", "Patient Transfers",
  "Patient EMR", "Diagnosis Report", "Inventory & Assets", "DHIS / Statutory", "Compliance — NDPR",
];

const PRESETS = ["Today", "Last 7 days", "Last 30 days", "This month", "This quarter", "This year", "Custom"];

export default function Reports() {
  const [family, setFamily] = useState("Service Performance");
  const [preset, setPreset] = useState("This month");

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Server-calculated analytics · NHMIS / DHIS2 aligned"
        actions={
          <>
            <button className="btn-ghost text-xs"><FileDown size={13} /> CSV</button>
            <button className="btn-ghost text-xs"><FileDown size={13} /> Excel</button>
            <button className="btn-ghost text-xs"><Printer size={13} /> Print</button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="card h-fit p-2">
          {FAMILIES.map((fam) => (
            <button
              key={fam}
              onClick={() => setFamily(fam)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition",
                family === fam ? "bg-brand-gradient text-white shadow-glow" : "text-mist-600 hover:bg-mist-50",
              )}
            >
              <BarChart3 size={14} /> {fam}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={cn("chip", preset === p ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200")}
              >
                {p}
              </button>
            ))}
          </div>

          <motion.div key={family} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="mb-4 font-display text-lg font-bold text-mist-900">Reports · {family}</h2>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Encounters" value={128} tone="brand" />
              <StatCard label="Queue Entries" value={100} tone="mist" delay={0.05} />
              <StatCard label="Appointments" value={3} tone="mist" delay={0.1} />
              <StatCard label="No-Shows" value={0} tone="action" delay={0.15} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Reveal>
                <Card>
                  <h3 className="mb-3 font-semibold text-mist-800">Daily Patient Flow</h3>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <LineChart data={patientFlow}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8f4ec" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="queued" stroke="#9ff9cb" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="seen" stroke="#0fc06d" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="referred" stroke="#f83b3b" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Reveal>

              <Reveal delay={0.08}>
                <Card>
                  <h3 className="mb-3 font-semibold text-mist-800">Service Utilization</h3>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={utilization} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="module" width={100} tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip cursor={{ fill: "rgba(15,192,109,0.06)" }} />
                        <Bar dataKey="entries" fill="#0fc06d" radius={[0, 6, 6, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Reveal>

              <Reveal delay={0.12}>
                <Card>
                  <h3 className="mb-3 font-semibold text-mist-800">Top Diagnoses</h3>
                  <div className="space-y-2">
                    {topDiagnoses.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <span className="text-mist-700">{d.name}</span>
                        <Badge tone="mist">{d.cases}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>

              <Reveal delay={0.16}>
                <Card>
                  <h3 className="mb-3 font-semibold text-mist-800">Targets vs Actual</h3>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={monthlyTargets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8f4ec" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="target" fill="#cdffe4" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="value" fill="#0fc06d" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Reveal>
            </div>

            <p className="mt-4 text-center text-[11px] text-mist-300">
              {family} · {preset} · generated {new Date().toLocaleString()}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
