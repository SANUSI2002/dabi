import { Plus, Trash2 } from "lucide-react";
import { Select, Input } from "@/components/ui/form";
import { money } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import type { SalesLine } from "@/data/accounting/receivables";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type EditableLine = Omit<SalesLine, "id"> & { id?: string; itemId?: string };

export type StockItemOption = { id: string; name: string; inventoryAccountNumber: number };

export function LineEditor({
  lines,
  onChange,
  accountFilter = (n) => n >= 4000 && n < 5000,
  accountLabel = "Revenue account",
  stockItems,
}: {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  accountFilter?: (accountNumber: number) => boolean;
  accountLabel?: string;
  /** purchase documents only: lets a line be tied to an inventory item so its goods receipt can be received into physical stock */
  stockItems?: StockItemOption[];
}) {
  const accounts = useLedger((s) => s.accounts).filter((a) => a.isActive && accountFilter(a.number));
  const rates = useTax((s) => s.rates).filter((r) => r.isActive);
  const taxTotal = useTax((s) => s.taxTotal);
  const taxIdsOf = useTax((s) => s.taxIdsOf);

  const set = (i: number, patch: Partial<EditableLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const idsOf = (l: EditableLine) => taxIdsOf(l);
  const setTaxAt = (l: EditableLine, slot: 0 | 1, id: string) => {
    const ids = idsOf(l);
    const next = slot === 0 ? [id, ids[1]] : [ids[0], id];
    return { taxRateId: undefined, taxRateIds: next.filter(Boolean) as string[] };
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">{accountLabel} lines</span>
        <button
          type="button"
          className="btn-soft px-2 py-1 text-xs"
          onClick={() => onChange([...lines, { accountNumber: accounts[0]?.number ?? 0, description: "", qty: 1, unitPrice: 0, taxRateId: rates[0]?.id }])}
        >
          <Plus size={12} /> Add line
        </button>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => {
          const amount = round2(l.qty * l.unitPrice);
          const ids = idsOf(l);
          return (
            <div key={i} className="space-y-1">
              <div className="grid grid-cols-[1.3fr_1fr_54px_84px_96px_96px_96px_24px] items-center gap-1.5 text-sm">
                <Select
                  value={String(l.accountNumber || "")}
                  onChange={(e) => set(i, { accountNumber: Number(e.target.value) })}
                  options={[{ value: "", label: "Account…" }, ...accounts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))]}
                />
                <Input placeholder="Description" value={l.description} onChange={(e) => set(i, { description: e.target.value })} />
                <Input type="number" placeholder="Qty" value={l.qty || ""} onChange={(e) => set(i, { qty: +e.target.value })} className="text-center" />
                <Input type="number" placeholder="Unit price" value={l.unitPrice || ""} onChange={(e) => set(i, { unitPrice: +e.target.value })} />
                <Select value={ids[0] ?? ""} onChange={(e) => set(i, setTaxAt(l, 0, e.target.value))} options={[{ value: "", label: "No tax" }, ...rates.map((r) => ({ value: r.id, label: r.name }))]} />
                <Select value={ids[1] ?? ""} onChange={(e) => set(i, setTaxAt(l, 1, e.target.value))} options={[{ value: "", label: "+ tax" }, ...rates.map((r) => ({ value: r.id, label: r.name }))]} />
                <span className="text-right text-mist-600">{money(amount + taxTotal(amount, ids))}</span>
                <button type="button" className="text-action-500 hover:text-action-700" onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
              {stockItems && (
                <Select
                  aria-label="Link to inventory item"
                  value={l.itemId ?? ""}
                  onChange={(e) => {
                    const item = stockItems.find((s) => s.id === e.target.value);
                    set(i, item ? { itemId: item.id, accountNumber: item.inventoryAccountNumber, description: l.description || item.name } : { itemId: undefined });
                  }}
                  options={[{ value: "", label: "Not stock — no inventory link" }, ...stockItems.map((s) => ({ value: s.id, label: `Stock: ${s.name}` }))]}
                  className="h-8 w-full py-0 text-xs text-mist-500"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DocTotals({ subtotal, tax, total }: { subtotal: number; tax: number; total: number }) {
  return (
    <div className="ml-auto w-64 space-y-1 border-t border-mist-200 pt-2 text-sm">
      <div className="flex justify-between text-mist-500"><span>Subtotal</span><span className="font-mono">{money(subtotal)}</span></div>
      <div className="flex justify-between text-mist-500"><span>Tax</span><span className="font-mono">{money(tax)}</span></div>
      <div className="flex justify-between border-t border-mist-200 pt-1 font-bold"><span>Total</span><span className="font-mono">{money(total)}</span></div>
    </div>
  );
}
