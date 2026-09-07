import { useState } from "react";
import { Plus, RefreshCw, Link2, Unplug, Trash2, Zap } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, timeAgo, shortDate } from "@/lib/format";
import { useBanking } from "@/store/accounting/useBanking";
import { useLedger } from "@/store/accounting/useLedger";
import type { BankConnection, ReconciliationRule } from "@/data/accounting/banking";

const PROVIDERS: BankConnection["provider"][] = ["Mono", "Okra", "Stitch", "Manual"];

export default function BankFeeds() {
  const { accounts, connections, reconciliationRules, statementLines, connectBank, disconnectBank, syncFeed, addRule, updateRule, removeRule, applyRulesTo } = useBanking();
  const allAccts = useLedger((s) => s.accounts).filter((a) => a.isActive);
  const [connect, setConnect] = useState(false);
  const [cf, setCf] = useState({ account: accounts[0]?.accountNumber ?? 1010, provider: "Mono" as BankConnection["provider"] });
  const [ruleModal, setRuleModal] = useState(false);
  const [rf, setRf] = useState<{ accountNumber: number; name: string; descriptionContains: string; direction: "" | "in" | "out"; contraAccount: number; memo: string }>({ accountNumber: 1010, name: "", descriptionContains: "", direction: "", contraAccount: 5600, memo: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const feedLines = statementLines.filter((l) => l.origin === "feed");
  const autoCleared = feedLines.filter((l) => l.ruleApplied).length;

  return (
    <div>
      <PageHeader title="Bank Feeds & Rules" subtitle="Connected bank feeds pull transactions automatically; rules categorise and post the routine ones"
        actions={<Button onClick={() => setConnect(true)}><Plus size={15} /> Connect a Bank</Button>} />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Connections" value={connections.filter((c) => c.status === "Connected").length} tone="brand" icon={<Link2 size={18} />} />
        <StatCard label="Feed transactions" value={feedLines.length} tone="mist" delay={0.05} />
        <StatCard label="Auto-categorised" value={autoCleared} tone="brand" delay={0.1} />
        <StatCard label="Rules" value={reconciliationRules.filter((r) => r.active).length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Connections", "Rules"]}>
        {(t) =>
          t === "Rules" ? (
            <Card className="p-0">
              <div className="flex justify-end p-3"><Button variant="soft" onClick={() => setRuleModal(true)}><Plus size={13} /> Add Rule</Button></div>
              {reconciliationRules.length === 0 ? <EmptyState title="No rules" /> : (
                <Table columns={["Name", "Account", "Match", "Direction", "Posts to", "Active", ""]}>
                  {reconciliationRules.map((r, i) => (
                    <Row key={r.id} index={i}>
                      <Cell className="font-semibold">{r.name}</Cell>
                      <Cell className="font-mono text-xs">{r.accountNumber}</Cell>
                      <Cell className="text-mist-500">“{r.descriptionContains}”</Cell>
                      <Cell>{r.direction ? <Badge tone="mist">{r.direction === "in" ? "money in" : "money out"}</Badge> : "any"}</Cell>
                      <Cell className="font-mono text-xs">{r.contraAccount}</Cell>
                      <Cell><button onClick={() => updateRule(r.id, { active: !r.active })}><Badge tone={r.active ? "brand" : "mist"}>{r.active ? "On" : "Off"}</Badge></button></Cell>
                      <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => removeRule(r.id)}><Trash2 size={12} /></button></Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Card>
          ) : connections.length === 0 ? (
            <EmptyState title="No bank feeds connected" hint="Connect a feed to pull transactions automatically." />
          ) : (
            <Card className="p-0">
              <Table columns={["Bank", "Provider", "Account", "Status", "Last sync", ""]}>
                {connections.map((c, i) => (
                  <Row key={c.id} index={i}>
                    <Cell className="font-semibold">{c.institution}</Cell>
                    <Cell><Badge tone="mist">{c.provider}</Badge></Cell>
                    <Cell className="font-mono text-xs">{accounts.find((a) => a.accountNumber === c.accountNumber)?.accountNo ?? c.accountNumber}</Cell>
                    <Cell><Badge tone={c.status === "Connected" ? "brand" : c.status === "Error" ? "action" : "mist"}>{c.status}</Badge></Cell>
                    <Cell>{c.lastSyncAt ? timeAgo(c.lastSyncAt) : "never"}</Cell>
                    <Cell>
                      <div className="flex justify-end gap-1">
                        {c.status === "Connected" && <>
                          <button className="btn-primary px-2 py-1 text-xs" onClick={() => { const r = syncFeed(c.id); setMsg(`Pulled ${r.imported} transaction(s); ${r.autoMatched} auto-categorised by rules. The rest are in Reconciliation.`); }}><RefreshCw size={11} /> Sync</button>
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { const r = applyRulesTo(c.accountNumber); setMsg(`${r.matched} line(s) matched.`); }}><Zap size={11} /></button>
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => disconnectBank(c.id)}><Unplug size={11} /></button>
                        </>}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      {feedLines.length > 0 && (
        <Card className="mt-4 p-0">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Recent feed transactions</p>
          <Table columns={["Date", "Description", "Amount", "Status"]}>
            {feedLines.slice(0, 12).map((l, i) => (
              <Row key={l.id} index={i}>
                <Cell className="whitespace-nowrap text-mist-500">{shortDate(l.date)}</Cell>
                <Cell className="max-w-[320px] truncate">{l.description}</Cell>
                <Cell className={`font-mono ${l.amount < 0 ? "text-action-600" : ""}`}>{money(l.amount)}</Cell>
                <Cell>{l.reconciled ? <Badge tone="brand">{l.ruleApplied ? "auto-posted" : "matched"}</Badge> : <Badge tone="amber">to review</Badge>}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={connect} onClose={() => setConnect(false)} title="Connect a Bank Feed"
        footer={<><Button variant="ghost" onClick={() => setConnect(false)}>Cancel</Button><Button onClick={() => { connectBank(cf.account, cf.provider); setConnect(false); setMsg("Feed connected. Hit Sync to pull transactions."); }}>Authorise & connect</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-600">Pick the account and open-banking provider. In production this opens the provider's consent screen; here it links a simulated feed.</p>
          <Field label="Bank account"><Select value={String(cf.account)} onChange={(e) => setCf({ ...cf, account: +e.target.value })} options={accounts.map((a) => ({ value: String(a.accountNumber), label: `${a.accountName} (${a.accountNo})` }))} /></Field>
          <Field label="Provider"><Select value={cf.provider} onChange={(e) => setCf({ ...cf, provider: e.target.value as never })} options={PROVIDERS} /></Field>
        </div>
      </Modal>

      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title="New Reconciliation Rule"
        footer={<><Button variant="ghost" onClick={() => setRuleModal(false)}>Cancel</Button><Button onClick={() => { addRule({ accountNumber: rf.accountNumber, name: rf.name, descriptionContains: rf.descriptionContains || undefined, direction: rf.direction || undefined, contraAccount: rf.contraAccount, memo: rf.memo || undefined }); setRuleModal(false); }} disabled={!rf.name || !rf.descriptionContains}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Rule name"><Input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} /></Field>
          <Field label="Bank account"><Select value={String(rf.accountNumber)} onChange={(e) => setRf({ ...rf, accountNumber: +e.target.value })} options={accounts.map((a) => ({ value: String(a.accountNumber), label: a.accountName }))} /></Field>
          <Field label="Description contains"><Input value={rf.descriptionContains} onChange={(e) => setRf({ ...rf, descriptionContains: e.target.value })} placeholder="e.g. COMMISSION" /></Field>
          <Field label="Direction"><Select value={rf.direction} onChange={(e) => setRf({ ...rf, direction: e.target.value as never })} options={[{ value: "", label: "Any" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} /></Field>
          <Field label="Post contra to (account)"><Select value={String(rf.contraAccount)} onChange={(e) => setRf({ ...rf, contraAccount: +e.target.value })} options={allAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          <Field label="Memo"><Input value={rf.memo} onChange={(e) => setRf({ ...rf, memo: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
