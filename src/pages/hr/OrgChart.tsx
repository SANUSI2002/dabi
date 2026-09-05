import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Move, UserX } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

type Node = { id: string; name: string; role: string; title: string; children: Node[] };
type StaffList = ReturnType<typeof useHr.getState>["staff"];
type ProfileList = ReturnType<typeof useEmployees.getState>["profiles"];

function wouldCreateCycle(profiles: ProfileList, draggedId: string, newManagerId: string): boolean {
  let cur: string | undefined = newManagerId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === draggedId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = profiles.find((p) => p.id === cur)?.reportingManagerId;
  }
  return false;
}

export default function OrgChart() {
  const staff = useHr((s) => s.staff);
  const { profiles, upsertProfile } = useEmployees();
  const { jobPositionName } = useOrg();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const tree = useMemo(() => {
    const byManager = new Map<string, StaffList>();
    const roots: StaffList = [];
    for (const s of staff) {
      const p = profiles.find((x) => x.id === s.id);
      const mgr = p?.reportingManagerId;
      if (mgr && staff.some((x) => x.id === mgr)) {
        if (!byManager.has(mgr)) byManager.set(mgr, []);
        byManager.get(mgr)!.push(s);
      } else {
        roots.push(s);
      }
    }
    function build(s: StaffList[number]): Node {
      const p = profiles.find((x) => x.id === s.id);
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        title: jobPositionName(p?.jobPositionId) !== "—" ? jobPositionName(p?.jobPositionId) : s.role,
        children: (byManager.get(s.id) ?? []).map(build),
      };
    }
    return roots.map(build);
  }, [staff, profiles, jobPositionName]);

  function reassign(draggedId: string, newManagerId: string | undefined) {
    if (draggedId === newManagerId) return;
    if (newManagerId && wouldCreateCycle(profiles, draggedId, newManagerId)) {
      setBlocked(draggedId);
      setTimeout(() => setBlocked((v) => (v === draggedId ? null : v)), 1800);
      return;
    }
    upsertProfile(draggedId, { reportingManagerId: newManagerId });
  }

  return (
    <div>
      <PageHeader title="Organization Chart" subtitle="Reporting lines across the facility — drag a person onto a new manager to re-assign them" />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverId("__root__"); }}
        onDragLeave={() => setDragOverId((v) => (v === "__root__" ? null : v))}
        onDrop={(e) => { e.preventDefault(); if (draggingId) reassign(draggingId, undefined); setDraggingId(null); setDragOverId(null); }}
        className={cn(
          "mb-4 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition",
          dragOverId === "__root__" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-mist-300 text-mist-400",
        )}
      >
        <UserX size={15} /> Drop here to remove a manager and make someone top-level
      </div>

      <Card>
        <div className="space-y-1">
          {tree.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              depth={0}
              draggingId={draggingId}
              dragOverId={dragOverId}
              blocked={blocked}
              setDraggingId={setDraggingId}
              setDragOverId={setDragOverId}
              onDrop={reassign}
            />
          ))}
          {tree.length === 0 && <p className="text-sm text-mist-400">No reporting lines set yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function TreeNode({
  node, depth, draggingId, dragOverId, blocked, setDraggingId, setDragOverId, onDrop,
}: {
  node: Node;
  depth: number;
  draggingId: string | null;
  dragOverId: string | null;
  blocked: string | null;
  setDraggingId: (id: string | null) => void;
  setDragOverId: Dispatch<SetStateAction<string | null>>;
  onDrop: (draggedId: string, newManagerId: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isDragging = draggingId === node.id;
  const isDragOver = dragOverId === node.id;

  return (
    <div style={{ marginLeft: depth ? 20 : 0 }} className={depth ? "border-l border-mist-200 pl-3" : ""}>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingId(node.id); }}
        onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
        onDragOver={(e) => { if (draggingId && draggingId !== node.id) { e.preventDefault(); setDragOverId(node.id); } }}
        onDragLeave={() => setDragOverId((v: string | null) => (v === node.id ? null : v))}
        onDrop={(e) => { e.preventDefault(); if (draggingId) onDrop(draggingId, node.id); setDraggingId(null); setDragOverId(null); }}
        className={cn(
          "flex cursor-grab items-center gap-2 rounded-xl px-2 py-1.5 transition active:cursor-grabbing",
          isDragging ? "opacity-40" : "hover:bg-mist-50",
          isDragOver && "bg-brand-50 ring-2 ring-brand-300",
          blocked === node.id && "ring-2 ring-action-300 bg-action-50",
        )}
      >
        <button onClick={() => setOpen((v) => !v)} className={hasChildren ? "text-mist-400" : "invisible"}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(node.name)}</span>
        <Link to={`/hr/employees/${node.id}`} className="min-w-0">
          <span className="block truncate text-sm font-semibold text-mist-900 hover:text-brand-700 hover:underline">{node.name}</span>
          <span className="block truncate text-[11px] text-mist-400">{node.title}</span>
        </Link>
        {blocked === node.id && <Badge tone="action">Can't report to your own report</Badge>}
        {hasChildren && <span className="ml-auto shrink-0 rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-bold text-mist-500">{node.children.length} report{node.children.length > 1 ? "s" : ""}</span>}
        <Move size={12} className="shrink-0 text-mist-300" />
      </div>
      {open && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              draggingId={draggingId}
              dragOverId={dragOverId}
              blocked={blocked}
              setDraggingId={setDraggingId}
              setDragOverId={setDragOverId}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
