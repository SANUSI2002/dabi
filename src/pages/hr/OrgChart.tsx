import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Move, UserX, Users, Building2, Plus, Search } from "lucide-react";
import { PageHeader, Card, Badge, Button, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
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

function buildTree(staff: StaffList, profiles: ProfileList, allowedIds: Set<string> | null, titleFor: (s: StaffList[number]) => string): Node[] {
  const scoped = allowedIds ? staff.filter((s) => allowedIds.has(s.id)) : staff;
  const byManager = new Map<string, StaffList>();
  const roots: StaffList = [];
  for (const s of scoped) {
    const p = profiles.find((x) => x.id === s.id);
    const mgr = p?.reportingManagerId;
    if (mgr && scoped.some((x) => x.id === mgr)) {
      if (!byManager.has(mgr)) byManager.set(mgr, []);
      byManager.get(mgr)!.push(s);
    } else {
      roots.push(s);
    }
  }
  function build(s: StaffList[number]): Node {
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      title: titleFor(s),
      children: (byManager.get(s.id) ?? []).map(build),
    };
  }
  return roots.map(build);
}

export default function OrgChart() {
  const staff = useHr((s) => s.staff);
  const { profiles, upsertProfile } = useEmployees();
  const { departments, jobPositionName, addDepartment } = useOrg();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [scopeDeptId, setScopeDeptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deptModal, setDeptModal] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [activeTab, setActiveTab] = useState("Organization Chart");

  const titleFor = (s: StaffList[number]) => {
    const p = profiles.find((x) => x.id === s.id);
    return jobPositionName(p?.jobPositionId) !== "—" ? jobPositionName(p?.jobPositionId) : s.role;
  };

  const allowedIds = useMemo(() => {
    if (!scopeDeptId) return null;
    return new Set(staff.filter((s) => profiles.find((p) => p.id === s.id)?.departmentId === scopeDeptId).map((s) => s.id));
  }, [scopeDeptId, staff, profiles]);

  const tree = useMemo(() => buildTree(staff, profiles, allowedIds, titleFor), [staff, profiles, allowedIds, jobPositionName]);

  const trayStaff = useMemo(
    () => staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [staff, search],
  );

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
      <PageHeader
        title="Organization Chart"
        subtitle="Reporting lines across the facility — drag a person (from the tree or the list) onto a new manager to re-assign them"
      />

      <Tabs tabs={["Organization Chart", "Departments"]} active={activeTab} onChange={setActiveTab}>
        {(t) =>
          t === "Organization Chart" ? (
            <div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setScopeDeptId(null)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", !scopeDeptId ? "bg-brand-gradient text-white shadow-glow" : "bg-mist-100 text-mist-500 hover:bg-mist-200")}
                >
                  Whole organization
                </button>
                {departments.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setScopeDeptId(d.id)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", scopeDeptId === d.id ? "bg-brand-gradient text-white shadow-glow" : "bg-mist-100 text-mist-500 hover:bg-mist-200")}
                  >
                    {d.name}
                  </button>
                ))}
              </div>

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

              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
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
                    {tree.length === 0 && <p className="text-sm text-mist-400">{scopeDeptId ? "No one is placed in this department yet." : "No reporting lines set yet."}</p>}
                  </div>
                </Card>

                <Card className="h-fit lg:sticky lg:top-20">
                  <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><Users size={15} className="text-brand-600" /> All employees</h3>
                  <p className="mb-3 text-[11px] text-mist-400">Drag anyone from here straight onto a manager in the chart, or onto the drop zone above to make them top-level.</p>
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist-300" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search employees…"
                      className="input py-1.5 pl-8 text-xs"
                    />
                  </div>
                  <div className="max-h-[480px] space-y-1 overflow-y-auto">
                    {trayStaff.map((s) => (
                      <EmployeeChip
                        key={s.id}
                        id={s.id}
                        name={s.name}
                        subtitle={titleFor(s)}
                        isDragging={draggingId === s.id}
                        setDraggingId={setDraggingId}
                        setDragOverId={setDragOverId}
                      />
                    ))}
                    {trayStaff.length === 0 && <p className="text-xs text-mist-400">No matching employees.</p>}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <StatCard label="Total departments" value={departments.length} tone="mist" />
                <Button variant="soft" onClick={() => { setDeptName(""); setDeptModal(true); }}><Plus size={14} /> New department</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((d) => {
                  const count = staff.filter((s) => profiles.find((p) => p.id === s.id)?.departmentId === d.id).length;
                  return (
                    <button key={d.id} onClick={() => { setScopeDeptId(d.id); setActiveTab("Organization Chart"); }} className="text-left">
                      <Card className="transition hover:ring-2 hover:ring-brand-200">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Building2 size={17} /></span>
                          <div>
                            <p className="font-display font-bold text-mist-900">{d.name}</p>
                            <p className="text-[11px] text-mist-400">{count} employee{count === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
                {departments.length === 0 && <p className="text-sm text-mist-400">No departments yet.</p>}
              </div>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={deptModal}
        onClose={() => setDeptModal(false)}
        title="New department"
        footer={<><Button variant="ghost" onClick={() => setDeptModal(false)}>Cancel</Button>
          <Button disabled={!deptName.trim()} onClick={() => { addDepartment({ name: deptName.trim(), companyIds: ["co1"] }); setDeptModal(false); }}>Add department</Button></>}
      >
        <Field label="Department name"><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Radiology" /></Field>
      </Modal>
    </div>
  );
}

function EmployeeChip({
  id, name, subtitle, isDragging, setDraggingId, setDragOverId,
}: {
  id: string;
  name: string;
  subtitle: string;
  isDragging: boolean;
  setDraggingId: (id: string | null) => void;
  setDragOverId: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingId(id); }}
      onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition active:cursor-grabbing",
        isDragging ? "opacity-40" : "hover:bg-mist-50",
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist-200 text-[10px] font-bold text-mist-600">{initials(name)}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-mist-800">{name}</p>
        <p className="truncate text-[10px] text-mist-400">{subtitle}</p>
      </div>
      <Move size={11} className="ml-auto shrink-0 text-mist-300" />
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
