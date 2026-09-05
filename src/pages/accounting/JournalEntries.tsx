import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Check, Ban, Scale } from "lucide-react";
import { PageHeader, Button, Badge, Card, StatCard, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, dateTime, isoDate } from "@/lib/format";
import { useLedger, type DraftLine } from "@/store/accounting/useLedger";
import { useHr } from "@/store/useHr";
import type { JournalEntry } from "@/data/accounting/journal";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const emptyLine = (): DraftLine => ({ accountNumber: 0, debit: 0, credit: 0, description: "" });

export default function JournalEntries() {
  const { entries, accounts, postJournal, reverseEntry, voidDraft, postDraft, isDateLocked } = useLedger();
  const staff = useHr((s) => s.staff);
  const nameOf = (id?: string) => staff.find((x) => x.id === id)?.name ?? "—";
  const manualAccts = accounts.filter((a) => a.isActive).sort((a, b) => a.number - b.number);

  const [create, setCreate] = useState(false);
  const [view, setView] = useState<JournalEntry | null>(null);
  const [reverseFor, setReverseFor] = useState<JournalEntry | null>(null);
  const [q, setQ] = useState("");

  // ---- new entry form ----
  const [date, setDate] = useState(isoDate(new Date()));
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [err, setErr] = useState<string | null>(null);

  const totalDr = round2(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0));
  const totalCr = round2(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0));
  const diff = round2(totalDr - totalCr);
  const lock = isDateLocked(new Date(date + "T12:00:00.000Z").toISOString());

  function resetForm() {
    setDate(isoDate(new Date()));
    setMemo("");
    setReference("");
    setLines([emptyLine(), emptyLine()]);
    setErr(null);
  }

  function save(status: "Draft" | "Posted") {
    setErr(null);
    const res = postJournal({
      date: new Date(date + "T12:00:00.000Z").toISOString(),
      source: "Manual",
      memo: memo.trim() || "Manual journal entry",
      reference: reference.trim() || undefined,
      lines: lines.map((l) => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      status,
    });
    if (!res.ok) return setErr(res.error ?? "Could not save");
    setCreate(false);
    resetForm();
  }

  const [reverseDate, setReverseDate] = useState(isoDate(new Date()));
  const [reverseMemo, setReverseMemo] = useState("");
  const [reverseErr, setReverseErr] = useState<string | null>(null);
  function doReverse() {
    if (!reverseFor) return;
    const res = reverseEntry(reverseFor.id, {
      date: new Date(reverseDate + "T12:00:00.000Z").toISOString(),
      memo: reverseMemo.trim() || undefined,
    });
    if (!res.ok) return setReverseErr(res.error ?? "Could not reverse");
    setReverseFor(null);
    setReverseErr(null);
    setView(null);
  }

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return entries.filter((e) => !s || e.number.toLowerCase().includes(s) || e.memo.toLowerCase().includes(s) || e.source.toLowerCase().includes(s) || (e.reference ?? "").toLowerCase().includes(s));
  }, [entries, q]);

  const posted = entries.filter((e) => e.status === "Posted");
  const drafts = entries.filter((e) => e.status === "Draft" || e.status === "Pending Approval");

  return (
    <div>
      <PageHeader
        title="Journal Entries"
        subtitle="The double-entry record — every financial event lands here as a balanced entry"
        actions={<Button onClick={() => { resetForm(); setCreate(true); }}><Plus size={15} /> New Journal Entry</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Posted entries" value={posted.length} tone="brand" icon={<Scale size={18} />} />
        <StatCard label="Drafts" value={drafts.length} tone="amber" delay={0.05} />
        <StatCard label="Reversed" value={entries.filter((e) => e.status === "Reversed").length} tone="mist" delay={0.1} />
        <StatCard label="This year" value={entries.filter((e) => new Date(e.date).getUTCFullYear() === new Date().getUTCFullYear()).length} tone="mist" delay={0.15} />
      </div>

      <Card className="mb-4">
        <Input placeholder="Search by number, memo, source or reference…" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      <Tabs tabs={["All", "Posted", "Drafts", "Reversed"]}>
        {(t) => {
          const list = filtered.filter((e) =>
            t === "All" ? true : t === "Posted" ? e.status === "Posted" : t === "Drafts" ? e.status === "Draft" || e.status === "Pending Approval" : e.status === "Reversed",
          );
          if (!list.length) return <EmptyState title="Nothing here yet" />;
          return (
            <Card className="p-0">
              <Table columns={["Entry", "Date", "Source", "Memo", "Debit", "Credit", "Status"]}>
                {list.map((e, i) => {
                  const dr = e.lines.reduce((n, l) => n + l.debit, 0);
                  return (
                    <Row key={e.id} index={i} onClick={() => setView(e)}>
                      <Cell className="font-mono text-xs">{e.number}</Cell>
                      <Cell className="whitespace-nowrap text-mist-500">{shortDate(e.date)}</Cell>
                      <Cell><Badge tone="mist">{e.source}</Badge></Cell>
                      <Cell className="max-w-[280px] truncate">{e.memo}</Cell>
                      <Cell className="font-mono">{money(dr)}</Cell>
                      <Cell className="font-mono">{money(dr)}</Cell>
                      <Cell><Badge tone={statusTone(e.status === "Reversed" ? "returned" : e.status)}>{e.status}</Badge></Cell>
                    </Row>
                  );
                })}
              </Table>
            </Card>
          );
        }}
      </Tabs>

      {/* ---- New entry ---- */}
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="New Journal Entry"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button>
            <Button variant="soft" onClick={() => save("Draft")}>Save draft</Button>
            <Button onClick={() => save("Posted")} disabled={diff !== 0 || totalDr === 0 || lock.locked}>Post entry</Button>
          </>
        }
      >
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          {lock.locked && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{lock.reason} You can still save it as a draft.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Doc / cheque no." /></Field>
            <Field label="Memo"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" /></Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Lines</span>
              <button className="btn-soft px-2 py-1 text-xs" onClick={() => setLines((l) => [...l, emptyLine()])}><Plus size={12} /> Add line</button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px_28px] items-start gap-2">
                  <Select
                    value={String(l.accountNumber || "")}
                    onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, accountNumber: Number(e.target.value) } : y)))}
                    options={[{ value: "", label: "Select account…" }, ...manualAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}${a.allowManualEntry ? "" : " (subledger)"}` }))]}
                  />
                  <Input type="number" placeholder="Debit" value={l.debit || ""} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, debit: +e.target.value, credit: 0 } : y)))} />
                  <Input type="number" placeholder="Credit" value={l.credit || ""} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, credit: +e.target.value, debit: 0 } : y)))} />
                  <button className="mt-2 text-action-500 hover:text-action-700" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className={`mt-3 flex justify-end gap-6 border-t border-mist-200 pt-2 text-sm font-bold ${diff === 0 && totalDr > 0 ? "text-brand-700" : "text-action-600"}`}>
              <span>Debits {money(totalDr)}</span>
              <span>Credits {money(totalCr)}</span>
              <span>{diff === 0 ? (totalDr > 0 ? "Balanced ✓" : "—") : `Off by ${money(Math.abs(diff))}`}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ---- View entry ---- */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.number} — ${view.source}` : ""} wide
        footer={
          view && (
            <>
              <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
              {view.status === "Draft" && (
                <>
                  <Button variant="ghost" onClick={() => { voidDraft(view.id); setView(null); }}><Ban size={14} /> Void</Button>
                  <Button onClick={() => { const r = postDraft(view.id); if (r.ok) setView(null); }}><Check size={14} /> Post</Button>
                </>
              )}
              {view.status === "Posted" && (
                <Button variant="action" onClick={() => { setReverseFor(view); setReverseDate(isoDate(new Date())); setReverseMemo(`Reversal of ${view.number}`); }}>
                  <RotateCcw size={14} /> Reverse
                </Button>
              )}
            </>
          )
        }
      >
        {view && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Date</span> · {shortDate(view.date)}</div>
              <div><span className="text-mist-400">Status</span> · <Badge tone={statusTone(view.status === "Reversed" ? "returned" : view.status)}>{view.status}</Badge></div>
              <div><span className="text-mist-400">Memo</span> · {view.memo}</div>
              {view.reference && <div><span className="text-mist-400">Reference</span> · {view.reference}</div>}
              <div><span className="text-mist-400">Created by</span> · {nameOf(view.createdBy)} · {dateTime(view.createdAt)}</div>
              {view.postedAt && <div><span className="text-mist-400">Posted by</span> · {nameOf(view.postedBy)} · {dateTime(view.postedAt)}</div>}
              {view.reversesEntryId && <div className="text-action-600">Reverses {view.reference}</div>}
              {view.reversedByEntryId && <div className="text-action-600">Reversed by a later entry</div>}
            </div>
            <Table columns={["Account", "Description", "Debit", "Credit"]}>
              {view.lines.map((l, i) => {
                const a = accounts.find((x) => x.number === l.accountNumber);
                return (
                  <Row key={l.id} index={i}>
                    <Cell className="font-semibold">{l.accountNumber} — {a?.name ?? "?"}</Cell>
                    <Cell className="text-mist-500">{l.description || "—"}</Cell>
                    <Cell className="font-mono">{l.debit > 0 ? money(l.debit) : ""}</Cell>
                    <Cell className="font-mono">{l.credit > 0 ? money(l.credit) : ""}</Cell>
                  </Row>
                );
              })}
              <Row index={view.lines.length} className="border-t-2 border-mist-300 font-bold">
                <Cell /><Cell className="text-right">Totals</Cell>
                <Cell className="font-mono">{money(view.lines.reduce((n, l) => n + l.debit, 0))}</Cell>
                <Cell className="font-mono">{money(view.lines.reduce((n, l) => n + l.credit, 0))}</Cell>
              </Row>
            </Table>
          </div>
        )}
      </Modal>

      {/* ---- Reverse ---- */}
      <Modal open={!!reverseFor} onClose={() => setReverseFor(null)} title={reverseFor ? `Reverse ${reverseFor.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setReverseFor(null)}>Cancel</Button><Button variant="action" onClick={doReverse}>Book reversing entry</Button></>}
      >
        <div className="space-y-3">
          {reverseErr && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{reverseErr}</p>}
          <p className="text-sm text-mist-600">A new entry will be posted with the debits and credits swapped. The original stays in the ledger, marked <b>Reversed</b> — nothing is deleted.</p>
          <Field label="Reversal date"><Input type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} /></Field>
          <Field label="Memo"><Textarea value={reverseMemo} onChange={(e) => setReverseMemo(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
