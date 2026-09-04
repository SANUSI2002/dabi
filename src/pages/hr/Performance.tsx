import { useState } from "react";
import { Target, Star, CalendarClock, Plus, CheckCircle2, MessageSquareText } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, Progress, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { usePerformance } from "@/store/usePerformance";
import { useHr } from "@/store/useHr";
import { shortDate, timeAgo, initials } from "@/lib/format";
import { FEEDBACK_QUESTIONS } from "@/data/performance";
import type { DurationUnit, FeedbackAnswer } from "@/data/performance";

export default function Performance() {
  const {
    objectives, employeeObjectives, keyResults, feedbacks, meetings,
    addObjective, updateKeyResultValue, setObjectiveStatus, startFeedback, submitFeedback, scheduleMeeting, completeMeeting,
  } = usePerformance();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const onTrack = employeeObjectives.filter((e) => e.status === "On Track" || e.status === "Closed").length;

  const [objOpen, setObjOpen] = useState(false);
  const [of, setOf] = useState<{ title: string; description: string; managerIds: string[]; assigneeIds: string[]; keyResultIds: string[]; durationUnit: DurationUnit; duration: number }>({
    title: "", description: "", managerIds: [], assigneeIds: [], keyResultIds: [], durationUnit: "Months", duration: 3,
  });

  const [fbOpen, setFbOpen] = useState(false);
  const [ff, setFf] = useState({ reviewCycle: "Q3 2026", employeeId: staff[0]?.id ?? "", managerId: "", colleagueIds: [] as string[] });
  const [answerFor, setAnswerFor] = useState<{ id: string; role: "self" | "manager" } | null>(null);
  const [answers, setAnswers] = useState<FeedbackAnswer[]>(FEEDBACK_QUESTIONS.map((q) => ({ question: q, rating: 3, comment: "" })));

  const [mtOpen, setMtOpen] = useState(false);
  const [mf, setMf] = useState({ title: "Monthly 1-on-1", employeeId: staff[0]?.id ?? "", managerId: staff[0]?.id ?? "", scheduledAt: "" });
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [cf, setCf] = useState({ notes: "", actionItems: "" });

  return (
    <div>
      <PageHeader title="Performance" subtitle="OKRs, 360° feedback and 1-on-1 meetings" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Objectives" value={objectives.length} tone="brand" icon={<Target size={18} />} />
        <StatCard label="On track / closed" value={`${onTrack}/${employeeObjectives.length}`} tone="brand" delay={0.05} />
        <StatCard label="Feedback in progress" value={feedbacks.filter((f) => f.status !== "Closed").length} tone="amber" delay={0.1} icon={<MessageSquareText size={18} />} />
        <StatCard label="Meetings scheduled" value={meetings.filter((m) => m.status === "Scheduled").length} tone="mist" delay={0.15} icon={<CalendarClock size={18} />} />
      </div>

      <Tabs tabs={["Objectives", "360° Feedback", "1-on-1 Meetings"]}>
        {(t) =>
          t === "Objectives" ? (
            <div className="space-y-4">
              <div className="flex justify-end"><Button onClick={() => { setOf({ title: "", description: "", managerIds: [], assigneeIds: [], keyResultIds: [], durationUnit: "Months", duration: 3 }); setObjOpen(true); }}><Plus size={14} /> New objective</Button></div>
              {objectives.map((o) => {
                const assigned = employeeObjectives.filter((e) => e.objectiveId === o.id);
                return (
                  <Card key={o.id}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display font-bold text-mist-900">{o.title}</p>
                      <Badge tone="mist">{o.duration} {o.durationUnit.toLowerCase()}</Badge>
                    </div>
                    <p className="mb-3 text-sm text-mist-500">{o.description}</p>
                    <div className="space-y-3">
                      {assigned.map((eo) => (
                        <div key={eo.id} className="rounded-xl bg-mist-50 p-3">
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-semibold text-mist-800">
                              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-gradient text-[10px] font-bold text-white">{initials(name(eo.employeeId))}</span>
                              {name(eo.employeeId)}
                            </span>
                            <Select
                              value={eo.status}
                              onChange={(e) => setObjectiveStatus(eo.id, e.target.value as never)}
                              className="w-auto py-1 text-xs"
                              options={["Not Started", "On Track", "Behind", "At Risk", "Closed"]}
                            />
                          </div>
                          <Progress value={eo.progressPercentage} target={100} tone={eo.status === "At Risk" ? "action" : "brand"} />
                          <div className="mt-2 space-y-1.5">
                            {eo.keyResults.map((kr) => (
                              <div key={kr.id} className="flex items-center justify-between gap-3 text-xs text-mist-600">
                                <span>{kr.title}</span>
                                <span className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    defaultValue={kr.currentValue}
                                    onBlur={(e) => updateKeyResultValue(eo.id, kr.id, +e.target.value)}
                                    className="input w-16 py-0.5 text-right text-xs"
                                  />
                                  / {kr.targetValue}{kr.type === "Percentage" ? "%" : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
              {objectives.length === 0 && <Card className="text-sm text-mist-400">No objectives yet.</Card>}
            </div>
          ) : t === "360° Feedback" ? (
            <div className="space-y-3">
              <div className="flex justify-end"><Button onClick={() => { setFf({ reviewCycle: "Q3 2026", employeeId: staff[0]?.id ?? "", managerId: "", colleagueIds: [] }); setFbOpen(true); }}><Plus size={14} /> Start feedback</Button></div>
              {feedbacks.map((f) => (
                <Card key={f.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-mist-900">{name(f.employeeId)}</p>
                      <p className="text-[11px] text-mist-400">{f.reviewCycle} · manager {f.managerId ? name(f.managerId) : "—"} · started {timeAgo(f.startDate)}</p>
                    </div>
                    <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setAnswerFor({ id: f.id, role: "self" }); setAnswers(FEEDBACK_QUESTIONS.map((q) => ({ question: q, rating: 3, comment: "" }))); }}
                      className="btn-soft px-2.5 py-1 text-xs"
                      disabled={!!f.selfAnswers}
                    >{f.selfAnswers ? <><CheckCircle2 size={12} /> Self done</> : "Submit self-review"}</button>
                    <button
                      onClick={() => { setAnswerFor({ id: f.id, role: "manager" }); setAnswers(FEEDBACK_QUESTIONS.map((q) => ({ question: q, rating: 3, comment: "" }))); }}
                      className="btn-soft px-2.5 py-1 text-xs"
                      disabled={!!f.managerAnswers}
                    >{f.managerAnswers ? <><CheckCircle2 size={12} /> Manager done</> : "Submit manager review"}</button>
                  </div>
                </Card>
              ))}
              {feedbacks.length === 0 && <Card className="text-sm text-mist-400">No feedback cycles yet.</Card>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end"><Button onClick={() => { setMf({ title: "Monthly 1-on-1", employeeId: staff[0]?.id ?? "", managerId: staff[0]?.id ?? "", scheduledAt: "" }); setMtOpen(true); }}><Plus size={14} /> Schedule meeting</Button></div>
              {meetings.map((m) => (
                <Card key={m.id}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-mist-900">{m.title} — {name(m.employeeId)}</p>
                      <p className="text-[11px] text-mist-400">with {name(m.managerId)} · {shortDate(m.scheduledAt)}</p>
                    </div>
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </div>
                  {m.notes && <p className="mt-1 text-sm text-mist-600">“{m.notes}”</p>}
                  {m.actionItems && <p className="text-xs text-mist-400">Action items: {m.actionItems}</p>}
                  {m.status === "Scheduled" && (
                    <button onClick={() => { setCompleteFor(m.id); setCf({ notes: "", actionItems: "" }); }} className="btn-primary mt-2 px-2.5 py-1 text-xs"><CheckCircle2 size={12} /> Mark completed</button>
                  )}
                </Card>
              ))}
              {meetings.length === 0 && <Card className="text-sm text-mist-400">No meetings scheduled.</Card>}
            </div>
          )
        }
      </Tabs>

      <Modal open={objOpen} onClose={() => setObjOpen(false)} title="New objective" wide
        footer={<><Button variant="ghost" onClick={() => setObjOpen(false)}>Cancel</Button>
          <Button disabled={!of.title.trim() || of.assigneeIds.length === 0 || of.keyResultIds.length === 0} onClick={() => { addObjective(of); setObjOpen(false); }}>Create</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={of.title} onChange={(e) => setOf({ ...of, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={of.description} onChange={(e) => setOf({ ...of, description: e.target.value })} /></Field>
          <Grid cols={2}>
            <Field label="Duration"><Input type="number" value={of.duration} onChange={(e) => setOf({ ...of, duration: +e.target.value })} /></Field>
            <Field label="Unit"><Select value={of.durationUnit} onChange={(e) => setOf({ ...of, durationUnit: e.target.value as DurationUnit })} options={["Days", "Months", "Years"]} /></Field>
          </Grid>
          <div>
            <p className="label mb-1.5">Key results</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {keyResults.map((kr) => (
                <Checkbox key={kr.id} label={kr.title} checked={of.keyResultIds.includes(kr.id)} onChange={(e) => setOf({ ...of, keyResultIds: e.target.checked ? [...of.keyResultIds, kr.id] : of.keyResultIds.filter((x) => x !== kr.id) })} />
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-1.5">Assignees</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {staff.map((s) => (
                <Checkbox key={s.id} label={s.name} checked={of.assigneeIds.includes(s.id)} onChange={(e) => setOf({ ...of, assigneeIds: e.target.checked ? [...of.assigneeIds, s.id] : of.assigneeIds.filter((x) => x !== s.id) })} />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={fbOpen} onClose={() => setFbOpen(false)} title="Start 360° feedback"
        footer={<><Button variant="ghost" onClick={() => setFbOpen(false)}>Cancel</Button>
          <Button disabled={!ff.employeeId} onClick={() => { startFeedback(ff); setFbOpen(false); }}>Start</Button></>}>
        <div className="space-y-4">
          <Field label="Review cycle"><Input value={ff.reviewCycle} onChange={(e) => setFf({ ...ff, reviewCycle: e.target.value })} /></Field>
          <Field label="Employee"><Select value={ff.employeeId} onChange={(e) => setFf({ ...ff, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Manager"><Select value={ff.managerId} onChange={(e) => setFf({ ...ff, managerId: e.target.value })} options={[{ value: "", label: "—" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!answerFor}
        onClose={() => setAnswerFor(null)}
        title={`${answerFor?.role === "self" ? "Self" : "Manager"} review`}
        wide
        footer={<><Button variant="ghost" onClick={() => setAnswerFor(null)}>Cancel</Button>
          <Button onClick={() => { if (answerFor) submitFeedback(answerFor.id, answerFor.role, answers); setAnswerFor(null); }}>Submit</Button></>}
      >
        <div className="space-y-4">
          {answers.map((a, i) => (
            <div key={a.question} className="rounded-xl bg-mist-50 p-3">
              <p className="mb-1.5 text-sm font-medium text-mist-700">{a.question}</p>
              <div className="mb-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setAnswers((arr) => arr.map((x, j) => (j === i ? { ...x, rating: n } : x)))} className="text-amber-400">
                    <Star size={16} fill={n <= a.rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <Input value={a.comment ?? ""} onChange={(e) => setAnswers((arr) => arr.map((x, j) => (j === i ? { ...x, comment: e.target.value } : x)))} placeholder="Comment (optional)" />
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={mtOpen} onClose={() => setMtOpen(false)} title="Schedule 1-on-1"
        footer={<><Button variant="ghost" onClick={() => setMtOpen(false)}>Cancel</Button>
          <Button disabled={!mf.scheduledAt} onClick={() => { scheduleMeeting({ ...mf, scheduledAt: new Date(mf.scheduledAt).toISOString() }); setMtOpen(false); }}>Schedule</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={mf.title} onChange={(e) => setMf({ ...mf, title: e.target.value })} /></Field>
          <Grid cols={2}>
            <Field label="Employee"><Select value={mf.employeeId} onChange={(e) => setMf({ ...mf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field label="Manager"><Select value={mf.managerId} onChange={(e) => setMf({ ...mf, managerId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          </Grid>
          <Field label="Date & time"><Input type="datetime-local" value={mf.scheduledAt} onChange={(e) => setMf({ ...mf, scheduledAt: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!completeFor} onClose={() => setCompleteFor(null)} title="Complete meeting"
        footer={<><Button variant="ghost" onClick={() => setCompleteFor(null)}>Cancel</Button>
          <Button disabled={!cf.notes.trim()} onClick={() => { if (completeFor) completeMeeting(completeFor, cf.notes.trim(), cf.actionItems.trim()); setCompleteFor(null); }}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Notes"><Textarea value={cf.notes} onChange={(e) => setCf({ ...cf, notes: e.target.value })} /></Field>
          <Field label="Action items"><Input value={cf.actionItems} onChange={(e) => setCf({ ...cf, actionItems: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
