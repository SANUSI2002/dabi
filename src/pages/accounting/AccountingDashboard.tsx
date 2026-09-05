import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, Scale, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, Card, StatCard, Badge, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { money, shortDate } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";

const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
const startOfYear = () => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
const todayIso = () => new Date().toISOString();

export default function AccountingDashboard() {
  const { accounts, entries, balanceOf, activityOf, isInBalance, booksLockedBefore } = useLedger();

  const m = useMemo(() => {
    const som = startOfMonth();
    const soy = startOfYear();
    const now = todayIso();
    const cash = accounts
      .filter((a) => a.subtype === "cash" || a.subtype === "bank")
      .reduce((n, a) => n + balanceOf(a.number, now), 0);
    const sumType = (t: string, from: string) =>
      accounts.filter((a) => a.type === t).reduce((n, a) => n + activityOf(a.number, from, now), 0);
    const revMtd = sumType("revenue", som);
    const expMtd = sumType("expense", som) + sumType("cogs", som);
    const revYtd = sumType("revenue", soy);
    const expYtd = sumType("expense", soy) + sumType("cogs", soy);
    const ar = accounts.filter((a) => a.subtype === "accounts_receivable").reduce((n, a) => n + balanceOf(a.number, now), 0);
    const ap = accounts.filter((a) => a.subtype === "accounts_payable").reduce((n, a) => n + balanceOf(a.number, now), 0);
    return { cash, revMtd, expMtd, netMtd: revMtd - expMtd, revYtd, expYtd, netYtd: revYtd - expYtd, ar, ap };
  }, [accounts, balanceOf, activityOf]);

  const balanced = isInBalance(todayIso());
  const recent = entries.slice(0, 8);

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Financial position at a glance — all figures come straight from the posted general ledger" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cash & bank" value={money(m.cash)} tone="brand" icon={<Wallet size={18} />} />
        <StatCard label="Revenue (MTD)" value={money(m.revMtd)} tone="brand" delay={0.05} icon={<TrendingUp size={18} />} />
        <StatCard label="Expenses (MTD)" value={money(m.expMtd)} tone="action" delay={0.1} icon={<TrendingDown size={18} />} />
        <StatCard label="Net income (MTD)" value={money(m.netMtd)} tone={m.netMtd >= 0 ? "brand" : "action"} delay={0.15} icon={<Scale size={18} />} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-mist-500">Year to date</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-mist-500">Revenue</span><span className="font-mono font-semibold">{money(m.revYtd)}</span></div>
            <div className="flex justify-between"><span className="text-mist-500">Expenses & COGS</span><span className="font-mono font-semibold">{money(m.expYtd)}</span></div>
            <div className="flex justify-between border-t border-mist-200 pt-2 font-bold"><span>Net income</span><span className={`font-mono ${m.netYtd >= 0 ? "text-brand-700" : "text-action-600"}`}>{money(m.netYtd)}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-mist-500">Working capital</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-mist-500">Accounts receivable</span><span className="font-mono font-semibold">{money(m.ar)}</span></div>
            <div className="flex justify-between"><span className="text-mist-500">Accounts payable</span><span className="font-mono font-semibold">{money(m.ap)}</span></div>
            <div className="flex justify-between border-t border-mist-200 pt-2 font-bold"><span>Net</span><span className="font-mono">{money(m.ar - m.ap)}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-mist-500">Ledger health</h3>
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${
              balanced ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-action-50 text-action-700 ring-action-200"
            }`}
          >
            {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {balanced ? "Trial balance ties out" : "Trial balance is out — investigate"}
          </div>
          <p className="mt-3 text-xs text-mist-400">
            Books locked before {booksLockedBefore ? shortDate(booksLockedBefore) : "— (no lock)"}
          </p>
          <Link to="/accounting/trial-balance" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
            Open trial balance <ArrowRight size={14} />
          </Link>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-mist-500">Recent journal entries</h3>
          <Link to="/accounting/journals" className="text-sm font-semibold text-brand-700">View all</Link>
        </div>
        <Table columns={["Entry", "Date", "Source", "Memo", "Amount", "Status"]}>
          {recent.map((e, i) => (
            <Row key={e.id} index={i}>
              <Cell className="font-mono text-xs">{e.number}</Cell>
              <Cell className="whitespace-nowrap text-mist-500">{shortDate(e.date)}</Cell>
              <Cell><Badge tone="mist">{e.source}</Badge></Cell>
              <Cell className="max-w-[320px] truncate">{e.memo}</Cell>
              <Cell className="font-mono">{money(e.lines.reduce((n, l) => n + l.debit, 0))}</Cell>
              <Cell><Badge tone={statusTone(e.status === "Reversed" ? "returned" : e.status)}>{e.status}</Badge></Cell>
            </Row>
          ))}
        </Table>
      </Card>
    </div>
  );
}
