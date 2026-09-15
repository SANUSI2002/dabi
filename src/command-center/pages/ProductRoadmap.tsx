import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Columns3, Download, Eye, FileText, GanttChart, Globe2, Link2, List, MessageSquare, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { hasPermission } from "../access";
import { useCommandCenter } from "../useCommandCenter";
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, MetricCard, Panel, StatusPill } from "../components/ui";
import { useAuth } from "@/store/useAuth";
import type { RoadmapItem, RoadmapItemDraft, RoadmapPublicationStatus } from "@/roadmap/domain";
import { roadmapService } from "@/roadmap/service";
import { useRoadmap } from "@/roadmap/useRoadmap";
import { previewRoadmapPublicDTO } from "@/roadmap/publicDto";
import { RoadmapBoard, type RoadmapBoardItem, type RoadmapView } from "@/roadmap/components/RoadmapBoard";

const ITEM_TYPES = ["FEATURE", "IMPROVEMENT", "INITIATIVE", "RESEARCH", "INFRASTRUCTURE", "SECURITY", "INTEGRATION", "MIGRATION", "BUG_FIX", "COMPLIANCE", "EXPERIMENT"] as const;
const STATUSES = ["IDEA", "RESEARCH", "PLANNED", "DESIGN", "IN_PROGRESS", "BETA", "RELEASE_CANDIDATE", "RELEASED", "DELAYED", "POSTPONED", "CANCELLED"] as const;
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function exportCsv(filename: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function emptyDraft(productId: string, moduleId?: string): RoadmapItemDraft {
  return {
    organizationId: "org-sabi", productId, moduleId, type: "FEATURE", title: "", internalDescription: "",
    status: "PLANNED", progress: 0, priority: "P2", confidence: "MEDIUM", health: "ON_TRACK",
    visibility: "INTERNAL", publicationStatus: "DRAFT",
  };
}

function editable(item: RoadmapItem): RoadmapItemDraft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, updatedBy: _updatedBy, ...draft } = item;
  return draft;
}

