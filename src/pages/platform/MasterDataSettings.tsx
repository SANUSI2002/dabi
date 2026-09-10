import { useState } from "react";
import { Plus, Trash2, Database } from "lucide-react";
import { PageHeader, Button, Badge, Card, StatCard, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useMasterData, MASTER_CATEGORIES } from "@/platform/useMasterData";

const PRODUCT_TABS = ["workforce", "emr", "accounting", "platform"] as const;

export default function MasterDataSettings() {
  const { data, items, addItem, updateItem, toggleActive, removeItem } = useMasterData();
  const [tab, setTab] = useState<(typeof PRODUCT_TABS)[number]>("workforce");
  const [cat, setCat] = useState(MASTER_CATEGORIES.find((c) => c.product === "workforce")!.key);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ label: "", code: "" });

  const cats = MASTER_CATEGORIES.filter((c) => (c.product ?? "platform") === tab);
  const def = MASTER_CATEGORIES.find((c) => c.key === cat)!;
  const list = items(cat);
  const totalItems = Object.values(data).reduce((n, arr) => n + arr.length, 0);

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Every configurable dropdown in one place. Add options, deactivate ones you don't use, set metadata — no code change needed."
        actions={<Button onClick={() => { setF({ label: "", code: "" }); setModal(true); }}><Plus size={15} /> Add to {def.label}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Categories" value={MASTER_CATEGORIES.length} tone="brand" icon={<Database size={18} />} />
        <StatCard label="Total options" value={totalItems} tone="mist" delay={0.05} />
        <StatCard label="Active in this category" value={`${list.filter((i) => i.active).length} / ${list.length}`} tone="mist" delay={0.1} />
      </div>

      <Tabs tabs={PRODUCT_TABS as unknown as string[]} active={tab} onChange={(t) => { setTab(t as never); setCat(MASTER_CATEGORIES.find((c) => (c.product ?? "platform") === t)!.key); }}>
        {() => (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <Card className="h-max p-2">
              {cats.map((c) => (
                <button key={c.key} onClick={() => setCat(c.key)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${c.key === cat ? "bg-brand-50 font-semibold text-brand-700" : "text-mist-600 hover:bg-mist-50"}`}>
                  {c.label}
                  <span className="text-xs text-mist-400">{(data[c.key] ?? []).length}</span>
                </button>
              ))}
            </Card>

            <Card className="p-0">
              <p className="border-b border-mist-100 px-4 py-2.5 text-sm text-mist-500">{def.description}</p>
              {list.length === 0 ? <EmptyState title="Nothing configured" /> : (
                <Table columns={["Label", "Code", ...(def.fields ?? []).map((x) => x.label), "Active", ""]}>
                  {list.map((it, i) => (
                    <Row key={it.id} index={i}>
                      <Cell><Input value={it.label} onChange={(e) => updateItem(cat, it.id, { label: e.target.value })} className="h-8" /></Cell>
                      <Cell><Input value={it.code ?? ""} onChange={(e) => updateItem(cat, it.id, { code: e.target.value })} className="h-8 w-24 font-mono text-xs" /></Cell>
                      {(def.fields ?? []).map((fld) => (
                        <Cell key={fld.key}>
                          {fld.type === "checkbox" ? (
                            <input type="checkbox" checked={!!it.meta?.[fld.key]} onChange={(e) => updateItem(cat, it.id, { meta: { ...it.meta, [fld.key]: e.target.checked } })} />
                          ) : (
                            <Input type={fld.type} value={String(it.meta?.[fld.key] ?? "")} onChange={(e) => updateItem(cat, it.id, { meta: { ...it.meta, [fld.key]: fld.type === "number" ? +e.target.value : e.target.value } })} className="h-8 w-20" />
                          )}
                        </Cell>
                      ))}
                      <Cell><button onClick={() => toggleActive(cat, it.id)}><Badge tone={it.active ? "brand" : "mist"}>{it.active ? "Active" : "Off"}</Badge></button></Cell>
                      <Cell>{it.system ? <span className="text-[10px] text-mist-300">system</span> : <button className="text-action-500 hover:text-action-700" onClick={() => removeItem(cat, it.id)}><Trash2 size={13} /></button>}</Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Card>
          </div>
        )}
      </Tabs>

      <Modal open={modal} onClose={() => setModal(false)} title={`Add to ${def.label}`}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button disabled={!f.label} onClick={() => { addItem(cat, { label: f.label, code: f.code || undefined }); setModal(false); }}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Label"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Code (optional)"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono" /></Field>
        </div>
      </Modal>
    </div>
  );
}
