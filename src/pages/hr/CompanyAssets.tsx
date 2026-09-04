import { useState } from "react";
import { Boxes, Plus, Check, X, PackageCheck, PackageMinus } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useCompanyAssets } from "@/store/useCompanyAssets";
import { useHr } from "@/store/useHr";
import { shortDate, naira } from "@/lib/format";

export default function CompanyAssets() {
  const {
    categories, assets, allocations, requests,
    addCategory, addAsset, requestAsset, decideRequest, allocateAsset, returnAsset, currentHolder,
  } = useCompanyAssets();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const active = allocations.filter((a) => !a.returnDate);
  const pendingRequests = requests.filter((r) => r.status === "Requested");

  const [catOpen, setCatOpen] = useState(false);
  const [cf, setCf] = useState({ name: "", description: "" });
  const [assetOpen, setAssetOpen] = useState(false);
  const [af, setAf] = useState({ name: "", categoryId: categories[0]?.id ?? "", batchNo: "", trackingId: "", purchaseDate: "", purchaseCost: 0 });
  const [reqOpen, setReqOpen] = useState(false);
  const [rf, setRf] = useState({ employeeId: staff[0]?.id ?? "", categoryId: categories[0]?.id ?? "", description: "" });
  const [allocFor, setAllocFor] = useState<string | null>(null);
  const [allocAssetId, setAllocAssetId] = useState("");
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<"Good" | "Damaged" | "Lost">("Good");
  const [returnNote, setReturnNote] = useState("");

  return (
    <div>
      <PageHeader
        title="Company Assets"
        subtitle="IT equipment, badges, uniforms & field kits — distinct from clinical Equipment"
        actions={<div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setCf({ name: "", description: "" }); setCatOpen(true); }}>New category</Button>
          <Button onClick={() => { setAf({ name: "", categoryId: categories[0]?.id ?? "", batchNo: "", trackingId: "", purchaseDate: "", purchaseCost: 0 }); setAssetOpen(true); }}><Plus size={15} /> Add asset</Button>
        </div>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.length} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="In use" value={assets.filter((a) => a.status === "In Use").length} tone="mist" delay={0.05} />
        <StatCard label="Pending requests" value={pendingRequests.length} tone={pendingRequests.length ? "amber" : "mist"} delay={0.1} />
        <StatCard label="Active allocations" value={active.length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Assets", "Requests", "Allocations"]}>
        {(t) =>
          t === "Assets" ? (
            <div className="space-y-4">
              {categories.map((c) => {
                const inCat = assets.filter((a) => a.categoryId === c.id);
                if (inCat.length === 0) return null;
                return (
                  <Card key={c.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-display font-bold text-mist-900">{c.name}</p>
                        <p className="text-[11px] text-mist-400">{c.description}</p>
                      </div>
                      <Badge tone="mist">{inCat.length}</Badge>
                    </div>
                    <Table columns={["Asset", "Tracking ID", "Batch", "Status", "Holder", "Cost"]}>
                      {inCat.map((a, i) => (
                        <Row key={a.id} index={i}>
                          <Cell className="font-semibold">{a.name}</Cell>
                          <Cell className="font-mono text-xs">{a.trackingId}</Cell>
                          <Cell className="text-mist-400">{a.batchNo ?? "—"}</Cell>
                          <Cell><Badge tone={a.status === "Available" ? "brand" : a.status === "In Use" ? "mist" : "action"}>{a.status}</Badge></Cell>
                          <Cell className="text-mist-500">{currentHolder(a.id) ?? "—"}</Cell>
                          <Cell>{naira(a.purchaseCost)}</Cell>
                        </Row>
                      ))}
                    </Table>
                  </Card>
                );
              })}
            </div>
          ) : t === "Requests" ? (
            <div className="space-y-3">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setRf({ employeeId: staff[0]?.id ?? "", categoryId: categories[0]?.id ?? "", description: "" }); setReqOpen(true); }}><Plus size={14} /> New request</Button></div>
              <Table columns={["Employee", "Category", "Description", "Requested", "Status", ""]}>
                {requests.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{name(r.employeeId)}</Cell>
                    <Cell><Badge tone="mist">{catName(r.categoryId)}</Badge></Cell>
                    <Cell className="text-mist-500">{r.description}</Cell>
                    <Cell className="text-mist-400">{shortDate(r.requestedDate)}</Cell>
                    <Cell><Badge tone={statusTone(r.status)}>{r.status}</Badge></Cell>
                    <Cell>
                      {r.status === "Requested" && (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => decideRequest(r.id, "Rejected")} className="btn-ghost px-2 py-1 text-xs"><X size={12} /> Reject</button>
                          <button onClick={() => { setAllocFor(r.id); setAllocAssetId(assets.find((a) => a.categoryId === r.categoryId && a.status === "Available")?.id ?? ""); decideRequest(r.id, "Approved"); }} className="btn-primary px-2.5 py-1 text-xs"><Check size={12} /> Approve</button>
                        </div>
                      )}
                      {r.status === "Approved" && (
                        <button onClick={() => { setAllocFor(r.id); setAllocAssetId(assets.find((a) => a.categoryId === r.categoryId && a.status === "Available")?.id ?? ""); }} className="btn-primary px-2.5 py-1 text-xs"><PackageCheck size={12} /> Allocate</button>
                      )}
                    </Cell>
                  </Row>
                ))}
                {requests.length === 0 && <Row><Cell className="text-mist-400">No asset requests.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
            </div>
          ) : (
            <Table columns={["Asset", "Employee", "Assigned", "Returned", "Condition", ""]}>
              {allocations.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{assets.find((x) => x.id === a.assetId)?.name ?? a.assetId}</Cell>
                  <Cell>{name(a.employeeId)}</Cell>
                  <Cell className="text-mist-400">{shortDate(a.assignedDate)}</Cell>
                  <Cell className="text-mist-400">{a.returnDate ? shortDate(a.returnDate) : "—"}</Cell>
                  <Cell>{a.returnCondition ? <Badge tone={a.returnCondition === "Good" ? "brand" : "action"}>{a.returnCondition}</Badge> : "—"}</Cell>
                  <Cell>
                    {!a.returnDate && (
                      <button onClick={() => { setReturnFor(a.id); setReturnCondition("Good"); setReturnNote(""); }} className="btn-soft px-2.5 py-1 text-xs"><PackageMinus size={12} /> Return</button>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="New asset category"
        footer={<><Button variant="ghost" onClick={() => setCatOpen(false)}>Cancel</Button><Button disabled={!cf.name.trim()} onClick={() => { addCategory(cf); setCatOpen(false); }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name"><Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></Field>
          <Field label="Description"><Input value={cf.description} onChange={(e) => setCf({ ...cf, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={assetOpen} onClose={() => setAssetOpen(false)} title="Add asset" wide
        footer={<><Button variant="ghost" onClick={() => setAssetOpen(false)}>Cancel</Button>
          <Button disabled={!af.name.trim() || !af.trackingId.trim() || !af.purchaseDate} onClick={() => { addAsset({ ...af, purchaseDate: new Date(af.purchaseDate).toISOString() }); setAssetOpen(false); }}>Add</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} /></Field>
          <Field label="Category"><Select value={af.categoryId} onChange={(e) => setAf({ ...af, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Tracking ID"><Input value={af.trackingId} onChange={(e) => setAf({ ...af, trackingId: e.target.value })} /></Field>
          <Field label="Batch no. (optional)"><Input value={af.batchNo} onChange={(e) => setAf({ ...af, batchNo: e.target.value })} /></Field>
          <Field label="Purchase date"><Input type="date" value={af.purchaseDate} onChange={(e) => setAf({ ...af, purchaseDate: e.target.value })} /></Field>
          <Field label="Cost (₦)"><Input type="number" value={af.purchaseCost} onChange={(e) => setAf({ ...af, purchaseCost: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Request asset"
        footer={<><Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
          <Button disabled={!rf.description.trim()} onClick={() => { requestAsset(rf.employeeId, rf.categoryId, rf.description.trim()); setReqOpen(false); }}>Request</Button></>}>
        <div className="space-y-4">
          <Field label="Employee"><Select value={rf.employeeId} onChange={(e) => setRf({ ...rf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Category"><Select value={rf.categoryId} onChange={(e) => setRf({ ...rf, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Description"><Input value={rf.description} onChange={(e) => setRf({ ...rf, description: e.target.value })} placeholder="What's needed and why" /></Field>
        </div>
      </Modal>

      <Modal open={!!allocFor} onClose={() => setAllocFor(null)} title="Allocate asset"
        footer={<><Button variant="ghost" onClick={() => setAllocFor(null)}>Cancel</Button>
          <Button disabled={!allocAssetId} onClick={() => { const r = requests.find((x) => x.id === allocFor); if (r) allocateAsset(allocAssetId, r.employeeId, r.id); setAllocFor(null); }}>Allocate</Button></>}>
        {(() => {
          const r = requests.find((x) => x.id === allocFor);
          const available = assets.filter((a) => (!r || a.categoryId === r.categoryId) && a.status === "Available");
          return (
            <div className="space-y-4">
              {r && <p className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">To <b>{name(r.employeeId)}</b> · {catName(r.categoryId)}</p>}
              <Field label="Available asset">
                <Select value={allocAssetId} onChange={(e) => setAllocAssetId(e.target.value)} options={[{ value: "", label: available.length ? "Select…" : "No available asset in this category" }, ...available.map((a) => ({ value: a.id, label: `${a.name} (${a.trackingId})` }))]} />
              </Field>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!returnFor} onClose={() => setReturnFor(null)} title="Return asset"
        footer={<><Button variant="ghost" onClick={() => setReturnFor(null)}>Cancel</Button>
          <Button onClick={() => { if (returnFor) returnAsset(returnFor, returnCondition, returnNote || undefined); setReturnFor(null); }}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Condition"><Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as never)} options={["Good", "Damaged", "Lost"]} /></Field>
          <Field label="Note (optional)"><Input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
