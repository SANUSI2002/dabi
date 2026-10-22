import { money } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";

/**
 * What a bank or cash account holds against a payment about to leave it — and, if the payment is more
 * than that, by how much it would overdraw the account. Advisory only: an agreed overdraft is real, so
 * the payment is never blocked here.
 */
export function FundsNote({ account, amount }: { account: number; amount: number }) {
  const balance = useLedger((s) => s.balanceOf(account));
  if (!(amount > 0)) return null;
  const short = Math.round((amount - balance) * 100) / 100;
  return short > 0.005
    ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">{account} holds {money(balance)} in the books — this payment would leave it {money(short)} overdrawn.</p>
    : <p className="text-xs text-mist-400">{account} holds {money(balance)} in the books.</p>;
}
