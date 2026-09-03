import { useState } from "react";
import { FlaskConical, Printer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { LAB_TESTS } from "@/data/catalog";
import { staff } from "@/data/mock";
import { dateTime } from "@/lib/format";

export default function Laboratory() {
  const { labOrders, patientById, resolveLab } = useEmr();
  const [entry, setEntry] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [flag, setFlag] = useState<"Normal" | "Low" | "High" | "Critical">("Normal");
  const [tech, setTech] = useState(staff.find((s) => s.role === "Lab Technician")?.name ?? staff[0].name);

  const pending = labOrders.filter((l) => l.status !== "Resulted" && l.status !== "Rejected");
  const done = labOrders.filter((l) => l.status === "Resulted");
  const order = labOrders.find((l) => l.id === entry);
  const ref = LAB_TESTS.find((t) => t.name === order?.test)?.ref;

  return (
    <div>
      <PageHeader title="Laboratory" subtitle={`${pending.length} pending · ${done.length} resulted`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={labOrders.length} tone="brand" icon={<FlaskConical size={18} />} />
        <StatCard label="Pending" value={pending.length} tone="action" delay={0.05} />
        <StatCard label="Resulted" value={done.length} tone="brand" delay={0.1} />
        <StatCard label="Rejected" value={labOrders.filter((l) => l.status === "Rejected").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={[`Pending Orders (${pending.length})`, `Results (${done.length})`]}>
        {(t) =>
          t.startsWith("Pending") ? (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr>{["Patient", "Test", "Category", "Urgency", "Ordered", "Status", ""].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {pending.map((l) => {
                    const p = patientById(l.patientId);
                    return (
                      <tr key={l.id} className="hover:bg-brand-50/40">
                        <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                        <td className="td">{l.test}</td>
                        <td className="td text-mist-500">{l.category}</td>
                        <td className="td"><Badge tone={l.urgency === "Urgent" ? "action" : "mist"}>{l.urgency}</Badge></td>
                        <td className="td text-mist-400">{dateTime(l.orderedAt)}</td>
                        <td className="td"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                        <td className="td text-right">
                          <button onClick={() => { setEntry(l.id); setResult(""); }} className="btn-primary px-2.5 py-1 text-xs">
                            Enter Result
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pending.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-mist-400">No pending orders.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr>{["Patient", "Test", "Result", "Flag", "Verified By", ""].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {done.map((l) => {
                    const p = patientById(l.patientId);
                    return (
                      <tr key={l.id}>
                        <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                        <td className="td">{l.test}</td>
                        <td className="td">{l.result}</td>
                        <td className="td"><Badge tone={statusTone(l.flag ?? "Normal")}>{l.flag}</Badge></td>
                        <td className="td text-mist-500">{l.verifiedBy}</td>
                        <td className="td text-right"><button className="btn-ghost px-2.5 py-1 text-xs"><Printer size={13} /> Print</button></td>
                      </tr>
                    );
                  })}
                  {done.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-mist-400">No results recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={!!order}
        onClose={() => setEntry(null)}
        title={`Lab Report — ${order?.test ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEntry(null)}>Close</Button>
            <Button
              onClick={() => {
                if (order) resolveLab(order.id, result, flag, tech);
                setEntry(null);
              }}
            >
              <Printer size={14} /> Save & Print
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-500">
            Reference range: <b className="text-mist-700">{ref ?? "—"}</b>
          </div>
          <Field label="Result value"><Input value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Negative / 34 %" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Flag"><Select value={flag} onChange={(e) => setFlag(e.target.value as never)} options={["Normal", "Low", "High", "Critical"]} /></Field>
            <Field label="Verified by"><Select value={tech} onChange={(e) => setTech(e.target.value)} options={staff.map((s) => s.name)} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
