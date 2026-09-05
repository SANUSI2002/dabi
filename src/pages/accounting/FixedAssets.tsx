import { useMemo, useState } from "react";
import { Plus, Building2, PlayCircle, Archive } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useFixedAssets, netBookValue, monthlyDepreciation } from "@/store/accounting/useFixedAssets";
import { useLedger } from "@/store/accounting/useLedger";
import type { FixedAsset, DepreciationMethod } from "@/data/accounting/fixedAssets";

const ym = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export default function FixedAssets() {
  const { assets, runs, addAsset, disposeAsset, previewRun, runDepreciation, scheduleFor } = useFixedAssets();
  const assetAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "fixed_asset");
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");

  const [create, setCreate] = useState(false);
  const [depr, setDepr] = useState(false);
  const [dispose, setDispose] = useState<FixedAsset | null>(null);
  const [schedule, setSchedule] = useState<FixedAsset | null>(null);
  const [period, setPeriod] = useState(ym());
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", category: "Medical Equipment", acquisitionDate: isoDate(new Date()), cost: 0, assetAccountNumber: 1510, method: "Straight Line" as DepreciationMethod, usefulLifeMonths: 84, salvageValue: 0, reducingRateAnnual: 20, fundedFromAccount: 1010 });
  const [df, setDf] = useState({ date: isoDate(new Date()), proceeds: 0, proceedsAccount: 1010 });

  const totals = useMemo(() => {
    const active = assets.filter((a) => a.status !== "Disposed");
    return {
      cost: active.reduce((n, a) => n + a.cost, 0),
      nbv: active.reduce((n, a) => n + netBookValue(a), 0),
      monthly: active.reduce((n, a) => n + monthlyDepreciation(a), 0),
    };
  }, [assets]);

  const preview = useMemo(() => previewRun(period), [previewRun, period, assets]);

  function submitCreate() {
    setErr(null);
    if (!f.name.trim() || f.cost <= 0) return setErr("Name and cost are required.");
    addAsset({ ...f, name: f.name.trim(), acquisitionDate: new Date(f.acquisitionDate + "T12:00:00Z").toISOString(), reducingRateAnnual: f.method === "Reducing Balance" ? f.reducingRateAnnual : undefined });
    setCreate(false);
    setF({ ...f, name: "", cost: 0 });
  }

  return (
    <div>
      <PageHeader title="Fixed Assets" subtitle="Asset register, monthly depreciation runs, and disposals"
        actions={<>
          <Button variant="soft" onClick={() => setDepr(true)}><PlayCircle size={15} /> Run Depreciation</Button>
          <Button onClick={() => { setErr(null); setCreate(true); }}><Plus size={15} /> Register Asset</Button>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.filter((a) => a.status !== "Disposed").length} tone="brand" icon={<Building2 size={18} />} />
        <StatCard label="Gross cost" value={money(totals.cost)} tone="mist" delay={0.05} />
        <StatCard label="Net book value" value={money(totals.nbv)} tone="brand" delay={0.1} />
        <StatCard label="Monthly depreciation" value={money(totals.monthly)} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["Register", "Depreciation Runs"]}>
        {(t) =>
          t === "Depreciation Runs" ? (
            runs.length === 0 ? <EmptyState title="No depreciation runs yet" /> : (
              <Card className="p-0">
                <Table columns={["Period", "Run date", "Assets", "Total charge", "Journal"]}>
                  {runs.map((r, i) => (
                    <Row key={r.id} index={i}>
                      <Cell className="font-mono">{r.period}</Cell>
                      <Cell>{shortDate(r.runDate)}</Cell>
                      <Cell>{r.entries.length}</Cell>
                      <Cell className="font-mono font-semibold">{money(r.total)}</Cell>
                      <Cell>{r.journalEntryId ? <Badge tone="brand">posted</Badge> : "—"}</Cell>
                    </Row>
                  ))}
                </Table>
              </Card>
            )
          ) : (
            <Card className="p-0">
              <Table columns={["Tag", "Asset", "Acquired", "Cost", "Accum. dep.", "NBV", "Method", "Status", ""]}>
                {assets.map((a, i) => (
                  <Row key={a.id} index={i} onClick={() => setSchedule(a)}>
                    <Cell className="font-mono text-xs">{a.tag}</Cell>
                    <Cell className="font-semibold">{a.name}<span className="block text-xs font-normal text-mist-400">{a.category}</span></Cell>
                    <Cell>{shortDate(a.acquisitionDate)}</Cell>
                    <Cell className="font-mono">{money(a.cost)}</Cell>
                    <Cell className="font-mono">{money(a.accumulatedDepreciation)}</Cell>
                    <Cell className="font-mono font-semibold">{money(netBookValue(a))}</Cell>
                    <Cell className="text-xs">{a.method}</Cell>
                    <Cell><Badge tone={statusTone(a.status === "Active" ? "active" : a.status === "Disposed" ? "returned" : "mist")}>{a.status}</Badge></Cell>
                    <Cell>{a.status !== "Disposed" && <button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setDf({ date: isoDate(new Date()), proceeds: 0, proceedsAccount: 1010 }); setDispose(a); }}><Archive size={11} /></button>}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      <Modal open={create} onClose={() => setCreate(false)} title="Register Fixed Asset"
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submitCreate}>Register</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <Grid cols={2}>
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
            <Field label="Acquisition date"><Input type="date" value={f.acquisitionDate} onChange={(e) => setF({ ...f, acquisitionDate: e.target.value })} /></Field>
            <Field label="Cost"><Input type="number" value={f.cost || ""} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></Field>
            <Field label="Asset account"><Select value={String(f.assetAccountNumber)} onChange={(e) => setF({ ...f, assetAccountNumber: +e.target.value })} options={assetAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <Field label="Funded from"><Select value={String(f.fundedFromAccount)} onChange={(e) => setF({ ...f, fundedFromAccount: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as DepreciationMethod })} options={["Straight Line", "Reducing Balance"]} /></Field>
            {f.method === "Straight Line"
              ? <Field label="Useful life (months)"><Input type="number" value={f.usefulLifeMonths} onChange={(e) => setF({ ...f, usefulLifeMonths: +e.target.value })} /></Field>
              : <Field label="Reducing rate (% p.a.)"><Input type="number" value={f.reducingRateAnnual} onChange={(e) => setF({ ...f, reducingRateAnnual: +e.target.value })} /></Field>}
            <Field label="Salvage value"><Input type="number" value={f.salvageValue || ""} onChange={(e) => setF({ ...f, salvageValue: +e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal open={depr} onClose={() => setDepr(false)} title="Run Depreciation"
        footer={<><Button variant="ghost" onClick={() => setDepr(false)}>Cancel</Button><Button onClick={() => { const r = runDepreciation(period); if (r.ok) setDepr(false); else alert(r.error); }} disabled={preview.entries.length === 0}>Post {money(preview.total)}</Button></>}>
        <div className="space-y-3">
          <Field label="Period (YYYY-MM)"><Input value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Table columns={["Asset", "NBV before", "Charge", "NBV after"]}>
            {preview.entries.map((e) => {
              const a = assets.find((x) => x.id === e.assetId)!;
              return (
                <Row key={e.assetId}>
                  <Cell>{a.name}</Cell>
                  <Cell className="font-mono">{money(e.nbvBefore)}</Cell>
                  <Cell className="font-mono font-semibold">{money(e.amount)}</Cell>
                  <Cell className="font-mono">{money(e.nbvAfter)}</Cell>
                </Row>
              );
            })}
          </Table>
          <p className="text-xs text-mist-400">Posts one entry: Dr Depreciation Expense {money(preview.total)} / Cr Accumulated Depreciation.</p>
        </div>
      </Modal>

      <Modal open={!!dispose} onClose={() => setDispose(null)} title={dispose ? `Dispose ${dispose.tag}` : ""}
        footer={<><Button variant="ghost" onClick={() => setDispose(null)}>Cancel</Button><Button variant="action" onClick={() => { if (dispose) { const r = disposeAsset(dispose.id, { date: new Date(df.date + "T12:00:00Z").toISOString(), proceeds: df.proceeds, proceedsAccount: df.proceedsAccount }); if (r.ok) setDispose(null); else alert(r.error); } }}>Post disposal</Button></>}>
        {dispose && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">NBV at disposal: <b>{money(netBookValue(dispose))}</b></p>
            <Grid cols={2}>
              <Field label="Disposal date"><Input type="date" value={df.date} onChange={(e) => setDf({ ...df, date: e.target.value })} /></Field>
              <Field label="Proceeds"><Input type="number" value={df.proceeds || ""} onChange={(e) => setDf({ ...df, proceeds: +e.target.value })} /></Field>
            </Grid>
            <Field label="Proceeds to"><Select value={String(df.proceedsAccount)} onChange={(e) => setDf({ ...df, proceedsAccount: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <p className="text-xs text-mist-400">{df.proceeds - netBookValue(dispose) >= 0 ? `Gain of ${money(df.proceeds - netBookValue(dispose))} → Other Income.` : `Loss of ${money(netBookValue(dispose) - df.proceeds)} → Misc Expense.`}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!schedule} onClose={() => setSchedule(null)} title={schedule ? `Depreciation schedule — ${schedule.tag}` : ""} wide>
        {schedule && (
          <Table columns={["Period", "Charge", "Accumulated", "NBV"]}>
            {scheduleFor(schedule, 18).map((r) => (
              <Row key={r.period}>
                <Cell className="font-mono">{r.period}</Cell>
                <Cell className="font-mono">{money(r.charge)}</Cell>
                <Cell className="font-mono">{money(r.accumulated)}</Cell>
                <Cell className="font-mono">{money(r.nbv)}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Modal>
    </div>
  );
}
