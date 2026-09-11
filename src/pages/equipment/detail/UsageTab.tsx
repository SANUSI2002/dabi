import { Badge } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { useEquipmentUsage } from "@/store/useEquipmentUsage";
import type { EquipmentRecord } from "@/data/equipment";
import { dateTime } from "@/lib/format";

export function UsageTab({ eq }: { eq: EquipmentRecord }) {
  const usage = useEquipmentUsage();
  const usageSessions = usage.sessionsFor(eq.id);

  return (
    <div>
      <p className="mb-3 text-xs text-mist-400">
        Who has used this equipment, for what, and when — derived from the real lab order each session is tied to, not a separate log.
      </p>
      <Table columns={["Operator", "Patient", "Test / Task", "Started", "Duration", "Outcome"]} caption="Equipment usage sessions">
        {usageSessions.length === 0 && <EmptyRow colSpan={6}>No usage sessions recorded yet.</EmptyRow>}
        {usageSessions.map((session, i) => {
          const durationMin = session.endedAt
            ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
            : null;
          return (
            <Row key={session.id} index={i}>
              <Cell className="font-semibold">{session.operator}</Cell>
              <Cell>{session.patientName ?? "—"}</Cell>
              <Cell>{session.testName ?? "—"}</Cell>
              <Cell className="text-xs text-mist-500">{dateTime(session.startedAt)}</Cell>
              <Cell>{durationMin !== null ? `${durationMin < 1 ? "<1" : durationMin} min` : "In progress"}</Cell>
              <Cell>{session.outcome ? <Badge tone={session.outcome === "Completed" ? "brand" : "action"}>{session.outcome}</Badge> : <Badge tone="amber">Active</Badge>}</Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}
