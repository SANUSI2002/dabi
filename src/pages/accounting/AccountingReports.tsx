import { useMemo, useState } from "react";
import { Printer, FileBarChart, Scale, TrendingUp, Wallet, Boxes, Building2, Users, Truck } from "lucide-react";
import { PageHeader, Button, Card, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, isoDate } from "@/lib/format";
import {
  profitAndLoss, balanceSheet, cashFlow, generalLedgerReport, inventoryValuationReport,
  fixedAssetRegisterReport, arAgingReport, apAgingReport,
} from "@/store/accounting/useAccountingReports";
import { useLedger } from "@/store/accounting/useLedger";

type ReportKey = "pl" | "bs" | "cf" | "tb" | "gl" | "ar-aging" | "ap-aging" | "inv-val" | "fa-reg";
const REPORTS: { key: ReportKey; name: string; group: string; icon: typeof Scale }[] = [
  { key: "pl", name: "Profit & Loss", group: "Financial statements", icon: TrendingUp },
  { key: "bs", name: "Balance Sheet", group: "Financial statements", icon: Scale },
  { key: "cf", name: "Cash Flow Statement", group: "Financial statements", icon: Wallet },
  { key: "tb", name: "Trial Balance", group: "Financial statements", icon: FileBarChart },
  { key: "gl", name: "General Ledger", group: "Detail", icon: FileBarChart },
  { key: "ar-aging", name: "AR Aging", group: "Receivables & Payables", icon: Users },
  { key: "ap-aging", name: "AP Aging", group: "Receivables & Payables", icon: Truck },
  { key: "inv-val", name: "Inventory Valuation", group: "Operational", icon: Boxes },
  { key: "fa-reg", name: "Fixed Asset Register", group: "Operational", icon: Building2 },
];

