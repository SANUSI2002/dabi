import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/primitives";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { initials } from "@/lib/format";

type Node = { id: string; name: string; role: string; title: string; children: Node[] };

export default function OrgChart() {
  const staff = useHr((s) => s.staff);
  const { profiles } = useEmployees();
  const { jobPositionName } = useOrg();

  const tree = useMemo(() => {
    const byManager = new Map<string, typeof staff>();
    const roots: typeof staff = [];
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
    function build(s: (typeof staff)[number]): Node {
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

  return (
    <div>
      <PageHeader title="Organization Chart" subtitle="Reporting lines across the facility" />
      <Card>
        <div className="space-y-1">
          {tree.map((n) => (
            <TreeNode key={n.id} node={n} depth={0} />
          ))}
          {tree.length === 0 && <p className="text-sm text-mist-400">No reporting lines set yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function TreeNode({ node, depth }: { node: Node; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  return (
    <div style={{ marginLeft: depth ? 20 : 0 }} className={depth ? "border-l border-mist-200 pl-3" : ""}>
      <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-mist-50">
        <button onClick={() => setOpen((v) => !v)} className={hasChildren ? "text-mist-400" : "invisible"}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(node.name)}</span>
        <Link to={`/hr/employees/${node.id}`} className="min-w-0">
          <span className="block truncate text-sm font-semibold text-mist-900 hover:text-brand-700 hover:underline">{node.name}</span>
          <span className="block truncate text-[11px] text-mist-400">{node.title}</span>
        </Link>
        {hasChildren && <span className="ml-auto shrink-0 rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-bold text-mist-500">{node.children.length} report{node.children.length > 1 ? "s" : ""}</span>}
      </div>
      {open && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
