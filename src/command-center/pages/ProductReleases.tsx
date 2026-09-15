import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck2, CheckCircle2, History, Map, PackageCheck, Plus, Rocket, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/store/useAuth";
import type { RoadmapRelease, RoadmapReleaseDraft } from "@/roadmap/domain";
import { roadmapService } from "@/roadmap/service";
import { useRoadmap } from "@/roadmap/useRoadmap";
import { hasPermission } from "../access";
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, MetricCard, Panel, StatusPill } from "../components/ui";
import { useCommandCenter } from "../useCommandCenter";

const RELEASE_STATUSES = ["PLANNED", "IN_PROGRESS", "CANCELLED"] as const;
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Not set";
const formatTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function emptyRelease(productId: string): RoadmapReleaseDraft {
  return { organizationId: "org-sabi", productId, version: "", name: "", description: "", status: "PLANNED" };
}

function editable(release: RoadmapRelease): RoadmapReleaseDraft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, updatedBy: _updatedBy, ...draft } = release;
  return draft;
}

export default function ProductReleases() {
  const command = useCommandCenter();
  const roadmap = useRoadmap();
  const userId = useAuth((state) => state.identity?.platformUserId);
  const user = command.platformUsers.find((entry) => entry.id === userId);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<RoadmapReleaseDraft | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [changeReason, setChangeReason] = useState("");
  const [scopeReason, setScopeReason] = useState("");
  const [shipReleaseId, setShipReleaseId] = useState<string>();
  const [shipForm, setShipForm] = useState({ actualReleaseDate: new Date().toISOString().slice(0, 10), releaseNotes: "", publicReleaseNotes: "", reason: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!user || !hasPermission(user, "roadmap.view")) return <Panel><div className="p-8 text-sm text-slate-600">You do not have permission to view releases.</div></Panel>;

  const canManage = hasPermission(user, "roadmap.manage_releases");
  const releases = roadmapService.listReleases(user);
  const filtered = releases.filter((release) => {
    const product = command.products.find((entry) => entry.id === release.productId);
    const needle = query.trim().toLowerCase();
    return (productId === "all" || release.productId === productId)
      && (status === "all" || release.status === status)
      && (!needle || `${release.version} ${release.name} ${release.description} ${product?.name ?? ""}`.toLowerCase().includes(needle));
  });
  const selected = releases.find((release) => release.id === selectedId);
  const shipping = releases.find((release) => release.id === shipReleaseId);
  const selectedItems = selected ? roadmap.items.filter((item) => item.releaseId === selected.id) : [];
  const availableItems = selected ? roadmap.items.filter((item) => item.productId === selected.productId && item.releaseId !== selected.id && item.status !== "RELEASED") : [];
  const history = selected ? roadmap.releaseHistory.filter((entry) => entry.releaseId === selected.id) : [];
  const assignedCount = roadmap.items.filter((item) => item.releaseId).length;
  const readinessFor = (release: RoadmapRelease | undefined) => {
    const items = release ? roadmap.items.filter((item) => item.releaseId === release.id) : [];
    const ids = new Set(items.map((item) => item.id));
    const blockers = roadmap.dependencies.filter((dependency) => ids.has(dependency.sourceItemId) && dependency.type !== "RELATED_TO" && !ids.has(dependency.targetItemId) && roadmap.items.find((item) => item.id === dependency.targetItemId)?.status !== "RELEASED");
    return [
      { label: "Release scope contains at least one item", ready: items.length > 0 },
      { label: "No unresolved external dependencies", ready: blockers.length === 0 },
      { label: "Target or actual date is recorded", ready: !!(release?.targetDate || release?.actualReleaseDate) },
      { label: "Public summary is ready when scope is public", ready: !items.some((item) => item.publicationStatus === "PUBLISHED") || !!release?.publicSummary },
    ];
  };
  const selectedReadiness = readinessFor(selected);
  const shippingReadiness = readinessFor(shipping);

  const openCreate = () => {
    setEditingId(undefined); setChangeReason(""); setError(""); setForm(emptyRelease(command.products[0]?.id ?? ""));
  };
  const openEdit = (release: RoadmapRelease) => {
    setSelectedId(undefined); setEditingId(release.id); setChangeReason(""); setError(""); setForm(editable(release));
  };
  const save = () => {
    if (!form) return;
    const result = editingId ? roadmapService.updateRelease(editingId, form, user, changeReason) : roadmapService.createRelease(form, user);
    if (!result.ok) { setError(result.error); return; }
    setForm(null); setEditingId(undefined); setChangeReason(""); setError(""); setMessage(editingId ? "Release updated and change history recorded." : "Release created and audited.");
  };
  const changeScope = (itemId: string, releaseId: string | undefined) => {
    const result = roadmapService.assignItemToRelease(itemId, releaseId, user, scopeReason);
    if (!result.ok) { setError(result.error); return; }
    setScopeReason(""); setError(""); setMessage(releaseId ? "Roadmap item assigned to the release." : "Roadmap item removed from the release.");
  };
  const openShip = (release: RoadmapRelease) => {
    setSelectedId(undefined); setError(""); setShipReleaseId(release.id);
    setShipForm({ actualReleaseDate: new Date().toISOString().slice(0, 10), releaseNotes: "", publicReleaseNotes: release.publicReleaseNotes ?? "", reason: "" });
  };
  const ship = () => {
    if (!shipping) return;
    const result = roadmapService.shipRelease(shipping.id, shipForm.actualReleaseDate, shipForm.releaseNotes, shipForm.publicReleaseNotes, user, shipForm.reason);
    if (!result.ok) { setError(result.error); return; }
    setShipReleaseId(undefined); setError(""); setMessage(`${shipping.name} shipped. Assigned roadmap items and the public Released view are updated.`);
  };

  return <div>
    <CommandPageHeader eyebrow="Product Management" title="Releases" description="Plan versioned product releases, control scope, preserve target history and ship roadmap items through one audited workflow." actions={<><Link to="/command-center/roadmap" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Map size={15} /> Roadmap</Link>{canManage && <CommandButton onClick={openCreate}><Plus size={15} /> New release</CommandButton>}</>} />
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
      <MetricCard label="All releases" value={releases.length} icon={<PackageCheck size={15} />} />
      <MetricCard label="Planned" value={releases.filter((release) => release.status === "PLANNED").length} />
      <MetricCard label="In progress" value={releases.filter((release) => release.status === "IN_PROGRESS").length} />
      <MetricCard label="Shipped" value={releases.filter((release) => release.status === "SHIPPED").length} icon={<Rocket size={15} />} />
      <MetricCard label="Scheduled items" value={assignedCount} hint="roadmap scope" />
    </div>
    <Panel className="mb-4"><div className="flex flex-wrap gap-2 p-3"><label className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search version, name or product" /></label><CommandSelect value={productId} onChange={(event) => setProductId(event.target.value)}><option value="all">All products</option>{command.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</CommandSelect><CommandSelect value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{["PLANNED", "IN_PROGRESS", "SHIPPED", "CANCELLED"].map((entry) => <option key={entry} value={entry}>{pretty(entry)}</option>)}</CommandSelect></div></Panel>
    <Panel><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="cc-th">Release</th><th className="cc-th">Product</th><th className="cc-th">Target</th><th className="cc-th">Scope</th><th className="cc-th">Public label</th><th className="cc-th">Status</th><th className="cc-th"></th></tr></thead><tbody>{filtered.map((release) => { const scope = roadmap.items.filter((item) => item.releaseId === release.id); return <tr key={release.id} className="border-t border-slate-100"><td className="cc-td"><button type="button" onClick={() => { setSelectedId(release.id); setScopeReason(""); setError(""); }} className="text-left"><span className="block font-bold text-slate-900 hover:text-emerald-700">{release.name}</span><span className="font-mono text-[10px] text-slate-400">v{release.version}</span></button></td><td className="cc-td">{command.products.find((product) => product.id === release.productId)?.name ?? release.productId}</td><td className="cc-td"><span className="inline-flex items-center gap-1.5"><CalendarCheck2 size={13} className="text-slate-400" />{formatDate(release.actualReleaseDate ?? release.targetDate)}</span></td><td className="cc-td">{scope.length} item{scope.length === 1 ? "" : "s"}</td><td className="cc-td">{release.publicName || <span className="text-slate-400">Internal only</span>}</td><td className="cc-td"><StatusPill status={pretty(release.status)} /></td><td className="cc-td"><CommandButton variant="quiet" onClick={() => { setSelectedId(release.id); setScopeReason(""); setError(""); }}>Open</CommandButton></td></tr>; })}{filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-500">No releases match these filters.</td></tr>}</tbody></table></div></Panel>

    <Modal open={!!form} onClose={() => { setForm(null); setError(""); }} title={editingId ? "Edit release" : "Create release"} wide footer={<><CommandButton variant="secondary" onClick={() => setForm(null)}>Cancel</CommandButton><CommandButton onClick={save}>{editingId ? "Save changes" : "Create release"}</CommandButton></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2">
        {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <Field label="Product"><CommandSelect className="w-full" value={form.productId} disabled={!!editingId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>{command.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</CommandSelect></Field>
        <Field label="Version"><CommandInput className="w-full" value={form.version} disabled={!!editingId && releases.find((release) => release.id === editingId)?.status === "SHIPPED"} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="2026.Q4" /></Field>
        <Field label="Internal release name"><CommandInput className="w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Sabi EMR Q4 2026" /></Field>
        <Field label="Target date"><CommandInput className="w-full" type="date" value={form.targetDate ?? ""} disabled={!!editingId && releases.find((release) => release.id === editingId)?.status === "SHIPPED"} onChange={(event) => setForm({ ...form, targetDate: event.target.value || undefined })} /></Field>
        <Field label="Status"><CommandSelect className="w-full" value={form.status} disabled={!!editingId && releases.find((release) => release.id === editingId)?.status === "SHIPPED"} onChange={(event) => setForm({ ...form, status: event.target.value as RoadmapReleaseDraft["status"] })}>{RELEASE_STATUSES.map((entry) => <option key={entry} value={entry}>{pretty(entry)}</option>)}</CommandSelect></Field>
        <Field label="Public release name"><CommandInput className="w-full" value={form.publicName ?? ""} onChange={(event) => setForm({ ...form, publicName: event.target.value || undefined })} placeholder="Sabi EMR Q4 Update" /></Field>
        <Field label="Internal description" wide><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Public summary" wide><textarea className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" value={form.publicSummary ?? ""} onChange={(event) => setForm({ ...form, publicSummary: event.target.value || undefined })} /></Field>
        {editingId && <Field label="Reason for change" wide hint="Required. Stored in immutable release history and the central audit log."><CommandInput className="w-full" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Why is this release changing?" /></Field>}
      </div>}
    </Modal>

    <Modal open={!!selected} onClose={() => { setSelectedId(undefined); setError(""); }} title={selected?.name ?? "Release"} wide footer={selected && <>{canManage && selected.status !== "SHIPPED" && <CommandButton variant="secondary" onClick={() => openEdit(selected)}>Edit release</CommandButton>}{canManage && !["SHIPPED", "CANCELLED"].includes(selected.status) && <CommandButton onClick={() => openShip(selected)}><Rocket size={14} /> Ship release</CommandButton>}</>}>
      {selected && <div className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><Info label="Version" value={`v${selected.version}`} /><Info label="Product" value={command.products.find((product) => product.id === selected.productId)?.name ?? selected.productId} /><Info label="Status" value={<StatusPill status={pretty(selected.status)} />} /><Info label="Target date" value={formatDate(selected.targetDate)} /><Info label="Actual date" value={formatDate(selected.actualReleaseDate)} /><Info label="Public name" value={selected.publicName || "Not published"} /></div>
        <div className="rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Release readiness</h3><StatusPill status={selectedReadiness.every((item) => item.ready) ? "Ready" : "Needs attention"} /></div><div className="grid gap-2 p-4 sm:grid-cols-2">{selectedReadiness.map((item) => <div key={item.label} className="flex items-center gap-2 text-xs font-semibold text-slate-700">{item.ready ? <CheckCircle2 size={15} className="text-emerald-600" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-400" />}{item.label}</div>)}</div></div>
        <div><h3 className="text-sm font-bold text-slate-900">Release scope</h3><p className="mt-1 text-xs text-slate-500">Scope changes require a reason and are locked after shipping.</p>{canManage && selected.status !== "SHIPPED" && <CommandInput className="mt-3 w-full" value={scopeReason} onChange={(event) => setScopeReason(event.target.value)} placeholder="Reason for adding or removing an item" />}
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{selectedItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-400">{pretty(item.status)} · {item.progress}%</p></div>{canManage && selected.status !== "SHIPPED" && <CommandButton variant="quiet" onClick={() => changeScope(item.id, undefined)}>Remove</CommandButton>}</div>)}{selectedItems.length === 0 && <p className="p-4 text-sm text-slate-500">No roadmap items assigned yet.</p>}</div>
        </div>
        {canManage && selected.status !== "SHIPPED" && availableItems.length > 0 && <div><h3 className="text-sm font-bold text-slate-900">Available roadmap items</h3><div className="mt-3 max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">{availableItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-400">{item.releaseId ? "Move from another release" : "Unscheduled"}</p></div><CommandButton variant="secondary" onClick={() => changeScope(item.id, selected.id)}>Assign</CommandButton></div>)}</div></div>}
        <div><div className="flex items-center gap-2"><History size={15} className="text-slate-400" /><h3 className="text-sm font-bold text-slate-900">Immutable release history</h3></div><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{history.map((entry) => <div key={entry.id} className="p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-700">{pretty(entry.field)}</p><time className="text-[10px] text-slate-400">{formatTime(entry.timestamp)}</time></div><p className="mt-1 text-xs text-slate-500">{entry.actorName}{entry.reason ? ` · ${entry.reason}` : ""}</p></div>)}{history.length === 0 && <p className="p-4 text-sm text-slate-500">No release changes recorded in this browser yet.</p>}</div></div>
      </div>}
    </Modal>

    <Modal open={!!shipping} onClose={() => { setShipReleaseId(undefined); setError(""); }} title={`Ship ${shipping?.name ?? "release"}`} wide footer={<><CommandButton variant="secondary" onClick={() => setShipReleaseId(undefined)}>Cancel</CommandButton><CommandButton onClick={ship}><CheckCircle2 size={14} /> Confirm shipment</CommandButton></>}>
      {shipping && <div className="grid gap-4 sm:grid-cols-2">{error && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<p className="sm:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Shipping is final. It sets every assigned roadmap item to Released, progress to 100%, records the actual date, writes immutable audits and refreshes the public Released view.</p><div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">{shippingReadiness.map((item) => <div key={item.label} className="flex items-center gap-2 text-xs font-semibold text-slate-700">{item.ready ? <CheckCircle2 size={15} className="text-emerald-600" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-400" />}{item.label}</div>)}</div><Field label="Actual release date"><CommandInput className="w-full" type="date" value={shipForm.actualReleaseDate} onChange={(event) => setShipForm({ ...shipForm, actualReleaseDate: event.target.value })} /></Field><Field label="Reason"><CommandInput className="w-full" value={shipForm.reason} onChange={(event) => setShipForm({ ...shipForm, reason: event.target.value })} placeholder="Release approval / change reference" /></Field><Field label="Internal release notes" wide><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={shipForm.releaseNotes} onChange={(event) => setShipForm({ ...shipForm, releaseNotes: event.target.value })} /></Field><Field label="Public release notes" wide hint="Required when the release contains published roadmap items."><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={shipForm.publicReleaseNotes} onChange={(event) => setShipForm({ ...shipForm, publicReleaseNotes: event.target.value })} /></Field></div>}
    </Modal>
  </div>;
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="cc-label">{label}</span>{children}{hint && <span className="mt-1 block text-xs leading-5 text-slate-400">{hint}</span>}</label>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>;
}
