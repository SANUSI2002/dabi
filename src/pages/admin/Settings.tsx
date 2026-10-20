import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PageHeader, Badge, Button } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox, Grid } from "@/components/ui/form";
import { useCatalog } from "@/store/useCatalog";
import { CATALOGS, type CatalogDef, type FieldDef } from "./settingsConfig";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { useLiveSettingsCatalog, type LiveRow } from "@/emr-live/settings";

const rowId = (r: Record<string, unknown>) => String(r.id ?? r.code ?? r.name);

function renderCell(def: CatalogDef, colKey: string, val: unknown, kind?: string) {
  if (kind === "money") return naira(Number(val) || 0);
  if (kind === "bool") return val ? "✓" : "—";
  if (kind === "badge") return <Badge tone="mist">{String(val ?? "—")}</Badge>;
  if (kind === "code") return <span className="font-mono text-xs">{String(val ?? "—")}</span>;
  return String(val ?? "—");
}

function blankFrom(fields: FieldDef[]) {
  const o: Record<string, unknown> = {};
  fields.forEach((f) => (o[f.key] = f.default ?? (f.type === "checkbox" ? false : f.type === "number" ? 0 : "")));
  return o;
}

export default function Settings() {
  const catalog = useCatalog();
  const [tab, setTab] = useState(CATALOGS[0].tab);
  const def = CATALOGS.find((c) => c.tab === tab)!;
  // A live hospital's catalogs are its own records (see src/emr-live/settings.ts); the demo is unchanged.
  const live = useIsLiveEmr();
  const liveCatalog = useLiveSettingsCatalog(live, def.key);
  const rows = (live ? liveCatalog.rows : catalog[def.key]) as (Record<string, unknown> & { active?: boolean; status?: string })[];

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const isEdit = Boolean(editing && Object.keys(editing).length);
  const formFields = live && !isEdit && liveCatalog.addFields ? liveCatalog.addFields : live && isEdit && liveCatalog.editFields ? liveCatalog.editFields : def.fields;

  function openAdd() {
    setActionError("");
    setForm(blankFrom(live && liveCatalog.addFields ? liveCatalog.addFields : def.fields));
    setEditing({});
  }
  function openEdit(r: Record<string, unknown>) {
    setActionError("");
    setForm({ ...r });
    setEditing(r);
  }
  async function run(work: () => Promise<void>, after: () => void = () => {}) {
    setBusy(true); setActionError("");
    try { await work(); after(); }
    catch (cause) { setActionError(describeEmrError(cause)); }
    finally { setBusy(false); }
  }
  function save() {
    if (live) {
      void run(() => (isEdit ? liveCatalog.update(editing as LiveRow, form) : liveCatalog.add(form)), () => setEditing(null));
      return;
    }
    if (editing && Object.keys(editing).length) {
      catalog.update(def.key, rowId(editing), form);
    } else {
      catalog.add(def.key, def.key === "users" ? { ...form, status: "Active" } : form);
    }
    setEditing(null);
  }
  function toggle(r: Record<string, unknown>) {
    if (live) { void run(() => liveCatalog.toggle(r as LiveRow)); return; }
    catalog.toggle(def.key, rowId(r));
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="System catalogs & configuration — changes affect the whole facility" />

      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
        ⚠ Changes here affect the entire system. Every change is written to the audit log.
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-mist-200">
        {CATALOGS.map((c) => (
          <button
            key={c.tab}
            onClick={() => setTab(c.tab)}
            className={cn("px-3 py-2.5 text-[13px] font-semibold transition-colors", tab === c.tab ? "text-brand-700" : "text-mist-400 hover:text-mist-600")}
          >
            {c.tab}
          </button>
        ))}
      </div>

      {live && liveCatalog.error && <p role="alert" className="mb-3 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{liveCatalog.error}</p>}
      {live && liveCatalog.readOnly && <p className="mb-3 rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600 ring-1 ring-mist-200">{liveCatalog.readOnly}</p>}
      {live && actionError && !editing && <p role="alert" className="mb-3 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-mist-400">{live && liveCatalog.loading ? "Loading… · " : ""}{rows.length} records · {rows.filter((r) => r.active !== false && r.status !== "Inactive").length} active</p>
        <Button className="text-xs" onClick={openAdd}><Plus size={13} /> {def.addTitle}</Button>
      </div>

      <Table columns={[...def.columns.map((c) => c.label), "Status", ""]}>
        {rows.map((r, i) => {
          const inactive = r.active === false || r.status === "Inactive";
          return (
            <Row key={rowId(r)} index={i}>
              {def.columns.map((c) => (
                <Cell key={c.key} className={cn(c.key === "name" && "font-semibold text-mist-900", inactive && "opacity-40")}>
                  {renderCell(def, c.key, r[c.key], c.kind)}
                </Cell>
              ))}
              <Cell>
                <Badge tone={inactive ? "mist" : "brand"}>{inactive ? "Inactive" : "Active"}</Badge>
              </Cell>
              <Cell>
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => openEdit(r)} className="btn-ghost px-2 py-1 text-xs"><Pencil size={12} /> Edit</button>
                  <button
                    disabled={busy}
                    onClick={() => toggle(r)}
                    className={cn("px-2 py-1 text-xs", inactive ? "btn-soft" : "btn-action")}
                  >
                    {inactive ? "Reactivate" : "Deactivate"}
                  </button>
                </div>
              </Cell>
            </Row>
          );
        })}
      </Table>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && Object.keys(editing).length ? `Edit — ${def.tab}` : def.addTitle}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={busy} onClick={save}>{busy ? "Saving…" : editing && Object.keys(editing).length ? "Save Changes" : "Add"}</Button>
          </>
        }
      >
        {live && actionError && <p role="alert" className="mb-3 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
        {live && def.key === "users" && !isEdit && <p className="mb-3 rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Sabi ID emails them an invitation to join with this role. Inviting needs a recent MFA check on your account.</p>}
        <Grid cols={2}>
          {formFields.map((f) =>
            f.type === "checkbox" ? (
              <div key={f.key} className="flex items-end">
                <Checkbox
                  label={f.label}
                  checked={!!form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.checked }))}
                />
              </div>
            ) : (
              <Field key={f.key} label={f.label}>
                {f.type === "select" ? (
                  <Select
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    options={f.options ?? []}
                  />
                ) : (
                  <Input
                    type={f.type}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, [f.key]: f.type === "number" ? +e.target.value : e.target.value }))
                    }
                  />
                )}
              </Field>
            ),
          )}
        </Grid>
      </Modal>
    </div>
  );
}
