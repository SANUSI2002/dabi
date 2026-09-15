import { useMemo, useState } from "react";
import { CalendarDays, Columns3, GanttChart, List, Map as MapIcon, Search, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { RoadmapBoard, type RoadmapBoardItem, type RoadmapView } from "@/roadmap/components/RoadmapBoard";
import { usePublicRoadmap } from "@/roadmap/usePublicRoadmap";
import { cn } from "@/lib/cn";

export default function RoadmapPage() {
  const publicItems = usePublicRoadmap((state) => state.items);
  const [view, setView] = useState<RoadmapView>(() => typeof window !== "undefined" && window.innerWidth < 640 ? "LIST" : "GANTT");
  const [productId, setProductId] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [status, setStatus] = useState("all");
  const [section, setSection] = useState<"ALL" | "UPCOMING" | "RELEASED">("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const products = useMemo(() => [...new Map(publicItems.map((item) => [item.product.id, item.product])).values()], [publicItems]);
  const modules = useMemo(() => [...new Map(publicItems.filter((item) => productId === "all" || item.product.id === productId).flatMap((item) => item.module ? [[item.module.id, item.module] as const] : [])).values()], [productId, publicItems]);
  const filtered = publicItems.filter((item) => (productId === "all" || item.product.id === productId)
    && (moduleId === "all" || item.module?.id === moduleId)
    && (status === "all" || item.status === status)
    && (section === "ALL" || (section === "RELEASED" ? item.status === "Released" : item.status !== "Released"))
    && (!query.trim() || `${item.title} ${item.summary} ${item.product.name} ${item.module?.name ?? ""} ${item.release?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())));
  const boardItems: RoadmapBoardItem[] = filtered.map((item) => ({ id: item.id, parentId: item.parentPublicId, title: item.title, summary: item.summary, productName: item.product.name, moduleName: item.module?.name, releaseName: item.release?.name, status: item.status, progress: item.progress, timeframe: item.timeframe }));
  const selected = publicItems.find((item) => item.id === selectedId);

  return <div className="bg-[#f8fbf9]">
    <section className="relative overflow-hidden bg-[#061d15] px-5 py-20 text-white sm:py-24 lg:px-8">
      <div className="public-grid absolute inset-0 opacity-80" />
      <div className="relative mx-auto max-w-[1450px]"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/5 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-300"><Sparkles size={12} /> Sabi Product Roadmap</p><h1 className="max-w-4xl text-balance font-display text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl lg:text-7xl">See what we’re building.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/65 sm:text-lg">Follow the evolution of Sabi Health and Sabi OS—from planned improvements to features already released.</p></div>
    </section>

    <section className="mx-auto max-w-[1450px] px-5 py-12 lg:px-8 lg:py-16">
      <div className="mb-8 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Roadmap section">{(["ALL", "UPCOMING", "RELEASED"] as const).map((entry) => <button key={entry} type="button" onClick={() => setSection(entry)} className={cn("rounded-lg px-4 py-2 text-sm font-bold transition", section === entry ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}>{entry === "ALL" ? "All roadmap" : entry === "UPCOMING" ? "Upcoming" : "Released"}</button>)}</div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => { const rows = publicItems.filter((item) => item.product.id === product.id); return <button type="button" key={product.id} onClick={() => { setProductId(product.id); setModuleId("all"); }} className={cn("rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", productId === product.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200")}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><MapIcon size={18} /></span><span className="text-xs font-bold text-slate-400">{rows.length} public items</span></div><h2 className="mt-5 font-display text-xl font-bold text-slate-950">{product.name}</h2><div className="mt-3 flex gap-4 text-xs text-slate-500"><span><b className="text-slate-800">{rows.filter((item) => item.status === "Released").length}</b> released</span><span><b className="text-slate-800">{rows.filter((item) => item.status === "In Progress").length}</b> in progress</span></div></button>; })}</div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" placeholder="Search the public roadmap" /></div><select aria-label="Product" value={productId} onChange={(event) => { setProductId(event.target.value); setModuleId("all"); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="all">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><select aria-label="Module" value={moduleId} onChange={(event) => setModuleId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="all">All modules</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="all">All statuses</option>{[...new Set(publicItems.map((item) => item.status))].map((entry) => <option key={entry}>{entry}</option>)}</select></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">{filtered.length} published roadmap items</p><div className="flex rounded-lg bg-slate-100 p-1"><ViewButton active={view === "GANTT"} onClick={() => setView("GANTT")} icon={<GanttChart size={14} />} label="Timeline" /><ViewButton active={view === "LIST"} onClick={() => setView("LIST")} icon={<List size={14} />} label="List" /><ViewButton active={view === "KANBAN"} onClick={() => setView("KANBAN")} icon={<Columns3 size={14} />} label="Kanban" /></div></div>
      </div>

      <RoadmapBoard items={boardItems} view={view} publicMode onSelect={setSelectedId} />
      <p className="mt-8 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500">Roadmap information reflects our current direction and may change as product, clinical, technical and regulatory priorities evolve.</p>
    </section>

    <Modal open={!!selected} onClose={() => setSelectedId(undefined)} title={selected?.title ?? "Roadmap item"}>
      {selected && <article><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">{selected.product.name} · {selected.module?.name ?? "Product"}</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{selected.status}</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarDays size={13} /> Expected {selected.timeframe}</span>{selected.release && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{selected.release.name}</span>}</div><p className="mt-5 text-sm leading-7 text-slate-600">{selected.summary}</p>{selected.progress !== undefined && <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Public progress</span><span>{selected.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${selected.progress}%` }} /></div></div>}{selected.releaseNotes && <div className="mt-5 rounded-xl bg-emerald-50 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Release notes</h3><p className="mt-2 text-sm leading-6 text-emerald-900">{selected.releaseNotes}</p></div>}</article>}
    </Modal>
  </div>;
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{icon}{label}</button>;
}
