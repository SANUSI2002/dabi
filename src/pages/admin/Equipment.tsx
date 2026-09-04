import { useMemo, useState } from "react";
import { Wrench, Plus, CalendarClock, CircleCheck, PackagePlus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { useAssets, pmState, nextPmDue } from "@/store/useAssets";
import { useIdentity } from "@/store/useIdentity";
import { shortDate } from "@/lib/format";
import type { AssetCategory } from "@/data/assets";

const CATEGORIES: AssetCategory[] = ["Cold chain", "Maternity", "Diagnostics", "Power", "IT", "General"];
const pmTone = (l: string) => (l === "Overdue" ? "action" : l === "Due soon" ? "amber" : "mist");

export default function Equipment() {
  const { assets, jobs, addAsset, reportFault, setJobStatus, resolveJob, schedulePm, completePm, setAssetStatus } = useAssets();
  const me = useIdentity((s) => s.user.name);
  const assetById = (id: string) => assets.find((a) => a.id === id);

  const [faultOpen, setFaultOpen] = useState(false);
  const [ff, setFf] = useState({ assetId: "", summary: "", priority: "Medium" as "Low" | "Medium" | "High" });
  const [assetOpen, setAssetOpen] = useState(false);
  const [af, setAf] = useState({ tag: "", name: "", category: "General" as AssetCategory, location: "", commissionedOn: "", serviceIntervalDays: 180, lastServicedOn: "" });
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const [resNote, setResNote] = useState("");
  const [pmFor, setPmFor] = useState<string | null>(null);
  const [pmNote, setPmNote] = useState("");

  const openJobs = jobs.filter((j) => j.status !== "Resolved");
  const pm = useMemo(
    () => assets.filter((a) => a.status !== "Retired").map((a) => ({ a, pm: pmState(a) })).sort((x, y) => x.pm.days - y.pm.days),
    [assets],
  );
  const overdue = pm.filter((p) => p.pm.label === "Overdue").length;
  const dueSoon = pm.filter((p) => p.pm.label === "Due soon").length;

  return (
    <div>
      <PageHeader
        title="Equipment & Maintenance"
        subtitle="Asset register, corrective jobs and the preventive-maintenance schedule"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAssetOpen(true)}><PackagePlus size={15} /> Add asset</Button>
            <Button variant="action" onClick={() => { setFf({ assetId: "", summary: "", priority: "Medium" }); setFaultOpen(true); }}><Plus size={15} /> Report fault</Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.length} tone="brand" icon={<Wrench size={18} />} />
        <StatCard label="Open jobs" value={openJobs.length} tone={openJobs.length ? "action" : "mist"} delay={0.05} />
        <StatCard label="PM overdue" value={overdue} tone={overdue ? "action" : "brand"} delay={0.1} icon={<CalendarClock size={18} />} />
        <StatCard label="PM due ≤ 14d" value={dueSoon} tone={dueSoon ? "amber" : "mist"} delay={0.15} />
      </div>

      <Tabs tabs={["PM Schedule", "Maintenance Jobs", "Asset Register"]}>
        {(t) =>
          t === "PM Schedule" ? (
            <Table columns={["Asset", "Location", "Interval", "Last serviced", "Next due", "Status", ""]}>
              {pm.map(({ a, pm: p }, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">
                    {a.name}
                    <span className="block text-[11px] font-normal text-mist-400">{a.tag} · {a.category}</span>
                  </Cell>
                  <Cell className="text-mist-500">{a.location}</Cell>
                  <Cell>{a.serviceIntervalDays}d</Cell>
                  <Cell className="text-mist-500">{shortDate(a.lastServicedOn)}</Cell>
                  <Cell>{shortDate(nextPmDue(a).toISOString())}</Cell>
                  <Cell>
                    <Badge tone={pmTone(p.label)}>
                      {p.label}
                      {p.label !== "Scheduled" && ` · ${Math.abs(p.days)}d ${p.days < 0 ? "over" : "left"}`}
                    </Badge>
                  </Cell>
                  <Cell>
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => { setPmFor(a.id); setPmNote(""); }} className="btn-primary px-2.5 py-1 text-xs"><CircleCheck size={12} /> Log service</button>
                      <button onClick={() => schedulePm(a.id)} className="btn-ghost px-2 py-1 text-xs">Raise job</button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          ) : t === "Maintenance Jobs" ? (
            <Table columns={["Asset", "Type", "Summary", "Reported by", "Priority", "Opened", "Status", ""]}>
              {jobs.map((j, i) => {
                const a = assetById(j.assetId);
                return (
                  <Row key={j.id} index={i}>
                    <Cell className="font-semibold">{a?.name ?? "—"}<span className="block text-[11px] font-normal text-mist-400">{a?.tag}</span></Cell>
                    <Cell><Badge tone={j.type === "Preventive" ? "brand" : "mist"}>{j.type}</Badge></Cell>
                    <Cell className="max-w-[260px] text-mist-600">
                      {j.summary}
                      {j.resolution && <span className="block text-[11px] text-brand-600">✓ {j.resolution}</span>}
                    </Cell>
                    <Cell className="text-mist-500">{j.reportedBy}</Cell>
                    <Cell><Badge tone={j.priority === "High" ? "action" : j.priority === "Medium" ? "amber" : "mist"}>{j.priority}</Badge></Cell>
                    <Cell className="text-mist-400">{shortDate(j.openedOn)}</Cell>
                    <Cell><Badge tone={statusTone(j.status)}>{j.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {j.status === "Open" && <button onClick={() => setJobStatus(j.id, "In Progress")} className="btn-ghost px-2 py-1 text-xs">Start</button>}
                        {j.status !== "Resolved" && <button onClick={() => { setResolveFor(j.id); setResNote(""); }} className="btn-primary px-2.5 py-1 text-xs">Resolve</button>}
                      </div>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Asset", "Category", "Location", "Commissioned", "PM interval", "Status"]}>
              {assets.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{a.name}<span className="block text-[11px] font-normal text-mist-400">{a.tag}</span></Cell>
                  <Cell><Badge tone="mist">{a.category}</Badge></Cell>
                  <Cell className="text-mist-500">{a.location}</Cell>
                  <Cell className="text-mist-400">{shortDate(a.commissionedOn)}</Cell>
                  <Cell>{a.serviceIntervalDays}d</Cell>
                  <Cell>
                    <select
                      value={a.status}
                      onChange={(e) => setAssetStatus(a.id, e.target.value as never)}
                      className="input w-auto py-1 text-xs"
                    >
                      {["In service", "Under repair", "Out of service", "Retired"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={faultOpen}
        onClose={() => setFaultOpen(false)}
        title="Report equipment fault"
        footer={<><Button variant="ghost" onClick={() => setFaultOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!ff.assetId || !ff.summary.trim()} onClick={() => { reportFault(ff.assetId, { summary: ff.summary.trim(), reportedBy: me, priority: ff.priority }); setFaultOpen(false); }}>Submit</Button></>}
      >
        <div className="space-y-4">
          <Field label="Asset">
            <Select value={ff.assetId} onChange={(e) => setFf({ ...ff, assetId: e.target.value })} options={[{ value: "", label: "Select an asset…" }, ...assets.map((a) => ({ value: a.id, label: `${a.name} (${a.tag})` }))]} />
          </Field>
          <Field label="Fault"><Textarea value={ff.summary} onChange={(e) => setFf({ ...ff, summary: e.target.value })} /></Field>
          <Field label="Priority"><Select value={ff.priority} onChange={(e) => setFf({ ...ff, priority: e.target.value as never })} options={["Low", "Medium", "High"]} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">High-priority faults move the asset to <b>Under repair</b> automatically. Resolving the job restores it and stamps the service date.</p>
        </div>
      </Modal>

      <Modal
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        title="Add asset to register"
        wide
        footer={<><Button variant="ghost" onClick={() => setAssetOpen(false)}>Cancel</Button>
          <Button
            disabled={!af.tag.trim() || !af.name.trim() || !af.commissionedOn || !af.lastServicedOn}
            onClick={() => { addAsset({ ...af, tag: af.tag.trim(), name: af.name.trim(), commissionedOn: new Date(af.commissionedOn).toISOString(), lastServicedOn: new Date(af.lastServicedOn).toISOString() }); setAssetOpen(false); }}
          >Add asset</Button></>}
      >
        <Grid cols={2}>
          <Field label="Asset tag"><Input value={af.tag} onChange={(e) => setAf({ ...af, tag: e.target.value.toUpperCase() })} placeholder="e.g. VR-8891" /></Field>
          <Field label="Name"><Input value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} /></Field>
          <Field label="Category"><Select value={af.category} onChange={(e) => setAf({ ...af, category: e.target.value as AssetCategory })} options={CATEGORIES} /></Field>
          <Field label="Location"><Input value={af.location} onChange={(e) => setAf({ ...af, location: e.target.value })} /></Field>
          <Field label="Commissioned"><Input type="date" value={af.commissionedOn} onChange={(e) => setAf({ ...af, commissionedOn: e.target.value })} /></Field>
          <Field label="Last serviced"><Input type="date" value={af.lastServicedOn} onChange={(e) => setAf({ ...af, lastServicedOn: e.target.value })} /></Field>
          <Field label="PM interval (days)"><Input type="number" value={af.serviceIntervalDays} onChange={(e) => setAf({ ...af, serviceIntervalDays: +e.target.value })} /></Field>
        </Grid>
      </Modal>

      <Modal
        open={!!resolveFor}
        onClose={() => setResolveFor(null)}
        title="Resolve maintenance job"
        footer={<><Button variant="ghost" onClick={() => setResolveFor(null)}>Cancel</Button>
          <Button disabled={!resNote.trim()} onClick={() => { if (resolveFor) resolveJob(resolveFor, resNote.trim()); setResolveFor(null); }}><CircleCheck size={14} /> Mark resolved</Button></>}
      >
        <div className="space-y-3">
          <Field label="Resolution / work done"><Textarea value={resNote} onChange={(e) => setResNote(e.target.value)} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Resolving stamps today as the asset's last-serviced date and restores it to service if no other job is open.</p>
        </div>
      </Modal>

      <Modal
        open={!!pmFor}
        onClose={() => setPmFor(null)}
        title="Log preventive service"
        footer={<><Button variant="ghost" onClick={() => setPmFor(null)}>Cancel</Button>
          <Button onClick={() => { if (pmFor) completePm(pmFor, pmNote.trim()); setPmFor(null); }}><CircleCheck size={14} /> Record service</Button></>}
      >
        {(() => {
          const a = pmFor ? assetById(pmFor) : undefined;
          return (
            <div className="space-y-3">
              {a && <p className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600"><b>{a.name}</b> ({a.tag}) · every {a.serviceIntervalDays} days · last {shortDate(a.lastServicedOn)}</p>}
              <Field label="Work done (optional)"><Textarea value={pmNote} onChange={(e) => setPmNote(e.target.value)} placeholder="Cleaned, calibrated, parts replaced…" /></Field>
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Records the service, resets the PM clock, and closes any open preventive job for this asset.</p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