export default function ProductRoadmap() {
  const command = useCommandCenter();
  const roadmap = useRoadmap();
  const userId = useAuth((state) => state.identity?.platformUserId);
  const user = command.platformUsers.find((entry) => entry.id === userId);
  const [view, setView] = useState<RoadmapView>("GANTT");
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [health, setHealth] = useState("all");
  const [publication, setPublication] = useState("all");
  const [releaseId, setReleaseId] = useState("all");
  const [groupByRelease, setGroupByRelease] = useState(false);
  const [form, setForm] = useState<RoadmapItemDraft | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");

  if (!user || !hasPermission(user, "roadmap.view")) return <Panel><div className="p-8 text-sm text-slate-600">You do not have permission to view Product Roadmap.</div></Panel>;

  const visibleItems = roadmapService.listInternal(user);
  const filtered = visibleItems.filter((item) => {
    const needle = query.trim().toLowerCase();
    return (productId === "all" || item.productId === productId)
      && (moduleId === "all" || item.moduleId === moduleId)
      && (status === "all" || item.status === status)
      && (visibility === "all" || item.visibility === visibility)
      && (health === "all" || item.health === health)
      && (publication === "all" || item.publicationStatus === publication)
      && (releaseId === "all" || (releaseId === "unscheduled" ? !item.releaseId : item.releaseId === releaseId))
      && (!needle || `${item.id} ${item.title} ${item.internalDescription} ${item.ownerName ?? ""} ${roadmap.releases.find((release) => release.id === item.releaseId)?.name ?? ""}`.toLowerCase().includes(needle));
  });
  const modules = command.modules.filter((module) => productId === "all" || module.productId === productId);
  const boardItems: RoadmapBoardItem[] = filtered.map((item) => ({
    id: item.id, parentId: item.parentId, title: item.title, productName: command.products.find((product) => product.id === item.productId)?.name ?? item.productId,
    moduleName: command.modules.find((module) => module.id === item.moduleId)?.name, status: item.status, progress: item.progress,
    releaseName: roadmap.releases.find((release) => release.id === item.releaseId)?.name,
    priority: item.priority, ownerName: item.ownerName, health: item.health, visibility: item.visibility, publicationStatus: item.publicationStatus,
    startDate: item.startDate, targetDate: item.targetDate,
  }));
  const selected = roadmap.items.find((item) => item.id === (searchParams.get("item") ?? selectedId));
  const publicPreview = selected ? previewRoadmapPublicDTO(selected, command.products, command.modules, roadmap.releases) : undefined;
  const selectedMilestone = selected ? roadmap.milestones.find((entry) => entry.id === selected.milestoneId) : undefined;
  const selectedDependencies = selected ? roadmap.dependencies.filter((entry) => entry.sourceItemId === selected.id || entry.targetItemId === selected.id) : [];
  const selectedComments = selected ? roadmap.comments.filter((entry) => entry.itemId === selected.id) : [];
  const active = roadmap.items.filter((item) => !["RELEASED", "CANCELLED"].includes(item.status) && item.publicationStatus !== "ARCHIVED");
  const atRisk = active.filter((item) => ["AT_RISK", "OFF_TRACK"].includes(item.health)).length;
  const published = roadmap.items.filter((item) => item.publicationStatus === "PUBLISHED").length;

  const openCreate = () => {
    setEditingId(undefined); setForm(emptyDraft(command.products[0]?.id ?? "")); setError("");
  };
  const openEdit = (item: RoadmapItem) => {
    setSelectedId(undefined); setSearchParams({}, { replace: true }); setEditingId(item.id); setForm(editable(item)); setError("");
  };
  const save = () => {
    if (!form) return;
    const result = editingId ? roadmapService.update(editingId, form, user, "Roadmap plan updated") : roadmapService.create(form, user);
    if (!result.ok) { setError(result.error); return; }
    setForm(null); setEditingId(undefined); setMessage(editingId ? "Roadmap item updated and audited." : "Roadmap item created.");
  };
  const transition = (next: RoadmapPublicationStatus) => {
    if (!selected) return;
    const result = roadmapService.transitionPublication(selected.id, next, user, `Publication workflow: ${next}`);
    if (!result.ok) { setError(result.error); return; }
    setMessage(`Publication status changed to ${pretty(next)}.`); setError("");
  };
  const exportRoadmap = () => exportCsv(`sabi-product-roadmap-${new Date().toISOString().slice(0, 10)}.csv`, [["ID", "Product", "Module", "Title", "Status", "Progress", "Priority", "Health", "Visibility", "Publication", "Release", "Milestone", "Target"], ...filtered.map((item) => [item.id, command.products.find((entry) => entry.id === item.productId)?.name, command.modules.find((entry) => entry.id === item.moduleId)?.name, item.title, item.status, item.progress, item.priority, item.health, item.visibility, item.publicationStatus, roadmap.releases.find((entry) => entry.id === item.releaseId)?.name, roadmap.milestones.find((entry) => entry.id === item.milestoneId)?.name, item.targetDate])]);
  const createAndAssignMilestone = () => { if (!selected) return; const name = window.prompt("Milestone name"); if (!name) return; const targetDate = window.prompt("Target date (YYYY-MM-DD)", selected.targetDate ?? "") || undefined; const created = roadmapService.createMilestone(selected.productId, name, targetDate, user); if (!created.ok) return setError(created.error); const assigned = roadmapService.assignItemToMilestone(selected.id, created.id, user, "Created and assigned milestone"); if (!assigned.ok) return setError(assigned.error); setMessage("Milestone created and assigned."); setError(""); };
  const addDependency = () => { if (!selected) return; const candidates = roadmap.items.filter((item) => item.id !== selected.id).map((item) => `${item.id}: ${item.title}`).join("\n"); const targetId = window.prompt(`Target roadmap item ID:\n${candidates}`); if (!targetId) return; const type = (window.prompt("Dependency type: BLOCKED_BY, DEPENDS_ON, RELATED_TO, or REQUIRES", "DEPENDS_ON") ?? "DEPENDS_ON") as "BLOCKED_BY" | "DEPENDS_ON" | "RELATED_TO" | "REQUIRES"; const result = roadmapService.addDependency(selected.id, targetId, type, user); if (!result.ok) return setError(result.error); setMessage("Dependency added."); setError(""); };
  const postComment = () => { if (!selected) return; const result = roadmapService.addComment(selected.id, comment, user); if (!result.ok) return setError(result.error); setComment(""); setMessage("Comment added."); setError(""); };

  return <div>
    <CommandPageHeader eyebrow="Product Management" title="Product Roadmap" description="One source of truth for internal planning and carefully controlled public publication." actions={<>{hasPermission(user, "roadmap.export") && <CommandButton variant="secondary" onClick={exportRoadmap}><Download size={15} /> Export</CommandButton>}{hasPermission(user, "roadmap.create") && <CommandButton onClick={openCreate}><Plus size={15} /> Add roadmap item</CommandButton>}</>} />
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard label="Active" value={active.length} hint="initiatives" />
      <MetricCard label="In progress" value={active.filter((item) => item.status === "IN_PROGRESS").length} />
      <MetricCard label="At risk" value={atRisk} />
      <MetricCard label="Blocked" value={active.filter((item) => item.health === "BLOCKED").length} />
      <MetricCard label="Beta" value={active.filter((item) => item.status === "BETA").length} />
      <MetricCard label="Released" value={roadmap.items.filter((item) => item.status === "RELEASED").length} hint="all time" />
      <MetricCard label="Public" value={published} hint="published" />
      <MetricCard label="Internal" value={roadmap.items.filter((item) => item.visibility === "INTERNAL").length} />
    </div>

    <Panel className="mb-4">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput value={query} onChange={(event) => setQuery(event.target.value)} className="w-full pl-9" placeholder="Search title, description, owner or roadmap ID" /></div>
        <CommandSelect aria-label="Product" value={productId} onChange={(event) => { setProductId(event.target.value); setModuleId("all"); }}><option value="all">All products</option>{command.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</CommandSelect>
        <CommandSelect aria-label="Module" value={moduleId} onChange={(event) => setModuleId(event.target.value)}><option value="all">All modules</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</CommandSelect>
        <CommandSelect aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{STATUSES.map((entry) => <option key={entry}>{entry}</option>)}</CommandSelect>
        <CommandSelect aria-label="Visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="all">All visibility</option><option>INTERNAL</option><option>PUBLIC</option><option>CUSTOMER</option><option>BETA_CUSTOMER</option></CommandSelect>
        <CommandSelect aria-label="Health" value={health} onChange={(event) => setHealth(event.target.value)}><option value="all">All health</option><option>ON_TRACK</option><option>AT_RISK</option><option>OFF_TRACK</option><option>BLOCKED</option></CommandSelect>
        <CommandSelect aria-label="Publication" value={publication} onChange={(event) => setPublication(event.target.value)}><option value="all">All publication</option><option>DRAFT</option><option>READY_FOR_REVIEW</option><option>APPROVED</option><option>PUBLISHED</option><option>UNPUBLISHED</option><option>ARCHIVED</option></CommandSelect>
        <CommandSelect aria-label="Release" value={releaseId} onChange={(event) => setReleaseId(event.target.value)}><option value="all">All releases</option><option value="unscheduled">Unscheduled</option>{roadmap.releases.map((release) => <option key={release.id} value={release.id}>{release.name}</option>)}</CommandSelect>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2"><span className="text-xs text-slate-400">{filtered.length} of {roadmap.items.length} items</span><div className="flex flex-wrap items-center gap-2"><label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><input type="checkbox" checked={groupByRelease} onChange={(event) => setGroupByRelease(event.target.checked)} /> Group by release</label><div className="flex rounded-lg bg-slate-100 p-1"><ViewButton active={view === "GANTT"} onClick={() => setView("GANTT")} icon={<GanttChart size={14} />} label="Gantt" /><ViewButton active={view === "LIST"} onClick={() => setView("LIST")} icon={<List size={14} />} label="List" /><ViewButton active={view === "KANBAN"} onClick={() => setView("KANBAN")} icon={<Columns3 size={14} />} label="Kanban" /></div></div></div>
    </Panel>
    {groupByRelease ? <div className="space-y-5">{[...new Set(boardItems.map((item) => item.releaseName ?? "Unscheduled"))].map((releaseName) => <section key={releaseName}><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-bold text-slate-800">{releaseName}</h2><span className="text-xs text-slate-400">{boardItems.filter((item) => (item.releaseName ?? "Unscheduled") === releaseName).length} items</span></div><RoadmapBoard items={boardItems.filter((item) => (item.releaseName ?? "Unscheduled") === releaseName)} view={view} onSelect={setSelectedId} /></section>)}</div> : <RoadmapBoard items={boardItems} view={view} onSelect={setSelectedId} />}

    <Modal open={!!form} onClose={() => setForm(null)} title={editingId ? "Edit roadmap item" : "Add roadmap item"} wide footer={<><CommandButton variant="secondary" onClick={() => setForm(null)}>Cancel</CommandButton><CommandButton onClick={save}>Save roadmap item</CommandButton></>}>
      {form && <RoadmapForm form={form} setForm={setForm} products={command.products} modules={command.modules} items={roadmap.items} />}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
    </Modal>

    <Modal open={!!selected} onClose={() => { setSelectedId(undefined); setSearchParams({}, { replace: true }); setError(""); }} title={selected?.title ?? "Roadmap item"} wide footer={selected && <><CommandButton variant="secondary" onClick={() => openEdit(selected)}>Edit</CommandButton>{selected.publicationStatus === "DRAFT" && <CommandButton onClick={() => transition("READY_FOR_REVIEW")}>Submit for review</CommandButton>}{selected.publicationStatus === "READY_FOR_REVIEW" && <CommandButton onClick={() => transition("APPROVED")}>Approve</CommandButton>}{selected.publicationStatus === "APPROVED" && <CommandButton onClick={() => transition("PUBLISHED")}>Publish</CommandButton>}{selected.publicationStatus === "PUBLISHED" && <CommandButton variant="danger" onClick={() => transition("UNPUBLISHED")}>Unpublish</CommandButton>}{selected.publicationStatus === "UNPUBLISHED" && <CommandButton onClick={() => transition("READY_FOR_REVIEW")}>Submit again</CommandButton>}</>}>
      {selected && <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><StatusPill status={pretty(selected.status)} /><StatusPill status={pretty(selected.visibility)} /><StatusPill status={pretty(selected.publicationStatus)} /><StatusPill status={pretty(selected.health)} /></div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><Detail label="Product" value={command.products.find((product) => product.id === selected.productId)?.name ?? selected.productId} /><Detail label="Module" value={command.modules.find((module) => module.id === selected.moduleId)?.name ?? "Product-wide"} /><Detail label="Release" value={roadmap.releases.find((release) => release.id === selected.releaseId)?.name ?? "Unscheduled"} /><Detail label="Owner" value={selected.ownerName ?? "Unassigned"} /><Detail label="Priority" value={selected.priority} /><Detail label="Progress" value={`${selected.progress}%`} /><Detail label="Target" value={selected.targetDate ?? "No target"} /></div>
        <section><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Internal description</h3><p className="mt-2 text-sm leading-6 text-slate-700">{selected.internalDescription || "No internal description."}</p></section>
        {(selected.riskReason || selected.mitigation) && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">Delivery risk</h3><p className="mt-2 text-sm text-amber-900">{selected.riskReason}</p>{selected.mitigation && <p className="mt-2 text-xs text-amber-700"><b>Mitigation:</b> {selected.mitigation}</p>}</section>}
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><div className="mb-3 flex items-center gap-2"><Eye size={15} className="text-emerald-700" /><h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Public-safe preview</h3></div>{publicPreview ? <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{publicPreview.product.name} · {publicPreview.module?.name ?? "Product"}</p><h4 className="mt-2 font-display text-lg font-bold text-slate-950">{publicPreview.title}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{publicPreview.summary}</p><div className="mt-4 flex items-center gap-3 text-xs font-semibold text-slate-600"><StatusPill status={publicPreview.status} /><span>Expected {publicPreview.timeframe}</span></div></div> : <p className="text-sm text-emerald-900">Add public title, summary and timeframe to prepare a safe preview. Internal fields are never included.</p>}</section>
        <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Milestone</h3><p className="mt-2 text-sm font-semibold text-slate-800">{selectedMilestone?.name ?? "No milestone assigned"}</p>{selectedMilestone?.targetDate && <p className="text-xs text-slate-400">Target {selectedMilestone.targetDate}</p>}</div>{hasPermission(user, "roadmap.manage_dates") && <CommandButton variant="secondary" onClick={createAndAssignMilestone}>{selectedMilestone ? "Change" : "Add"}</CommandButton>}</div></section><section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Link2 size={13} /> Dependencies</h3><p className="mt-2 text-sm text-slate-600">{selectedDependencies.length} linked item{selectedDependencies.length === 1 ? "" : "s"}</p></div>{hasPermission(user, "roadmap.edit") && <CommandButton variant="secondary" onClick={addDependency}>Add</CommandButton>}</div><div className="mt-3 divide-y divide-slate-100">{selectedDependencies.map((dependency) => { const otherId = dependency.sourceItemId === selected.id ? dependency.targetItemId : dependency.sourceItemId; return <div key={dependency.id} className="py-2 text-xs"><b>{pretty(dependency.type)}</b> · {roadmap.items.find((item) => item.id === otherId)?.title ?? otherId}</div>; })}</div></section></div>
        <section className="rounded-xl border border-slate-200"><h3 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500"><MessageSquare size={13} /> Team comments</h3><div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">{selectedComments.map((entry) => <div key={entry.id} className="px-4 py-3"><p className="text-sm text-slate-700">{entry.body}</p><p className="mt-1 text-[10px] text-slate-400">{entry.authorName} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}{!selectedComments.length && <p className="p-4 text-sm text-slate-500">No comments yet.</p>}</div>{hasPermission(user, "roadmap.comment") && <div className="flex gap-2 border-t border-slate-100 p-3"><CommandInput className="min-w-0 flex-1" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a delivery comment" /><CommandButton onClick={postComment}>Comment</CommandButton></div>}</section>
        <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-slate-200"><h3 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Activity</h3><div className="max-h-48 divide-y divide-slate-100 overflow-y-auto">{roadmap.activities.filter((entry) => entry.itemId === selected.id).map((entry) => <div key={entry.id} className="px-4 py-3"><p className="text-xs font-semibold text-slate-700">{entry.detail}</p><p className="mt-1 text-[10px] text-slate-400">{entry.actorName} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}</div></section><section className="rounded-xl border border-slate-200"><h3 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Immutable audit trail</h3><div className="max-h-48 divide-y divide-slate-100 overflow-y-auto">{roadmap.auditRecords.filter((entry) => entry.itemId === selected.id).map((entry) => <div key={entry.id} className="px-4 py-3"><p className="text-xs font-semibold text-slate-700">{pretty(entry.action)}</p><p className="mt-1 text-[10px] text-slate-400">{entry.actorName} · {entry.actorRole} · {new Date(entry.timestamp).toLocaleString()}</p>{entry.reason && <p className="mt-1 text-[10px] text-slate-500">{entry.reason}</p>}</div>)}</div></section></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      </div>}
    </Modal>
  </div>;
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{icon}{label}</button>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>; }

function RoadmapForm({ form, setForm, products, modules, items }: { form: RoadmapItemDraft; setForm: (form: RoadmapItemDraft) => void; products: ReturnType<typeof useCommandCenter.getState>["products"]; modules: ReturnType<typeof useCommandCenter.getState>["modules"]; items: RoadmapItem[] }) {
  const patch = (value: Partial<RoadmapItemDraft>) => setForm({ ...form, ...value });
  const productModules = modules.filter((module) => module.productId === form.productId);
  const parents = items.filter((item) => item.id !== form.parentId && item.productId === form.productId && item.moduleId === form.moduleId && !item.parentId);
  return <div className="space-y-6">
    <FormSection icon={<FileText size={15} />} title="Basic information"><div className="grid gap-4 sm:grid-cols-2"><Field label="Product *"><CommandSelect className="w-full" value={form.productId} onChange={(event) => patch({ productId: event.target.value, moduleId: undefined, parentId: undefined })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</CommandSelect></Field><Field label="Module"><CommandSelect className="w-full" value={form.moduleId ?? ""} onChange={(event) => patch({ moduleId: event.target.value || undefined, parentId: undefined })}><option value="">Product-wide</option>{productModules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</CommandSelect></Field><Field label="Parent feature"><CommandSelect className="w-full" value={form.parentId ?? ""} onChange={(event) => patch({ parentId: event.target.value || undefined })}><option value="">Top-level item</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</CommandSelect></Field><Field label="Type *"><CommandSelect className="w-full" value={form.type} onChange={(event) => patch({ type: event.target.value as RoadmapItemDraft["type"] })}>{ITEM_TYPES.map((item) => <option key={item}>{item}</option>)}</CommandSelect></Field></div><Field label="Internal title *"><CommandInput autoFocus className="w-full" value={form.title} onChange={(event) => patch({ title: event.target.value })} /></Field><Field label="Internal description"><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={form.internalDescription} onChange={(event) => patch({ internalDescription: event.target.value })} /></Field></FormSection>
    <FormSection icon={<Sparkles size={15} />} title="Planning"><div className="grid gap-4 sm:grid-cols-3"><Field label="Status"><CommandSelect className="w-full" value={form.status} onChange={(event) => patch({ status: event.target.value as RoadmapItemDraft["status"], ...(event.target.value === "RELEASED" ? { progress: 100 } : {}) })}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</CommandSelect></Field><Field label="Priority"><CommandSelect className="w-full" value={form.priority} onChange={(event) => patch({ priority: event.target.value as RoadmapItemDraft["priority"] })}>{["P0", "P1", "P2", "P3", "P4"].map((item) => <option key={item}>{item}</option>)}</CommandSelect></Field><Field label={`Progress · ${form.progress}%`}><input className="h-9 w-full accent-emerald-600" type="range" min="0" max="100" value={form.progress} onChange={(event) => patch({ progress: Number(event.target.value) })} /></Field><Field label="Owner"><CommandInput className="w-full" value={form.ownerName ?? ""} onChange={(event) => patch({ ownerName: event.target.value || undefined })} /></Field><Field label="Start date"><CommandInput className="w-full" type="date" value={form.startDate ?? ""} onChange={(event) => patch({ startDate: event.target.value || undefined })} /></Field><Field label="Target date"><CommandInput className="w-full" type="date" value={form.targetDate ?? ""} onChange={(event) => patch({ targetDate: event.target.value || undefined })} /></Field><Field label="Confidence"><CommandSelect className="w-full" value={form.confidence} onChange={(event) => patch({ confidence: event.target.value as RoadmapItemDraft["confidence"] })}><option>HIGH</option><option>MEDIUM</option><option>LOW</option></CommandSelect></Field><Field label="Health"><CommandSelect className="w-full" value={form.health} onChange={(event) => patch({ health: event.target.value as RoadmapItemDraft["health"] })}><option>ON_TRACK</option><option>AT_RISK</option><option>OFF_TRACK</option><option>BLOCKED</option></CommandSelect></Field></div></FormSection>
    <FormSection icon={<Globe2 size={15} />} title="Public communication"><div className="grid gap-4 sm:grid-cols-2"><Field label="Visibility"><CommandSelect className="w-full" value={form.visibility} onChange={(event) => patch({ visibility: event.target.value as RoadmapItemDraft["visibility"], publicationStatus: "DRAFT" })}><option>INTERNAL</option><option>PUBLIC</option><option>CUSTOMER</option><option>BETA_CUSTOMER</option></CommandSelect></Field><Field label="Public timeframe mode"><CommandSelect className="w-full" value={form.publicContent?.timeframeMode ?? "QUARTER"} onChange={(event) => patch({ publicContent: { ...(form.publicContent ?? { title: "", summary: "", timeframeLabel: "", showProgress: false }), timeframeMode: event.target.value as NonNullable<RoadmapItemDraft["publicContent"]>["timeframeMode"] } })}><option>EXACT_DATE</option><option>MONTH</option><option>QUARTER</option><option>HALF_YEAR</option><option>YEAR</option><option>COMING_SOON</option><option>NO_DATE</option></CommandSelect></Field></div><Field label="Public title"><CommandInput className="w-full" value={form.publicContent?.title ?? ""} onChange={(event) => patch({ publicContent: { ...(form.publicContent ?? { summary: "", timeframeMode: "QUARTER", timeframeLabel: "", showProgress: false }), title: event.target.value } })} /></Field><Field label="Public summary"><textarea className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={form.publicContent?.summary ?? ""} onChange={(event) => patch({ publicContent: { ...(form.publicContent ?? { title: "", timeframeMode: "QUARTER", timeframeLabel: "", showProgress: false }), summary: event.target.value } })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Public timeframe"><CommandInput className="w-full" placeholder="e.g. Q4 2026 or Coming soon" value={form.publicContent?.timeframeLabel ?? ""} onChange={(event) => patch({ publicContent: { ...(form.publicContent ?? { title: "", summary: "", timeframeMode: "QUARTER", showProgress: false }), timeframeLabel: event.target.value } })} /></Field><label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.publicContent?.showProgress ?? false} onChange={(event) => patch({ publicContent: { ...(form.publicContent ?? { title: "", summary: "", timeframeMode: "QUARTER", timeframeLabel: "" }), showProgress: event.target.checked } })} /> Show progress publicly</label></div><p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><ShieldCheck size={14} className="mr-2 inline" />Changing visibility to Public never publishes automatically. Public content must pass review and explicit publication.</p></FormSection>
  </div>;
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section><div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">{icon}{title}</div><div className="space-y-4">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="cc-label">{label}</span>{children}</label>; }
