import { useState } from "react";
import { Headset, Plus, Star, HelpCircle } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useHelpdesk } from "@/store/useHelpdesk";
import { useHr } from "@/store/useHr";
import { useOrg } from "@/store/useOrg";
import { useIdentity } from "@/store/useIdentity";
import { shortDate } from "@/lib/format";
import type { TicketType, AssigningType, TicketPriority } from "@/data/helpdesk";

const TYPES: TicketType[] = ["IT Support", "HR Complaint", "Facilities", "Benefits", "General"];

function PriorityStars({ value }: { value: TicketPriority }) {
  return (
    <span className="flex gap-0.5 text-amber-400">
      {[1, 2, 3].map((n) => <Star key={n} size={12} fill={n <= value ? "currentColor" : "none"} />)}
    </span>
  );
}

export default function Helpdesk() {
  const { tickets, faqCategories, faqs, createTicket, setStatus, assignTo, addFaq, ticketCode } = useHelpdesk();
  const staff = useHr((s) => s.staff);
  const { departments, jobPositions } = useOrg();
  const me = useIdentity((s) => s.user.id);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const myTickets = tickets.filter((t) => t.raisedBy === me);
  const openCount = tickets.filter((t) => t.status !== "Resolved").length;

  const [createOpen, setCreateOpen] = useState(false);
  const [f, setF] = useState<{ type: TicketType; title: string; description: string; assigningType: AssigningType; raisedOn: string; priority: TicketPriority }>({
    type: "IT Support", title: "", description: "", assigningType: "Department", raisedOn: departments[0]?.name ?? "", priority: 2,
  });
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [faqOpen, setFaqOpen] = useState(false);
  const [ff, setFf] = useState({ categoryId: faqCategories[0]?.id ?? "", question: "", answer: "" });

  function renderTable(list: typeof tickets) {
    return (
      <Table columns={["Ticket ID", "Title", "Type", "Raised by", "Assigned to", "Priority", "Status", ""]}>
        {list.map((t, i) => (
          <Row key={t.id} index={i}>
            <Cell className="font-mono text-xs">{ticketCode(t)}</Cell>
            <Cell className="font-semibold">{t.title}<span className="block text-[11px] font-normal text-mist-400">Forwarded to {t.assigningType === "Individual" ? name(t.raisedOn) : t.raisedOn}</span></Cell>
            <Cell><Badge tone="mist">{t.type}</Badge></Cell>
            <Cell className="text-mist-500">{name(t.raisedBy)}</Cell>
            <Cell className="text-mist-500">{t.assignedTo.length ? t.assignedTo.map(name).join(", ") : "—"}</Cell>
            <Cell><PriorityStars value={t.priority} /></Cell>
            <Cell><Badge tone={statusTone(t.status)}>{t.status}</Badge></Cell>
            <Cell>
              <div className="flex justify-end gap-1.5">
                {t.assignedTo.length === 0 && (
                  <button onClick={() => { setAssignFor(t.id); setAssignees([]); }} className="btn-ghost px-2 py-1 text-xs">Assign</button>
                )}
                {t.status !== "Resolved" && (
                  <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value as never)} className="input w-auto py-1 text-xs">
                    {["New", "In Progress", "On Hold", "Resolved"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </Cell>
          </Row>
        ))}
        {list.length === 0 && <Row><Cell className="text-mist-400">No tickets.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
      </Table>
    );
  }

  return (
    <div>
      <PageHeader
        title="Helpdesk"
        subtitle="Employee support tickets — IT, HR, facilities, benefits"
        actions={<Button onClick={() => { setF({ type: "IT Support", title: "", description: "", assigningType: "Department", raisedOn: departments[0]?.name ?? "", priority: 2 }); setCreateOpen(true); }}><Plus size={15} /> Create ticket</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="My tickets" value={myTickets.length} tone="brand" icon={<Headset size={18} />} />
        <StatCard label="Open" value={openCount} tone={openCount ? "amber" : "brand"} delay={0.05} />
        <StatCard label="Total" value={tickets.length} tone="mist" delay={0.1} />
        <StatCard label="FAQs" value={faqs.length} tone="mist" delay={0.15} icon={<HelpCircle size={18} />} />
      </div>

      <Tabs tabs={[`My Tickets (${myTickets.length})`, "All Tickets", "FAQ"]}>
        {(t) =>
          t.startsWith("My Tickets") ? renderTable(myTickets)
          : t === "All Tickets" ? renderTable(tickets)
          : (
            <div className="space-y-4">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setFf({ categoryId: faqCategories[0]?.id ?? "", question: "", answer: "" }); setFaqOpen(true); }}><Plus size={14} /> Add FAQ</Button></div>
              {faqCategories.map((c) => {
                const items = faqs.filter((f2) => f2.categoryId === c.id);
                if (items.length === 0) return null;
                return (
                  <Card key={c.id}>
                    <p className="mb-2 font-display font-bold text-mist-900">{c.name}</p>
                    <div className="space-y-3">
                      {items.map((f2) => (
                        <div key={f2.id} className="border-b border-dashed border-mist-100 pb-2 last:border-0">
                          <p className="text-sm font-semibold text-mist-800">{f2.question}</p>
                          <p className="text-sm text-mist-500">{f2.answer}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        }
      </Tabs>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create ticket"
        wide
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button disabled={!f.title.trim() || !f.description.trim()} onClick={() => { createTicket({ ...f, raisedBy: me }); setCreateOpen(false); }}>Submit</Button></>}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TicketType })} options={TYPES} /></Field>
            <Field label="Priority"><Select value={String(f.priority)} onChange={(e) => setF({ ...f, priority: +e.target.value as TicketPriority })} options={[{ value: "1", label: "Low" }, { value: "2", label: "Medium" }, { value: "3", label: "High" }]} /></Field>
            <Field label="Forward to">
              <Select value={f.assigningType} onChange={(e) => setF({ ...f, assigningType: e.target.value as AssigningType, raisedOn: e.target.value === "Department" ? departments[0]?.name ?? "" : e.target.value === "Job Position" ? jobPositions[0]?.name ?? "" : staff[0]?.id ?? "" })} options={["Department", "Job Position", "Individual"]} />
            </Field>
          </div>
          <Field label={f.assigningType === "Individual" ? "Employee" : f.assigningType}>
            {f.assigningType === "Department" ? (
              <Select value={f.raisedOn} onChange={(e) => setF({ ...f, raisedOn: e.target.value })} options={departments.map((d) => d.name)} />
            ) : f.assigningType === "Job Position" ? (
              <Select value={f.raisedOn} onChange={(e) => setF({ ...f, raisedOn: e.target.value })} options={jobPositions.map((p) => p.name)} />
            ) : (
              <Select value={f.raisedOn} onChange={(e) => setF({ ...f, raisedOn: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} />
            )}
          </Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title="Assign ticket"
        footer={<><Button variant="ghost" onClick={() => setAssignFor(null)}>Cancel</Button>
          <Button disabled={assignees.length === 0} onClick={() => { if (assignFor) assignTo(assignFor, assignees); setAssignFor(null); }}>Assign</Button></>}
      >
        <Field label="Assign to">
          <Select value={assignees[0] ?? ""} onChange={(e) => setAssignees(e.target.value ? [e.target.value] : [])} options={[{ value: "", label: "Select staff…" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
        </Field>
      </Modal>

      <Modal
        open={faqOpen}
        onClose={() => setFaqOpen(false)}
        title="Add FAQ"
        footer={<><Button variant="ghost" onClick={() => setFaqOpen(false)}>Cancel</Button>
          <Button disabled={!ff.question.trim() || !ff.answer.trim()} onClick={() => { addFaq(ff.categoryId, ff.question.trim(), ff.answer.trim()); setFaqOpen(false); }}>Publish</Button></>}
      >
        <div className="space-y-4">
          <Field label="Category"><Select value={ff.categoryId} onChange={(e) => setFf({ ...ff, categoryId: e.target.value })} options={faqCategories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Question"><Input value={ff.question} onChange={(e) => setFf({ ...ff, question: e.target.value })} /></Field>
          <Field label="Answer"><Textarea value={ff.answer} onChange={(e) => setFf({ ...ff, answer: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
