import { useMemo } from "react";
import { CalendarDays, ChevronRight, CircleDot, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export type RoadmapView = "GANTT" | "LIST" | "KANBAN";

export type RoadmapBoardItem = {
  id: string;
  parentId?: string;
  title: string;
  summary?: string;
  productName: string;
  moduleName?: string;
  releaseName?: string;
  status: string;
  progress?: number;
  priority?: string;
  ownerName?: string;
  health?: string;
  visibility?: string;
  publicationStatus?: string;
  startDate?: string;
  targetDate?: string;
  timeframe?: string;
};

const statusTone: Record<string, string> = {
  IDEA: "bg-violet-500", RESEARCH: "bg-violet-500", Exploring: "bg-violet-500",
  PLANNED: "bg-slate-400", DESIGN: "bg-cyan-500", Planned: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500", "In Progress": "bg-blue-500",
  BETA: "bg-fuchsia-500", RELEASE_CANDIDATE: "bg-fuchsia-500", Beta: "bg-fuchsia-500",
  RELEASED: "bg-emerald-500", Released: "bg-emerald-500",
  DELAYED: "bg-amber-500", Delayed: "bg-amber-500", POSTPONED: "bg-orange-500", Postponed: "bg-orange-500",
  CANCELLED: "bg-red-500",
};

const pretty = (value?: string) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";

function StatusDot({ status }: { status: string }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone[status] ?? "bg-slate-400")} />;
}

