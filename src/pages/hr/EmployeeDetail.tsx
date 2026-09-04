import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, Building2, Award, FileWarning, StickyNote,
  Plus, Check, X, Upload, ShieldAlert, TrendingUp, TrendingDown,
} from "lucide-react";
import { PageHeader, Card, Button, Badge, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { shortDate, timeAgo, initials, ageFromDob } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";
import type { DocumentCategory } from "@/data/hrProfile";

const DOC_CATEGORIES: DocumentCategory[] = ["License / Certification", "Contract", "ID", "Academic", "Other"];

export default function EmployeeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const staff = useHr((s) => s.staff);
  const emp = useHr((s) => s.byId(id));
  const {
    profileFor, upsertProfile, documents, requestDocument, uploadDocument, reviewDocument,
    actionTypes, disciplinaryActions, addDisciplinaryAction, notes, addNote, bonusPoints, adjustBonus,
  } = useEmployees();
  const { departments, positionsFor, rolesFor, employeeTypes, departmentName, jobPositionName, jobRoleName, employeeTypeName } = useOrg();

  const p = profileFor(id ?? "");
  const myDocs = documents.filter((d) => d.employeeId === id);
  const myActions = disciplinaryActions.filter((a) => a.employeeIds.includes(id ?? ""));
  const myNotes = notes.filter((n) => n.employeeId === id);
  const myBonus = bonusPoints.find((b) => b.employeeId === id);

  const [editOpen, setEditOpen] = useState(false);
  const [ef, setEf] = useState(() => ({
    departmentId: p?.departmentId ?? "", jobPositionId: p?.jobPositionId ?? "", jobRoleId: p?.jobRoleId ?? "",
    employeeTypeId: p?.employeeTypeId ?? "", reportingManagerId: p?.reportingManagerId ?? "",
    dateJoining: p?.dateJoining?.slice(0, 10) ?? "", workEmail: p?.workEmail ?? "", workPhone: p?.workPhone ?? "",
    bankName: p?.bankName ?? "", accountNumber: p?.accountNumber ?? "", bankBranch: p?.bankBranch ?? "",
    emergencyContactName: p?.emergencyContactName ?? "", emergencyContactPhone: p?.emergencyContactPhone ?? "", emergencyContactRelation: p?.emergencyContactRelation ?? "",
  }));

  const [reqOpen, setReqOpen] = useState(false);
  const [rf, setRf] = useState<{ title: string; category: DocumentCategory }>({ title: "", category: "License / Certification" });
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [uf, setUf] = useState({ issueDate: "", expiryDate: "" });
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [daOpen, setDaOpen] = useState(false);
  const [daf, setDaf] = useState({ actionTypeId: actionTypes[0]?.id ?? "", description: "", unit: "Days" as "Days" | "Hours", amount: 0, startDate: "" });
  const [noteText, setNoteText] = useState("");
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bf, setBf] = useState({ delta: 10, reason: "" });

  if (!emp) {
    return (
      <div>
        <button onClick={() => nav("/hr/employees")} className="btn-ghost mb-4"><ArrowLeft size={15} /> Back</button>
        <Card>Employee not found.</Card>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => nav("/hr/employees")} className="btn-ghost mb-4"><ArrowLeft size={15} /> Back to directory</button>

      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-xl font-bold text-white">{initials(emp.name)}</span>
            <div>
              <p className="font-display text-xl font-bold text-mist-900">{emp.name}</p>
              <p className="text-sm text-mist-500">
                {jobPositionName(p?.jobPositionId) !== "—" ? jobPositionName(p?.jobPositionId) : emp.role}
                {p?.jobRoleId && ` · ${jobRoleName(p.jobRoleId)}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="mist"><Building2 size={11} /> {departmentName(p?.departmentId)}</Badge>
                <Badge tone="mist">{employeeTypeName(p?.employeeTypeId)}</Badge>
                <Badge tone={emp.status === "Active" ? "brand" : "mist"}>{emp.status}</Badge>
                {p?.dob && <Badge tone="mist">{ageFromDob(p.dob)}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm text-mist-500">
            {p?.workEmail && <span className="flex items-center gap-1.5"><Mail size={13} /> {p.workEmail}</span>}
            {p?.workPhone && <span className="flex items-center gap-1.5"><Phone size={13} /> {p.workPhone}</span>}
            <Button variant="ghost" className="mt-1 text-xs" onClick={() => setEditOpen(true)}>Edit work info</Button>
          </div>
        </div>
      </Card>

      <Tabs tabs={["Overview", `Documents (${myDocs.length})`, `Disciplinary (${myActions.length})`, "Notes", "Bonus Points"]}>
        {(t) =>
          t === "Overview" ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Personal</h3>
                <dl className="space-y-1.5 text-sm">
                  {[
                    ["Gender", p?.gender], ["Marital status", p?.maritalStatus], ["Date of birth", p?.dob ? shortDate(p.dob) : undefined],
                    ["Address", p?.address], ["LGA / State", p?.lga && p?.state ? `${p.lga}, ${p.state}` : undefined],
                    ["Qualification", p?.qualification],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-dashed border-mist-100 py-1.5">
                      <dt className="text-mist-400">{k}</dt>
                      <dd className="font-medium text-mist-800">{v ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Emergency contact</h3>
                <dl className="space-y-1.5 text-sm">
                  {[["Name", p?.emergencyContactName], ["Phone", p?.emergencyContactPhone], ["Relation", p?.emergencyContactRelation]].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-dashed border-mist-100 py-1.5">
                      <dt className="text-mist-400">{k}</dt>
                      <dd className="font-medium text-mist-800">{v ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="mb-3 mt-5 font-display font-bold text-mist-900">Work information</h3>
                <dl className="space-y-1.5 text-sm">
                  {[
                    ["Job position", jobPositionName(p?.jobPositionId)], ["Job role", jobRoleName(p?.jobRoleId)],
                    ["Reporting manager", p?.reportingManagerId ? staff.find((x) => x.id === p.reportingManagerId)?.name : undefined],
                    ["Date joining", p?.dateJoining ? shortDate(p.dateJoining) : undefined],
                    ["Contract end", p?.contractEndDate ? shortDate(p.contractEndDate) : undefined],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-dashed border-mist-100 py-1.5">
                      <dt className="text-mist-400">{k}</dt>
                      <dd className="font-medium text-mist-800">{v ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Bank details</h3>
                <dl className="space-y-1.5 text-sm">
                  {[["Bank", p?.bankName], ["Account number", p?.accountNumber], ["Branch", p?.bankBranch]].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-dashed border-mist-100 py-1.5">
                      <dt className="text-mist-400">{k}</dt>
                      <dd className="font-mono font-medium text-mist-800">{v ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><Link to="/hris" className="hover:underline">HRIS record →</Link></h3>
                <p className="text-sm text-mist-500">Username <b className="text-mist-700">@{emp.username}</b> · Cadre {emp.cadre || "—"} · License <span className="font-mono">{emp.license ?? "—"}</span> · Hired {shortDate(emp.hireDate)}</p>
              </Card>
            </div>
          ) : t.startsWith("Documents") ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="soft" onClick={() => { setRf({ title: "", category: "License / Certification" }); setReqOpen(true); }}><Plus size={14} /> Request document</Button>
              </div>
              <Table columns={["Title", "Category", "Issue", "Expiry", "Status", ""]}>
                {myDocs.map((d, i) => {
                  const daysLeft = d.expiryDate ? differenceInCalendarDays(new Date(d.expiryDate), new Date()) : null;
                  return (
                    <Row key={d.id} index={i} className={daysLeft !== null && daysLeft <= d.notifyBeforeDays ? "bg-action-50/40" : undefined}>
                      <Cell className="font-semibold">{d.title}</Cell>
                      <Cell><Badge tone="mist">{d.category}</Badge></Cell>
                      <Cell className="text-mist-400">{d.issueDate ? shortDate(d.issueDate) : "—"}</Cell>
                      <Cell className={daysLeft !== null && daysLeft < 0 ? "font-semibold text-action-600" : "text-mist-500"}>
                        {d.expiryDate ? shortDate(d.expiryDate) : "—"}
                        {daysLeft !== null && (daysLeft < 0 ? <span className="block text-[11px]">expired {Math.abs(daysLeft)}d ago</span> : daysLeft <= d.notifyBeforeDays ? <span className="block text-[11px] text-amber-600">{daysLeft}d left</span> : null)}
                      </Cell>
                      <Cell><Badge tone={statusTone(d.status)}>{d.status}</Badge>{d.rejectReason && <span className="block text-[11px] text-mist-400">{d.rejectReason}</span>}</Cell>
                      <Cell>
                        <div className="flex justify-end gap-1.5">
                          {d.status === "Requested" && (
                            <button onClick={() => { setUploadFor(d.id); setUf({ issueDate: "", expiryDate: "" }); }} className="btn-primary px-2.5 py-1 text-xs"><Upload size={12} /> Upload</button>
                          )}
                          {d.status === "Uploaded" && (
                            <>
                              <button onClick={() => { setRejectFor(d.id); setRejectReason(""); }} className="btn-ghost px-2 py-1 text-xs"><X size={12} /> Reject</button>
                              <button onClick={() => reviewDocument(d.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs"><Check size={12} /> Approve</button>
                            </>
                          )}
                        </div>
                      </Cell>
                    </Row>
                  );
                })}
                {myDocs.length === 0 && <Row><Cell className="text-mist-400">No documents requested yet.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
            </div>
          ) : t.startsWith("Disciplinary") ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="action" onClick={() => { setDaf({ actionTypeId: actionTypes[0]?.id ?? "", description: "", unit: "Days", amount: 0, startDate: "" }); setDaOpen(true); }}><FileWarning size={14} /> Record action</Button>
              </div>
              <Table columns={["Action", "Description", "Duration", "Date", "Blocks profile"]}>
                {myActions.map((a, i) => {
                  const at = actionTypes.find((x) => x.id === a.actionTypeId);
                  return (
                    <Row key={a.id} index={i}>
                      <Cell className="font-semibold">{at?.name ?? "—"}</Cell>
                      <Cell className="max-w-[320px] text-mist-600">{a.description}</Cell>
                      <Cell>{a.amount ? `${a.amount} ${a.unit.toLowerCase()}` : "—"}</Cell>
                      <Cell className="text-mist-400">{shortDate(a.startDate)}</Cell>
                      <Cell>{at?.blockOption ? <Badge tone="action">Yes</Badge> : <Badge tone="mist">No</Badge>}</Cell>
                    </Row>
                  );
                })}
                {myActions.length === 0 && <Row><Cell className="text-mist-400">No disciplinary record.</Cell><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
            </div>
          ) : t === "Notes" ? (
            <div className="space-y-3">
              <Card>
                <div className="flex gap-2">
                  <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note about this employee…" />
                  <Button disabled={!noteText.trim()} onClick={() => { addNote(id!, noteText.trim()); setNoteText(""); }}><StickyNote size={14} /> Add</Button>
                </div>
              </Card>
              {myNotes.map((n) => (
                <Card key={n.id}>
                  <p className="text-sm text-mist-700">{n.note}</p>
                  <p className="mt-1 text-[11px] text-mist-400">{n.by} · {timeAgo(n.at)}</p>
                </Card>
              ))}
              {myNotes.length === 0 && <p className="text-sm text-mist-400">No notes yet.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-mist-400">Total points</p>
                  <p className="font-display text-3xl font-bold text-mist-900">{myBonus?.points ?? 0}</p>
                </div>
                <Button variant="soft" onClick={() => { setBf({ delta: 10, reason: "" }); setBonusOpen(true); }}><Award size={14} /> Adjust points</Button>
              </Card>
              <div className="space-y-2">
                {(myBonus?.history ?? []).map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      {h.delta >= 0 ? <TrendingUp size={14} className="text-brand-500" /> : <TrendingDown size={14} className="text-action-500" />}
                      {h.reason}
                    </span>
                    <span className={h.delta >= 0 ? "font-semibold text-brand-600" : "font-semibold text-action-600"}>{h.delta >= 0 ? "+" : ""}{h.delta}</span>
                  </div>
                ))}
                {(!myBonus || myBonus.history.length === 0) && <p className="text-sm text-mist-400">No bonus point activity.</p>}
              </div>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit work information"
        wide
        footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            upsertProfile(id!, {
              ...ef,
              dateJoining: ef.dateJoining ? new Date(ef.dateJoining).toISOString() : undefined,
              reportingManagerId: ef.reportingManagerId || undefined,
            });
            setEditOpen(false);
          }}>Save</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={3}>
            <Field label="Department">
              <Select value={ef.departmentId} onChange={(e) => setEf({ ...ef, departmentId: e.target.value, jobPositionId: "" })} options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
            </Field>
            <Field label="Job position">
              <Select value={ef.jobPositionId} onChange={(e) => setEf({ ...ef, jobPositionId: e.target.value })} options={[{ value: "", label: "—" }, ...positionsFor(ef.departmentId).map((p2) => ({ value: p2.id, label: p2.name }))]} />
            </Field>
            <Field label="Job role">
              <Select value={ef.jobRoleId} onChange={(e) => setEf({ ...ef, jobRoleId: e.target.value })} options={[{ value: "", label: "—" }, ...rolesFor(ef.jobPositionId).map((r) => ({ value: r.id, label: r.name }))]} />
            </Field>
            <Field label="Employee type">
              <Select value={ef.employeeTypeId} onChange={(e) => setEf({ ...ef, employeeTypeId: e.target.value })} options={[{ value: "", label: "—" }, ...employeeTypes.map((t) => ({ value: t.id, label: t.name }))]} />
            </Field>
            <Field label="Reporting manager">
              <Select value={ef.reportingManagerId} onChange={(e) => setEf({ ...ef, reportingManagerId: e.target.value })} options={[{ value: "", label: "—" }, ...staff.filter((s) => s.id !== id).map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <Field label="Date joining"><Input type="date" value={ef.dateJoining} onChange={(e) => setEf({ ...ef, dateJoining: e.target.value })} /></Field>
            <Field label="Work email"><Input value={ef.workEmail} onChange={(e) => setEf({ ...ef, workEmail: e.target.value })} /></Field>
            <Field label="Work phone"><Input value={ef.workPhone} onChange={(e) => setEf({ ...ef, workPhone: e.target.value })} /></Field>
          </Grid>
          <p className="text-xs font-bold uppercase text-mist-400">Bank details</p>
          <Grid cols={3}>
            <Field label="Bank name"><Input value={ef.bankName} onChange={(e) => setEf({ ...ef, bankName: e.target.value })} /></Field>
            <Field label="Account number"><Input value={ef.accountNumber} onChange={(e) => setEf({ ...ef, accountNumber: e.target.value })} /></Field>
            <Field label="Branch"><Input value={ef.bankBranch} onChange={(e) => setEf({ ...ef, bankBranch: e.target.value })} /></Field>
          </Grid>
          <p className="text-xs font-bold uppercase text-mist-400">Emergency contact</p>
          <Grid cols={3}>
            <Field label="Name"><Input value={ef.emergencyContactName} onChange={(e) => setEf({ ...ef, emergencyContactName: e.target.value })} /></Field>
            <Field label="Phone"><Input value={ef.emergencyContactPhone} onChange={(e) => setEf({ ...ef, emergencyContactPhone: e.target.value })} /></Field>
            <Field label="Relation"><Input value={ef.emergencyContactRelation} onChange={(e) => setEf({ ...ef, emergencyContactRelation: e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request document"
        footer={<><Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
          <Button disabled={!rf.title.trim()} onClick={() => { requestDocument([id!], rf.title.trim(), rf.category); setReqOpen(false); }}>Request</Button></>}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={rf.title} onChange={(e) => setRf({ ...rf, title: e.target.value })} placeholder="e.g. MDCN Practising License" /></Field>
          <Field label="Category"><Select value={rf.category} onChange={(e) => setRf({ ...rf, category: e.target.value as DocumentCategory })} options={DOC_CATEGORIES} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title="Upload document"
        footer={<><Button variant="ghost" onClick={() => setUploadFor(null)}>Cancel</Button>
          <Button onClick={() => { if (uploadFor) uploadDocument(uploadFor, { issueDate: uf.issueDate ? new Date(uf.issueDate).toISOString() : undefined, expiryDate: uf.expiryDate ? new Date(uf.expiryDate).toISOString() : undefined }); setUploadFor(null); }}><Upload size={14} /> Upload</Button></>}
      >
        <Grid cols={2}>
          <Field label="Issue date"><Input type="date" value={uf.issueDate} onChange={(e) => setUf({ ...uf, issueDate: e.target.value })} /></Field>
          <Field label="Expiry date"><Input type="date" value={uf.expiryDate} onChange={(e) => setUf({ ...uf, expiryDate: e.target.value })} /></Field>
        </Grid>
      </Modal>

      <Modal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title="Reject document"
        footer={<><Button variant="ghost" onClick={() => setRejectFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!rejectReason.trim()} onClick={() => { if (rejectFor) reviewDocument(rejectFor, "Rejected", rejectReason.trim()); setRejectFor(null); }}>Reject</Button></>}
      >
        <Field label="Reason"><Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></Field>
      </Modal>

      <Modal
        open={daOpen}
        onClose={() => setDaOpen(false)}
        title="Record disciplinary action"
        footer={<><Button variant="ghost" onClick={() => setDaOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!daf.description.trim() || !daf.startDate} onClick={() => { addDisciplinaryAction({ employeeIds: [id!], ...daf, startDate: new Date(daf.startDate).toISOString() }); setDaOpen(false); }}><ShieldAlert size={14} /> Record</Button></>}
      >
        <div className="space-y-4">
          <Field label="Action type"><Select value={daf.actionTypeId} onChange={(e) => setDaf({ ...daf, actionTypeId: e.target.value })} options={actionTypes.map((a) => ({ value: a.id, label: a.name }))} /></Field>
          <Field label="Description"><Textarea value={daf.description} onChange={(e) => setDaf({ ...daf, description: e.target.value })} /></Field>
          <Grid cols={3}>
            <Field label="Unit"><Select value={daf.unit} onChange={(e) => setDaf({ ...daf, unit: e.target.value as "Days" | "Hours" })} options={["Days", "Hours"]} /></Field>
            <Field label="Amount"><Input type="number" value={daf.amount} onChange={(e) => setDaf({ ...daf, amount: +e.target.value })} /></Field>
            <Field label="Start date"><Input type="date" value={daf.startDate} onChange={(e) => setDaf({ ...daf, startDate: e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal
        open={bonusOpen}
        onClose={() => setBonusOpen(false)}
        title="Adjust bonus points"
        footer={<><Button variant="ghost" onClick={() => setBonusOpen(false)}>Cancel</Button>
          <Button disabled={!bf.reason.trim() || bf.delta === 0} onClick={() => { adjustBonus(id!, bf.delta, bf.reason.trim()); setBonusOpen(false); }}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Points (negative to deduct)"><Input type="number" value={bf.delta} onChange={(e) => setBf({ ...bf, delta: +e.target.value })} /></Field>
          <Field label="Reason"><Input value={bf.reason} onChange={(e) => setBf({ ...bf, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
