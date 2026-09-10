import { Fragment, useMemo, useState } from "react";
import { ScrollText, FileDown, ChevronRight, ArrowRight } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { useAudit } from "@/store/useAudit";
import { dateTime, timeAgo } from "@/lib/format";

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AuditLog() {
  const events = useAudit((s) => s.events);
  const [action, setAction] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const actions = useMemo(() => ["All", ...new Set(events.map((e) => e.action))].slice(0, 14), [events]);
  const rows = events.filter((e) => action === "All" || e.action === action);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="NDPR compliance · full activity history"
        actions={<Button variant="ghost"><FileDown size={15} /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Events logged" value={events.length} tone="brand" icon={<ScrollText size={18} />} />
        <StatCard label="Users" value={new Set(events.map((e) => e.user)).size} tone="mist" delay={0.05} />
        <StatCard label="Distinct actions" value={new Set(events.map((e) => e.action)).size} tone="mist" delay={0.1} />
        <StatCard label="Data exports" value={events.filter((e) => e.action.includes("REPORT")).length} tone="action" delay={0.15} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`chip ${action === a ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200"}`}
          >
            {a}
          </button>
        ))}
      </div>

      <Table columns={["", "Timestamp", "User", "Role", "Action", "Resource", "IP Address"]}>
        {rows.map((e, i) => {
          const detail = (e.changes?.length ?? 0) > 0 || !!e.meta;
          const open = openId === e.id;
          return (
            <Fragment key={e.id}>
              <Row index={i} onClick={detail ? () => setOpenId(open ? null : e.id) : undefined}>
                <Cell className="w-6 text-mist-300">
                  {detail && <ChevronRight size={14} className={open ? "rotate-90 transition" : "transition"} />}
                </Cell>
                <Cell className="text-mist-400">
                  {dateTime(e.ts)}
                  <span className="block text-[10px] text-mist-300">{timeAgo(e.ts)}</span>
                </Cell>
                <Cell className="font-semibold">{e.user}</Cell>
                <Cell>{e.role}</Cell>
                <Cell>
                  <Badge tone={e.action.includes("REPORT") ? "amber" : "brand"}>{e.action}</Badge>
                  {(e.changes?.length ?? 0) > 0 && (
                    <span className="ml-1.5 text-[10px] text-mist-400">{e.changes!.length} field{e.changes!.length > 1 ? "s" : ""}</span>
                  )}
                </Cell>
                <Cell className="font-mono text-xs text-mist-500">{e.resource}</Cell>
                <Cell className="font-mono text-xs">{e.ip}</Cell>
              </Row>
              {open && detail && (
                <tr className="bg-mist-50/60">
                  <td />
                  <td colSpan={6} className="td">
                    {(e.changes?.length ?? 0) > 0 && (
                      <div className="space-y-1.5">
                        {e.changes!.map((c) => (
                          <div key={c.field} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="min-w-[120px] font-semibold text-mist-600">{c.field}</span>
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-mist-500 ring-1 ring-mist-200">{fmtVal(c.from)}</span>
                            <ArrowRight size={12} className="text-mist-400" />
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-mist-800 ring-1 ring-brand-200">{fmtVal(c.to)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {e.meta && (
                      <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-mist-500 ring-1 ring-mist-200">{JSON.stringify(e.meta, null, 2)}</pre>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
    </div>
  );
}