export function RoadmapBoard({ items, view, publicMode = false, onSelect }: { items: RoadmapBoardItem[]; view: RoadmapView; publicMode?: boolean; onSelect?: (id: string) => void }) {
  if (!items.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><CircleDot className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No roadmap items match these filters.</p><p className="mt-1 text-xs text-slate-500">Try another product, module, status or search term.</p></div>;
  if (view === "KANBAN") return <Kanban items={items} publicMode={publicMode} onSelect={onSelect} />;
  if (view === "LIST") return <List items={items} publicMode={publicMode} onSelect={onSelect} />;
  return publicMode ? <PublicTimeline items={items} onSelect={onSelect} /> : <Gantt items={items} onSelect={onSelect} />;
}

function List({ items, publicMode, onSelect }: { items: RoadmapBoardItem[]; publicMode: boolean; onSelect?: (id: string) => void }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="cc-th">Item</th><th className="cc-th">Product / Module</th><th className="cc-th">Status</th>{!publicMode && <><th className="cc-th">Release</th><th className="cc-th">Owner</th><th className="cc-th">Priority</th><th className="cc-th">Progress</th><th className="cc-th">Target</th><th className="cc-th">Health</th><th className="cc-th">Visibility</th><th className="cc-th">Publication</th></>}{publicMode && <th className="cc-th">Expected</th>}</tr></thead><tbody>{items.map((item) => <tr key={item.id} tabIndex={onSelect ? 0 : undefined} onClick={() => onSelect?.(item.id)} onKeyDown={(event) => event.key === "Enter" && onSelect?.(item.id)} className={cn("border-t border-slate-100", onSelect && "cursor-pointer hover:bg-emerald-50/30 focus:bg-emerald-50/40 focus:outline-none")}><td className="cc-td min-w-64 whitespace-normal"><div className="flex items-start gap-2" style={{ paddingLeft: item.parentId ? 18 : 0 }}><StatusDot status={item.status} /><div><p className="font-bold text-slate-900">{item.title}</p>{publicMode && item.summary && <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-500">{item.summary}</p>}</div></div></td><td className="cc-td"><b className="block text-slate-700">{item.productName}</b><span className="text-slate-400">{item.moduleName ?? "Product-wide"}</span></td><td className="cc-td"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700"><StatusDot status={item.status} />{pretty(item.status)}</span></td>{!publicMode && <><td className="cc-td">{item.releaseName ?? "Unscheduled"}</td><td className="cc-td">{item.ownerName ?? "Unassigned"}</td><td className="cc-td font-bold">{item.priority}</td><td className="cc-td"><Progress value={item.progress ?? 0} /></td><td className="cc-td">{item.targetDate ?? "No target"}</td><td className="cc-td">{pretty(item.health)}</td><td className="cc-td">{pretty(item.visibility)}</td><td className="cc-td">{pretty(item.publicationStatus)}</td></>}{publicMode && <td className="cc-td font-semibold text-slate-700">{item.timeframe}</td>}</tr>)}</tbody></table></div></div>;
}

function Kanban({ items, publicMode, onSelect }: { items: RoadmapBoardItem[]; publicMode: boolean; onSelect?: (id: string) => void }) {
  const statuses = [...new Set(items.map((item) => item.status))];
  return <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Roadmap Kanban board">{statuses.map((status) => { const rows = items.filter((item) => item.status === status); return <section key={status} className="w-[280px] shrink-0 rounded-xl bg-slate-100/80 p-2"><header className="flex items-center gap-2 px-2 py-2"><StatusDot status={status} /><h2 className="text-xs font-bold text-slate-700">{pretty(status)}</h2><span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{rows.length}</span></header><div className="space-y-2">{rows.map((item) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><p className="text-sm font-bold text-slate-900">{item.title}</p><p className="mt-1 text-[11px] text-slate-500">{item.productName} · {item.moduleName ?? "Product-wide"}</p>{item.releaseName && <p className="mt-2 truncate text-[10px] font-semibold text-blue-600">{item.releaseName}</p>}{publicMode ? <p className="mt-3 text-xs font-semibold text-emerald-700">{item.timeframe}</p> : <><div className="mt-3 flex items-center justify-between text-[11px] text-slate-500"><span>{item.priority}</span><span>{item.progress}%</span></div><Progress value={item.progress ?? 0} compact /></>}</button>)}</div></section>; })}</div>;
}

function PublicTimeline({ items, onSelect }: { items: RoadmapBoardItem[]; onSelect?: (id: string) => void }) {
  const groups = [...new Set(items.map((item) => item.timeframe ?? "No date"))];
  return <div className="overflow-x-auto pb-3"><div className="flex min-w-max gap-4">{groups.map((timeframe) => <section key={timeframe} className="w-[310px]"><div className="mb-3 flex items-center gap-2 border-b border-emerald-200 pb-3"><CalendarDays size={15} className="text-emerald-700" /><h2 className="font-display text-sm font-bold text-slate-900">{timeframe}</h2></div><div className="space-y-3">{items.filter((item) => (item.timeframe ?? "No date") === timeframe).map((item) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)} className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><StatusDot status={item.status} />{pretty(item.status)}</div><h3 className="mt-3 font-display text-base font-bold text-slate-950">{item.title}</h3><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{item.summary}</p><div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-emerald-700"><span>{item.productName} · {item.moduleName ?? "Product"}</span><ChevronRight size={14} className="transition group-hover:translate-x-1" /></div></button>)}</div></section>)}</div></div>;
}

function Gantt({ items, onSelect }: { items: RoadmapBoardItem[]; onSelect?: (id: string) => void }) {
  const chart = useMemo(() => {
    const dated = items.filter((item) => item.startDate && item.targetDate);
    const starts = dated.map((item) => new Date(`${item.startDate}T00:00:00`).getTime());
    const ends = dated.map((item) => new Date(`${item.targetDate}T00:00:00`).getTime());
    const min = starts.length ? Math.min(...starts) : Date.UTC(2026, 0, 1);
    const max = ends.length ? Math.max(...ends) : min + 90 * 86_400_000;
    const start = new Date(min); start.setDate(1);
    const end = new Date(max); end.setMonth(end.getMonth() + 1, 1);
    const span = Math.max(end.getTime() - start.getTime(), 1);
    const months: { label: string; width: number }[] = [];
    const cursor = new Date(start);
    while (cursor < end) { const next = new Date(cursor); next.setMonth(next.getMonth() + 1); months.push({ label: cursor.toLocaleDateString("en", { month: "short", year: "2-digit" }), width: ((next.getTime() - cursor.getTime()) / span) * 100 }); cursor.setMonth(cursor.getMonth() + 1); }
    return { start: start.getTime(), span, months };
  }, [items]);

  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><div className="min-w-[920px]"><div className="grid grid-cols-[260px_1fr] border-b border-slate-200 bg-slate-50"><div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Roadmap item</div><div className="flex">{chart.months.map((month) => <div key={month.label} style={{ width: `${month.width}%` }} className="border-l border-slate-200 px-2 py-3 text-[10px] font-bold uppercase text-slate-400">{month.label}</div>)}</div></div>{items.map((item) => { const start = item.startDate ? new Date(`${item.startDate}T00:00:00`).getTime() : chart.start; const end = item.targetDate ? new Date(`${item.targetDate}T00:00:00`).getTime() : start; const left = Math.max(0, Math.min(100, ((start - chart.start) / chart.span) * 100)); const width = Math.max(1.5, Math.min(100 - left, ((end - start) / chart.span) * 100)); return <button type="button" key={item.id} onClick={() => onSelect?.(item.id)} className="grid w-full grid-cols-[260px_1fr] border-b border-slate-100 text-left last:border-0 hover:bg-emerald-50/30"><div className="flex min-w-0 items-center gap-2 px-4 py-3" style={{ paddingLeft: item.parentId ? 30 : 16 }}><StatusDot status={item.status} /><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{item.title}</p><p className="truncate text-[10px] text-slate-400">{item.moduleName ?? item.productName}{item.releaseName ? ` · ${item.releaseName}` : ""}</p></div></div><div className="relative my-2 min-h-9 border-l border-slate-100"><div title={`${item.title}: ${item.startDate ?? "No start"} – ${item.targetDate ?? "No target"}`} className={cn("absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-md text-white shadow-sm", statusTone[item.status] ?? "bg-slate-500")} style={{ left: `${left}%`, width: `${width}%` }}><div className="h-full bg-white/25" style={{ width: `${item.progress ?? 0}%` }} /><span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold">{item.progress}%</span></div></div></button>; })}</div></div></div>;
}

function Progress({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={cn("flex items-center gap-2", compact && "mt-1")}><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} /></span>{!compact && <span className="text-[10px] font-bold text-slate-500">{value}%</span>}</div>;
}

export function RoadmapItemMeta({ item }: { item: RoadmapBoardItem }) {
  return <div className="flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><StatusDot status={item.status} />{pretty(item.status)}</span>{item.ownerName && <span className="inline-flex items-center gap-1"><UserRound size={13} />{item.ownerName}</span>}{item.targetDate && <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{item.targetDate}</span>}</div>;
}