export default function AccountingReports() {
  const [key, setKey] = useState<ReportKey>("pl");
  const [from, setFrom] = useState(isoDate(new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))));
  const [to, setTo] = useState(isoDate(new Date()));
  const [print, setPrint] = useState(false);
  const trialBalance = useLedger((s) => s.trialBalance);
  useLedger((s) => s.entries); // re-render when the ledger changes

  const fromIso = new Date(from + "T00:00:00Z").toISOString();
  const toIso = new Date(to + "T23:59:59Z").toISOString();

  const data = useMemo(() => {
    switch (key) {
      case "pl": return profitAndLoss(fromIso, toIso);
      case "bs": return balanceSheet(toIso);
      case "cf": return cashFlow(fromIso, toIso);
      case "tb": return trialBalance(toIso);
      case "gl": return generalLedgerReport(fromIso, toIso);
      case "ar-aging": return arAgingReport();
      case "ap-aging": return apAgingReport();
      case "inv-val": return inventoryValuationReport();
      case "fa-reg": return fixedAssetRegisterReport(toIso);
    }
  }, [key, fromIso, toIso, trialBalance]);

  const current = REPORTS.find((r) => r.key === key)!;
  const needsPeriod = ["pl", "cf", "gl"].includes(key);

  return (
    <div>
      <PageHeader title="Financial Reports" subtitle="Every figure computed from posted journal entries — nothing hard-coded"
        actions={<Button variant="soft" onClick={() => setPrint(true)}><Printer size={15} /> Print</Button>} />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-2">
          {["Financial statements", "Detail", "Receivables & Payables", "Operational"].map((g) => (
            <div key={g} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mist-300">{g}</p>
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <button key={r.key} onClick={() => setKey(r.key)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${key === r.key ? "bg-brand-50 font-semibold text-brand-700" : "text-mist-600 hover:bg-mist-50"}`}>
                  <r.icon size={14} /> {r.name}
                </button>
              ))}
            </div>
          ))}
        </Card>

        <div>
          <Card className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              {needsPeriod ? (
                <>
                  <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                  <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
                </>
              ) : (
                <Field label="As at"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              )}
            </div>
          </Card>
          <Card><ReportView reportKey={key} data={data} /></Card>
        </div>
      </div>

      {print && (
        <PrintDoc open onClose={() => setPrint(false)} docTitle={current.name}>
          <Section title={current.name}>
            {needsPeriod ? <Line label="Period" value={`${shortDate(from)} – ${shortDate(to)}`} /> : <Line label="As at" value={shortDate(to)} />}
          </Section>
          <ReportView reportKey={key} data={data} print />
        </PrintDoc>
      )}
    </div>
  );
}

function GroupRows({ g, print }: { g: { title: string; lines: { account: { number: number; name: string }; amount: number }[]; total: number }; print?: boolean }) {
  return (
    <>
      <tr className={print ? "" : ""}><td className="pt-3 text-[11px] font-bold uppercase tracking-wide text-mist-500" colSpan={2}>{g.title}</td></tr>
      {g.lines.map((l) => (
        <tr key={l.account.number} className="border-b border-mist-100">
          <td className="py-1.5 pl-3">{l.account.number} — {l.account.name}</td>
          <td className="py-1.5 text-right font-mono">{money(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-b-2 border-mist-300 font-bold"><td className="py-1.5">Total {g.title.toLowerCase()}</td><td className="py-1.5 text-right font-mono">{money(g.total)}</td></tr>
    </>
  );
}

function ReportView({ reportKey, data, print }: { reportKey: ReportKey; data: unknown; print?: boolean }) {
  const wrap = print ? "text-sm" : "";

  if (reportKey === "pl") {
    const d = data as ReturnType<typeof profitAndLoss>;
    return (
      <table className={`w-full ${wrap}`}>
        <tbody>
          <GroupRows g={{ ...d.revenue, title: "Revenue" }} print={print} />
          <GroupRows g={{ ...d.cogs, title: "Cost of sales" }} print={print} />
          <tr className="font-bold text-brand-700"><td className="py-2">Gross profit</td><td className="py-2 text-right font-mono">{money(d.grossProfit)}</td></tr>
          <GroupRows g={{ ...d.expenses, title: "Operating expenses" }} print={print} />
          <tr className="border-t-2 border-brand-600 text-base font-extrabold"><td className="py-2">Net income</td><td className={`py-2 text-right font-mono ${d.netIncome >= 0 ? "text-brand-700" : "text-action-600"}`}>{money(d.netIncome)}</td></tr>
        </tbody>
      </table>
    );
  }

  if (reportKey === "bs") {
    const d = data as ReturnType<typeof balanceSheet>;
    return (
      <>
        {!d.balanced && <p className="mb-2 rounded bg-action-50 px-2 py-1 text-xs text-action-700">Balance sheet does not balance — investigate.</p>}
        <table className={`w-full ${wrap}`}>
          <tbody>
            <GroupRows g={d.currentAssets} print={print} />
            <GroupRows g={d.fixedAssets} print={print} />
            <tr className="text-base font-extrabold"><td className="py-2">Total assets</td><td className="py-2 text-right font-mono">{money(d.totalAssets)}</td></tr>
            <GroupRows g={d.currentLiabilities} print={print} />
            <GroupRows g={d.longLiabilities} print={print} />
            <tr className="font-bold"><td className="py-1.5">Total liabilities</td><td className="py-1.5 text-right font-mono">{money(d.totalLiabilities)}</td></tr>
            <GroupRows g={d.equity} print={print} />
            <tr className="border-b border-mist-100"><td className="py-1.5 pl-3">Retained earnings</td><td className="py-1.5 text-right font-mono">{money(d.retainedEarnings)}</td></tr>
            <tr className="font-bold"><td className="py-1.5">Total equity</td><td className="py-1.5 text-right font-mono">{money(d.totalEquity)}</td></tr>
            <tr className="border-t-2 border-brand-600 text-base font-extrabold"><td className="py-2">Total liabilities & equity</td><td className="py-2 text-right font-mono">{money(d.totalLiabilitiesAndEquity)}</td></tr>
          </tbody>
        </table>
      </>
    );
  }

  if (reportKey === "cf") {
    const d = data as ReturnType<typeof cashFlow>;
    const r = (label: string, v: number, indent = true) => (
      <tr className="border-b border-mist-100"><td className={`py-1.5 ${indent ? "pl-3" : "font-semibold"}`}>{label}</td><td className="py-1.5 text-right font-mono">{money(v)}</td></tr>
    );
    return (
      <table className={`w-full ${wrap}`}>
        <tbody>
          <tr><td className="pt-2 text-[11px] font-bold uppercase text-mist-500" colSpan={2}>Operating activities</td></tr>
          {r("Net income", d.operating.netIncome)}
          {r("Add: depreciation", d.operating.depreciation)}
          {r("Change in receivables", d.operating.arChange)}
          {r("Change in inventory", d.operating.invChange)}
          {r("Change in payables", d.operating.apChange)}
          {r("Change in other current liabilities", d.operating.otherCurrentLiabChange)}
          <tr className="border-b-2 border-mist-300 font-bold"><td className="py-1.5">Net cash from operations</td><td className="py-1.5 text-right font-mono">{money(d.operating.total)}</td></tr>
          <tr><td className="pt-2 text-[11px] font-bold uppercase text-mist-500" colSpan={2}>Investing activities</td></tr>
          {r("Purchase of fixed assets", d.investing.fixedAssetChange)}
          <tr className="border-b-2 border-mist-300 font-bold"><td className="py-1.5">Net cash from investing</td><td className="py-1.5 text-right font-mono">{money(d.investing.total)}</td></tr>
          <tr><td className="pt-2 text-[11px] font-bold uppercase text-mist-500" colSpan={2}>Financing activities</td></tr>
          {r("Change in equity", d.financing.equityChange)}
          {r("Change in loans", d.financing.loanChange)}
          <tr className="border-b-2 border-mist-300 font-bold"><td className="py-1.5">Net cash from financing</td><td className="py-1.5 text-right font-mono">{money(d.financing.total)}</td></tr>
          <tr className="font-bold"><td className="py-2">Net change in cash</td><td className="py-2 text-right font-mono">{money(d.netChange)}</td></tr>
          {r("Opening cash", d.cashOpen)}
          <tr className="border-t-2 border-brand-600 text-base font-extrabold"><td className="py-2">Closing cash</td><td className="py-2 text-right font-mono">{money(d.cashClose)}</td></tr>
          {!d.reconciles && <tr><td colSpan={2} className="pt-1 text-xs text-action-600">Does not reconcile to the change in cash on the balance sheet.</td></tr>}
        </tbody>
      </table>
    );
  }

  if (reportKey === "tb") {
    const rows = data as { account: { number: number; name: string }; debit: number; credit: number }[];
    const td = rows.reduce((n, r) => n + r.debit, 0);
    const tc = rows.reduce((n, r) => n + r.credit, 0);
    return (
      <table className={`w-full ${wrap}`}>
        <thead><tr className="border-b border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.account.number} className="border-b border-mist-100"><td className="py-1.5">{r.account.number} — {r.account.name}</td><td className="text-right font-mono">{r.debit > 0 ? money(r.debit) : ""}</td><td className="text-right font-mono">{r.credit > 0 ? money(r.credit) : ""}</td></tr>
          ))}
          <tr className="border-t-2 border-brand-600 font-bold"><td className="py-2">Totals</td><td className="text-right font-mono">{money(td)}</td><td className="text-right font-mono">{money(tc)}</td></tr>
        </tbody>
      </table>
    );
  }

  if (reportKey === "gl") {
    const rows = data as ReturnType<typeof generalLedgerReport>;
    return (
      <table className={`w-full ${wrap}`}>
        <thead><tr className="border-b border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Account</th><th className="text-right">Opening</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Closing</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.account.number} className="border-b border-mist-100">
              <td className="py-1.5">{r.account.number} — {r.account.name}</td>
              <td className="text-right font-mono">{money(r.opening)}</td>
              <td className="text-right font-mono">{r.debit > 0 ? money(r.debit) : ""}</td>
              <td className="text-right font-mono">{r.credit > 0 ? money(r.credit) : ""}</td>
              <td className="text-right font-mono font-semibold">{money(r.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportKey === "ar-aging" || reportKey === "ap-aging") {
    const rows = data as { customer?: { name: string }; vendor?: { name: string }; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }[];
    const sum = (k: keyof (typeof rows)[number]) => rows.reduce((n, r) => n + (r[k] as number), 0);
    return (
      <table className={`w-full ${wrap}`}>
        <thead><tr className="border-b border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Party</th><th className="text-right">Current</th><th className="text-right">1–30</th><th className="text-right">31–60</th><th className="text-right">61–90</th><th className="text-right">90+</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {rows.filter((r) => r.total > 0).map((r, i) => (
            <tr key={i} className="border-b border-mist-100">
              <td className="py-1.5">{r.customer?.name ?? r.vendor?.name}</td>
              <td className="text-right font-mono">{money(r.current)}</td>
              <td className="text-right font-mono">{money(r.d1_30)}</td>
              <td className="text-right font-mono">{money(r.d31_60)}</td>
              <td className="text-right font-mono">{money(r.d61_90)}</td>
              <td className="text-right font-mono">{money(r.d90plus)}</td>
              <td className="text-right font-mono font-bold">{money(r.total)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-brand-600 font-bold">
            <td className="py-2">Total</td>
            <td className="text-right font-mono">{money(sum("current"))}</td>
            <td className="text-right font-mono">{money(sum("d1_30"))}</td>
            <td className="text-right font-mono">{money(sum("d31_60"))}</td>
            <td className="text-right font-mono">{money(sum("d61_90"))}</td>
            <td className="text-right font-mono">{money(sum("d90plus"))}</td>
            <td className="text-right font-mono">{money(sum("total"))}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  if (reportKey === "inv-val") {
    const rows = data as ReturnType<typeof inventoryValuationReport>;
    return (
      <table className={`w-full ${wrap}`}>
        <thead><tr className="border-b border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Item</th><th>Method</th><th className="text-right">Qty</th><th className="text-right">Valuation</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item.id} className="border-b border-mist-100"><td className="py-1.5">{r.item.sku} — {r.item.name}</td><td>{r.item.valuationMethod}</td><td className="text-right font-mono">{r.qty} {r.item.unit}</td><td className="text-right font-mono">{money(r.valuation)}</td></tr>
          ))}
          <tr className="border-t-2 border-brand-600 font-bold"><td className="py-2" colSpan={3}>Total inventory value</td><td className="text-right font-mono">{money(rows.reduce((n, r) => n + r.valuation, 0))}</td></tr>
        </tbody>
      </table>
    );
  }

  if (reportKey === "fa-reg") {
    const rows = data as ReturnType<typeof fixedAssetRegisterReport>;
    return (
      <table className={`w-full ${wrap}`}>
        <thead><tr className="border-b border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Tag</th><th>Asset</th><th className="text-right">Cost</th><th className="text-right">Accum. dep.</th><th className="text-right">NBV</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.asset.id} className="border-b border-mist-100">
              <td className="py-1.5 font-mono text-xs">{r.asset.tag}</td>
              <td>{r.asset.name}</td>
              <td className="text-right font-mono">{money(r.asset.cost)}</td>
              <td className="text-right font-mono">{money(r.asset.accumulatedDepreciation)}</td>
              <td className="text-right font-mono font-semibold">{money(r.nbv)}</td>
              <td>{!print && <Badge tone={r.asset.status === "Active" ? "brand" : "mist"}>{r.asset.status}</Badge>}{print && r.asset.status}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-brand-600 font-bold">
            <td className="py-2" colSpan={2}>Totals</td>
            <td className="text-right font-mono">{money(rows.reduce((n, r) => n + r.asset.cost, 0))}</td>
            <td className="text-right font-mono">{money(rows.reduce((n, r) => n + r.asset.accumulatedDepreciation, 0))}</td>
            <td className="text-right font-mono">{money(rows.reduce((n, r) => n + r.nbv, 0))}</td>
            <td />
          </tr>
        </tbody>
      </table>
    );
  }

  return null;
}
