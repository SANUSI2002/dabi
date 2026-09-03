import { useState } from "react";
import { FolderKanban, Plus, Timer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Progress, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { staff } from "@/data/mock";
import { shortDate } from "@/lib/format";

export default function WorkTasks() {
  const { containers, tasks, activities, addTask, logActivity } = useWorkforce();
  const [taskModal, setTaskModal] = useState(false);
  const [actModal, setActModal] = useState<string | null>(null);
  const [tf, setTf] = useState({ containerId: containers[0].id, name: "", assignedTo: "Nursing team", status: "Not started" as const, estimateHours: 8 });
  const [af, setAf] = useState({ staff: staff[0].name, date: "", hours: 1, note: "" });

  const logged = tasks.reduce((n, t) => n + t.loggedHours, 0);

  return (
    <div>
      <PageHeader
        title="Work & Tasks"
        subtitle="Configurable work containers, tasks, subtasks & activities — allocation reconciles to approved worked time"
        actions={<Button onClick={() => setTaskModal(true)}><Plus size={15} /> New Task</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Work Containers" value={containers.length} tone="brand" icon={<FolderKanban size={18} />} />
        <StatCard label="Tasks" value={tasks.length} tone="mist" delay={0.05} />
        <StatCard label="Activities logged" value={activities.length} tone="mist" delay={0.1} />
        <StatCard label="Hours allocated" value={logged.toFixed(1)} tone="brand" delay={0.15} icon={<Timer size={18} />} />
      </div>

      <Tabs tabs={["Containers", "Task Board", "Activity Log"]}>
        {(t) =>
          t === "Containers" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {containers.map((c) => {
                const ct = tasks.filter((x) => x.containerId === c.id);
                const est = ct.reduce((n, x) => n + x.estimateHours, 0);
                const log = ct.reduce((n, x) => n + x.loggedHours, 0);
                return (
                  <div key={c.id} className="card">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{c.label}</p>
                        <p className="font-display font-bold text-mist-900">{c.name}</p>
                        <p className="text-[11px] text-mist-400">{c.code} · owner {c.owner}</p>
                      </div>
                      <Badge tone={c.status === "Active" ? "brand" : "mist"}>{c.status}</Badge>
                    </div>
                    <div className="mb-1.5 flex justify-between text-xs text-mist-500">
                      <span>{ct.length} tasks · {log.toFixed(1)}h of {est}h</span>
                      <span>{est ? Math.round((log / est) * 100) : 0}%</span>
                    </div>
                    <Progress value={log} target={est || 1} />
                  </div>
                );
              })}
            </div>
          ) : t === "Task Board" ? (
            <Table columns={["Task", "Container", "Assigned to", "Status", "Progress", ""]}>
              {tasks.map((tk, i) => {
                const c = containers.find((x) => x.id === tk.containerId);
                return (
                  <Row key={tk.id} index={i}>
                    <Cell className="font-semibold">{tk.parentId ? "↳ " : ""}{tk.name}</Cell>
                    <Cell className="text-mist-500">{c?.name}</Cell>
                    <Cell>{tk.assignedTo}</Cell>
                    <Cell><Badge tone={statusTone(tk.status === "Done" ? "completed" : tk.status === "Blocked" ? "referred" : tk.status === "In progress" ? "in progress" : "waiting")}>{tk.status}</Badge></Cell>
                    <Cell>
                      <div className="w-28"><Progress value={tk.loggedHours} target={tk.estimateHours || 1} /></div>
                      <span className="text-[11px] text-mist-400">{tk.loggedHours}/{tk.estimateHours}h</span>
                    </Cell>
                    <Cell>
                      <button onClick={() => { setActModal(tk.id); setAf({ ...af, date: "" }); }} className="btn-soft px-2.5 py-1 text-xs"><Timer size={12} /> Log time</button>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Date", "Staff", "Task", "Hours", "Note"]}>
              {activities.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell>{shortDate(a.date)}</Cell>
                  <Cell className="font-semibold">{a.staff}</Cell>
                  <Cell>{tasks.find((x) => x.id === a.taskId)?.name ?? a.taskId}</Cell>
                  <Cell>{a.hours}h</Cell>
                  <Cell className="text-mist-500">{a.note}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title="New Task"
        wide
        footer={<><Button variant="ghost" onClick={() => setTaskModal(false)}>Cancel</Button>
          <Button disabled={!tf.name} onClick={() => { addTask(tf); setTaskModal(false); }}>Create Task</Button></>}
      >
        <Grid cols={2}>
          <Field label="Work container"><Select value={tf.containerId} onChange={(e) => setTf({ ...tf, containerId: e.target.value })} options={containers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Task name"><Input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} /></Field>
          <Field label="Assigned to"><Input value={tf.assignedTo} onChange={(e) => setTf({ ...tf, assignedTo: e.target.value })} placeholder="Person or team" /></Field>
          <Field label="Estimate (hours)"><Input type="number" value={tf.estimateHours} onChange={(e) => setTf({ ...tf, estimateHours: +e.target.value })} /></Field>
        </Grid>
      </Modal>

      <Modal
        open={!!actModal}
        onClose={() => setActModal(null)}
        title="Log Activity"
        footer={<><Button variant="ghost" onClick={() => setActModal(null)}>Cancel</Button>
          <Button disabled={!af.date || af.hours <= 0} onClick={() => { if (actModal) logActivity({ ...af, taskId: actModal, date: new Date(af.date).toISOString().slice(0, 10) }); setActModal(null); }}>Log</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={3}>
            <Field label="Staff"><Select value={af.staff} onChange={(e) => setAf({ ...af, staff: e.target.value })} options={staff.map((s) => s.name)} /></Field>
            <Field label="Date"><Input type="date" value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })} /></Field>
            <Field label="Hours"><Input type="number" step="0.25" value={af.hours} onChange={(e) => setAf({ ...af, hours: +e.target.value })} /></Field>
          </Grid>
          <Field label="Note"><Input value={af.note} onChange={(e) => setAf({ ...af, note: e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Task allocation does not create additional payable time — activity totals reconcile to the approved worked-time envelope.
          </p>
        </div>
      </Modal>
    </div>
  );
}
