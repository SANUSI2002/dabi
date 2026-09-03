import { useState } from "react";
import { Fingerprint, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { staff } from "@/data/mock";
import { shortDate } from "@/lib/format";

const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

function worked(a: { clockIn: string; clockOut?: string; breakMins: number }) {
  if (!a.clockOut) return null;
  const [h1, m1] = a.clockIn.split(":").map(Number);
  let [h2, m2] = a.clockOut.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.max(0, mins - a.breakMins) / 60;
}

export default function Attendance() {
  const { attendance, clockIn, clockOut, correctInterval } = useWorkforce();
  const [who, setWho] = useState("s1");
  const [correct, setCorrect] = useState<string | null>(null);
  const [cf, setCf] = useState({ clockIn: "", clockOut: "", breakMins: 30 });

  const open = attendance.filter((a) => !a.clockOut);
  const exceptions = attendance.filter((a) => a.flags.some((f) => ["Late", "Missing checkout", "Auto-checkout"].includes(f)));
  const totalWorked = attendance.reduce((n, a) => n + (worked(a) ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Schedule-aware clock in / out, intervals, breaks & exception review"
        actions={
          <div className="flex items-center gap-2">
            <Select value={who} onChange={(e) => setWho(e.target.value)} options={staff.map((s) => ({ value: s.id, label: s.name }))} className="w-auto" />
            <Button onClick={() => clockIn(who)}><LogIn size={15} /> Clock in</Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Intervals today" value={attendance.filter((a) => a.date === new Date().toISOString().slice(0, 10)).length} tone="brand" icon={<Fingerprint size={18} />} />
        <StatCard label="Currently clocked in" value={open.length} tone="mist" delay={0.05} />
        <StatCard label="Exceptions" value={exceptions.length} tone="action" delay={0.1} icon={<AlertTriangle size={18} />} />
        <StatCard label="Payable hours (period)" value={totalWorked.toFixed(1)} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["All Intervals", `Exceptions (${exceptions.length})`, "Currently In"]}>
        {(t) => {
          const rows = t === "All Intervals" ? attendance : t.startsWith("Exceptions") ? exceptions : open;
          return (
            <Table columns={["Employee", "Date", "In", "Out", "Break", "Worked", "Source", "Flags", ""]}>
              {rows.map((a, i) => {
                const w = worked(a);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{name(a.staffId)}</Cell>
                    <Cell>{shortDate(a.date)}</Cell>
                    <Cell>{a.clockIn}</Cell>
                    <Cell>{a.clockOut ?? <Badge tone="amber">open</Badge>}</Cell>
                    <Cell>{a.breakMins}m</Cell>
                    <Cell className="font-semibold">{w != null ? `${w.toFixed(1)}h` : "—"}</Cell>
                    <Cell>{a.source}</Cell>
                    <Cell>
                      <div className="flex flex-wrap gap-1">
                        {a.flags.length ? a.flags.map((f) => <Badge key={f} tone={f === "Corrected" ? "brand" : "action"}>{f}</Badge>) : <span className="text-mist-300">—</span>}
                      </div>
                    </Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {!a.clockOut && (
                          <button onClick={() => clockOut(a.id)} className="btn-primary px-2.5 py-1 text-xs"><LogOut size={12} /> Out</button>
                        )}
                        <button onClick={() => { setCorrect(a.id); setCf({ clockIn: a.clockIn, clockOut: a.clockOut ?? "", breakMins: a.breakMins }); }} className="btn-ghost px-2 py-1 text-xs">Correct</button>
                      </div>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          );
        }}
      </Tabs>

      <Modal
        open={!!correct}
        onClose={() => setCorrect(null)}
        title="Correct Attendance Interval"
        footer={<><Button variant="ghost" onClick={() => setCorrect(null)}>Cancel</Button>
          <Button onClick={() => { if (correct) correctInterval(correct, { clockIn: cf.clockIn, clockOut: cf.clockOut || undefined, breakMins: cf.breakMins }); setCorrect(null); }}>Save Correction</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Clock in"><Input type="time" value={cf.clockIn} onChange={(e) => setCf({ ...cf, clockIn: e.target.value })} /></Field>
            <Field label="Clock out"><Input type="time" value={cf.clockOut} onChange={(e) => setCf({ ...cf, clockOut: e.target.value })} /></Field>
            <Field label="Break (mins)"><Input type="number" value={cf.breakMins} onChange={(e) => setCf({ ...cf, breakMins: +e.target.value })} /></Field>
          </div>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Corrections before period lock trigger revalidation. After lock, this becomes a proposed amendment and never rewrites the locked record.
          </p>
        </div>
      </Modal>
    </div>
  );
}
