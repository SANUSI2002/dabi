import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { shortDate } from "@/lib/format";
import { useAP } from "@/store/accounting/useAP";
import { useHr } from "@/store/useHr";

export default function GoodsReceipts() {
  const { goodsReceipts, purchaseOrders, vendorById } = useAP();
  const staff = useHr((s) => s.staff);

  return (
    <div>
      <PageHeader title="Goods Receipts" subtitle="Proof that ordered goods physically arrived — recorded against a purchase order, then matched to the bill" />
      {goodsReceipts.length === 0 ? (
        <EmptyState title="No goods receipts yet" hint="Receive goods from the Purchase Orders page." />
      ) : (
        <Card className="p-0">
          <Table columns={["GRN", "Vendor", "PO", "Date", "Received by", "Lines", "Completeness"]}>
            {goodsReceipts.map((g, i) => {
              const po = purchaseOrders.find((p) => p.id === g.purchaseOrderId);
              const full = g.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
              return (
                <Row key={g.id} index={i}>
                  <Cell className="font-mono text-xs">{g.number}</Cell>
                  <Cell className="font-semibold">{vendorById(g.vendorId)?.name}</Cell>
                  <Cell className="font-mono text-xs">{po?.number ?? "—"}</Cell>
                  <Cell>{shortDate(g.date)}</Cell>
                  <Cell>{staff.find((s) => s.id === g.receivedBy)?.name ?? "—"}</Cell>
                  <Cell>{g.lines.length}</Cell>
                  <Cell><Badge tone={full ? "brand" : "amber"}>{full ? "Complete" : "Partial"}</Badge></Cell>
                </Row>
              );
            })}
          </Table>
        </Card>
      )}
    </div>
  );
}
