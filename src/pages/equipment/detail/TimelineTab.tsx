import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import type { EquipmentRecord } from "@/data/equipment";
import { dateTime } from "@/lib/format";

export function TimelineTab({ eq }: { eq: EquipmentRecord }) {
  const events = useEquipmentEvents();
  const timeline = events.timelineFor(eq.id);

  return (
    <Table columns={["Time", "Event", "Source", "Detail"]} caption="Equipment timeline">
      {timeline.length === 0 && <EmptyRow colSpan={4}>No events recorded yet.</EmptyRow>}
      {timeline.map((event, i) => (
        <Row key={event.id} index={i}>
          <Cell className="whitespace-nowrap text-xs text-mist-500">{dateTime(event.at)}</Cell>
          <Cell className="font-semibold">{event.type.replace(/_/g, " ")}</Cell>
          <Cell><span className="text-xs text-mist-500">{event.source}{event.actor ? ` · ${event.actor}` : ""}</span></Cell>
          <Cell className="text-mist-500">{event.detail ?? "—"}</Cell>
        </Row>
      ))}
    </Table>
  );
}
