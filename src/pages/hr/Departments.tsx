import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Plus, Building2, Users, History, ArrowLeft, Crown, Shield, UserMinus, GitBranch } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { shortDate, dateTime, isoDate } from "@/lib/format";
import { useOrg } from "@/store/useOrg";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useTerminology } from "@/platform/useTerminology";

export default function Departments() {
  const { id } = useParams();
  return id ? <DepartmentDetail id={id} /> : <DepartmentList />;
}

function DepartmentList() {
  const { departments, companies, addDepartment, deptById } = useOrg();
  const staff = useHr((s) => s.staff);
  const { label } = useTerminology();
  const nav = useNavigate();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: "", code: "", description: "", companyId: companies[0]?.id ?? "co1", hodId: "", deputyHodId: "" });

  return (
    <div>
      <PageHeader title={label("department", "plural")} subtitle={`Structure, leadership and membership for every ${label("department").toLowerCase()}.`}
        actions={<Button onClick={() => { setF({ name: "", code: "", description: "", companyId: companies[0]?.id ?? "co1", hodId: "", deputyHodId: "" }); setModal(true); }}><Plus size={15} /> New {label("department")}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={label("department", "plural")} value={departments.length} tone="brand" icon={<Building2 size={18} />} />
        <StatCard label="Active" value={departments.filter((d) => d.status === "Active").length} tone="brand" delay={0.05} />
        <StatCard label={`With a ${label("hod")}`} value={departments.filter((d) => d.hodId).length} tone="mist" delay={0.1} />
        <StatCard label={`Without a ${label("hod")}`} value={departments.filter((d) => !d.hodId).length} tone={departments.some((d) => !d.hodId) ? "action" : "mist"} delay={0.15} />
      </div>

      <Card className="p-0">
        <Table columns={["Code", label("department"), label("hod"), label("deputyHod"), "Members", "Status", ""]}>
          {departments.map((d, i) => (
            <Row key={d.id} index={i} onClick={() => nav(`/hr/departments/${d.id}`)}>
              <Cell className="font-mono text-xs">{d.code}</Cell>
              <Cell className="font-semibold">{d.name}{d.parentDepartmentId && <span className="block text-xs font-normal text-mist-400">unit of {deptById(d.parentDepartmentId)?.name}</span>}</Cell>
              <Cell>{staff.find((s) => s.id === d.hodId)?.name ?? <span className="text-action-500">unassigned</span>}</Cell>
              <Cell>{staff.find((s) => s.id === d.deputyHodId)?.name ?? "—"}</Cell>
              <Cell>{d.staffIds.length}</Cell>
              <Cell><Badge tone={statusTone(d.status.toLowerCase())}>{d.status}</Badge></Cell>
              <Cell><GitBranch size={13} className="text-mist-300" /></Cell>
            </Row>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={`New ${label("department")}`}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button disabled={!f.name || !f.code} onClick={() => { const nid = addDepartment({ name: f.name, code: f.code.toUpperCase(), description: f.description || undefined, companyIds: [f.companyId], hodId: f.hodId || undefined, deputyHodId: f.deputyHodId || undefined }); setModal(false); nav(`/hr/departments/${nid}`); }}>Create</Button></>}>
        <div className="space-y-3">
          <Grid cols={2}>
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono" placeholder="RAD" /></Field>
          </Grid>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Grid cols={2}>
            <Field label="Branch"><Select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })} options={companies.map((c) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label={label("hod")}><Select value={f.hodId} onChange={(e) => setF({ ...f, hodId: e.target.value })} options={[{ value: "", label: "Assign later" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
          </Grid>
          <Field label={label("deputyHod")}><Select value={f.deputyHodId} onChange={(e) => setF({ ...f, deputyHodId: e.target.value })} options={[{ value: "", label: "Assign later" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function DepartmentDetail({ id }: { id: string }) {
  const { deptById, updateDepartment, changeHod, assignStaff, removeStaff, departmentHistory, subDepartments, positionsFor } = useOrg();
  const staff = useHr((s) => s.staff);
  const profileFor = useEmployees((s) => s.profileFor);
  const { label } = useTerminology();
  const nav = useNavigate();
  const dept = deptById(id);
  const [hodModal, setHodModal] = useState<null | "hod" | "deputy-hod">(null);
  const [hf, setHf] = useState({ staffId: "", effectiveDate: isoDate(new Date()), reason: "" });
  const [addStaffModal, setAddStaffModal] = useState(false);
  const [newStaffId, setNewStaffId] = useState("");
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({ name: "", code: "", description: "", status: "Active" as string });

  if (!dept) return <EmptyState title="Not found" />;

  const nameOf = (sid?: string) => staff.find((s) => s.id === sid)?.name ?? "—";
  const members = dept.staffIds.map((sid) => staff.find((s) => s.id === sid)).filter((s): s is NonNullable<typeof s> => !!s);
  // position-based membership (people whose profile.departmentId === this dept) not already in staffIds
  const positionMembers = staff.filter((s) => profileFor(s.id)?.departmentId === id && !dept.staffIds.includes(s.id));
  const history = departmentHistory(id);
  const openPositions = positionsFor(id);

  return (
    <div>
      <button onClick={() => nav("/hr/departments")} className="mb-3 flex items-center gap-1 text-sm text-mist-500 hover:text-mist-700"><ArrowLeft size={14} /> All {label("department", "plural").toLowerCase()}</button>
      <PageHeader title={`${dept.name}`} subtitle={`${dept.code} · ${dept.description ?? "no description"}`}
        actions={<><Badge tone={statusTone(dept.status.toLowerCase())}>{dept.status}</Badge>
          <Button variant="soft" onClick={() => { setEf({ name: dept.name, code: dept.code, description: dept.description ?? "", status: dept.status }); setEdit(true); }}>Edit</Button></>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={label("hod")} value={dept.hodId ? nameOf(dept.hodId).split(" ").slice(-1)[0] : "—"} tone={dept.hodId ? "brand" : "action"} icon={<Crown size={18} />} />
        <StatCard label={label("deputyHod")} value={dept.deputyHodId ? nameOf(dept.deputyHodId).split(" ").slice(-1)[0] : "—"} tone="mist" delay={0.05} />
        <StatCard label="Members" value={members.length + positionMembers.length} tone="mist" delay={0.1} />
        <StatCard label="Leadership changes" value={history.length} tone="mist" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-bold text-mist-700">Leadership</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["hod", "deputy-hod"] as const).map((role) => {
                const sid = role === "hod" ? dept.hodId : dept.deputyHodId;
                return (
                  <div key={role} className="rounded-xl bg-mist-50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-mist-400">{role === "hod" ? <Crown size={12} /> : <Shield size={12} />} {role === "hod" ? label("hod") : label("deputyHod")}</div>
                    <p className="font-semibold text-mist-800">{sid ? nameOf(sid) : <span className="text-mist-400">Unassigned</span>}</p>
                    <button className="mt-1.5 text-xs font-semibold text-brand-600" onClick={() => { setHf({ staffId: "", effectiveDate: isoDate(new Date()), reason: "" }); setHodModal(role); }}>{sid ? `Change ${role === "hod" ? label("hod") : label("deputyHod")}` : "Assign"}</button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-mist-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-mist-700">Members ({members.length + positionMembers.length})</h3>
              <Button variant="soft" onClick={() => { setNewStaffId(""); setAddStaffModal(true); }}><Plus size={13} /> Assign staff</Button>
            </div>
            <Table columns={["Name", "Role", "Membership", ""]}>
              {[...members.map((m) => ({ m, kind: "assigned" as const })), ...positionMembers.map((m) => ({ m, kind: "position" as const }))].map(({ m, kind }, i) => (
                <Row key={m.id} index={i}>
                  <Cell className="font-semibold"><Link to={`/hr/employees/${m.id}`} className="hover:text-brand-700">{m.name}</Link></Cell>
                  <Cell className="text-mist-500">{m.id === dept.hodId ? label("hod") : m.id === dept.deputyHodId ? label("deputyHod") : m.role}</Cell>
                  <Cell><Badge tone={kind === "assigned" ? "brand" : "mist"}>{kind === "assigned" ? "assigned" : "by position"}</Badge></Cell>
                  <Cell>{kind === "assigned" && m.id !== dept.hodId && m.id !== dept.deputyHodId && <button className="text-mist-400 hover:text-action-600" onClick={() => removeStaff(id, m.id)}><UserMinus size={14} /></button>}</Cell>
                </Row>
              ))}
            </Table>
          </Card>

          {subDepartments(id).length > 0 && (
            <Card className="p-0">
              <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Units</p>
              <Table columns={["Code", "Name", label("hod"), "Members"]}>
                {subDepartments(id).map((s, i) => (
                  <Row key={s.id} index={i} onClick={() => nav(`/hr/departments/${s.id}`)}>
                    <Cell className="font-mono text-xs">{s.code}</Cell><Cell className="font-semibold">{s.name}</Cell><Cell>{nameOf(s.hodId)}</Cell><Cell>{s.staffIds.length}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-mist-700"><History size={14} /> Leadership history</h3>
            {history.length === 0 ? <p className="text-sm text-mist-400">No changes recorded.</p> : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="border-l-2 border-mist-200 pl-3 text-sm">
                    <p className="font-semibold text-mist-700">{h.role === "hod" ? label("hod") : label("deputyHod")} changed</p>
                    <p className="text-xs text-mist-500">{nameOf(h.previousStaffId) === "—" ? "(vacant)" : nameOf(h.previousStaffId)} → {h.newStaffId ? nameOf(h.newStaffId) : "(vacated)"}</p>
                    <p className="text-xs text-mist-400">effective {shortDate(h.effectiveDate)} · by {nameOf(h.changedBy)} · {dateTime(h.at)}</p>
                    {h.reason && <p className="mt-0.5 text-xs italic text-mist-500">“{h.reason}”</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-mist-700"><Users size={14} /> Positions & vacancies</h3>
            {openPositions.length === 0 ? <p className="text-sm text-mist-400">No positions defined.</p> : openPositions.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-0.5 text-sm"><span>{p.name}</span></div>
            ))}
            <Link to="/hr/vacancies" className="mt-2 inline-block text-xs font-semibold text-brand-600">Raise a vacancy request →</Link>
          </Card>
        </div>
      </div>

      {/* change HOD */}
      <Modal open={!!hodModal} onClose={() => setHodModal(null)} title={hodModal === "hod" ? `Change ${label("hod")}` : `Change ${label("deputyHod")}`}
        footer={<><Button variant="ghost" onClick={() => setHodModal(null)}>Cancel</Button>
          <Button onClick={() => { changeHod(id, hodModal!, hf.staffId || undefined, { effectiveDate: new Date(hf.effectiveDate).toISOString(), reason: hf.reason || undefined }); setHodModal(null); }}>Apply</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-500">Currently: <b>{nameOf(hodModal === "hod" ? dept.hodId : dept.deputyHodId)}</b>. The previous holder is preserved in history.</p>
          <Field label="New holder"><Select value={hf.staffId} onChange={(e) => setHf({ ...hf, staffId: e.target.value })} options={[{ value: "", label: "— vacate the role —" }, ...staff.filter((s) => s.status === "Active").map((s) => ({ value: s.id, label: `${s.name} · ${s.role}` }))]} /></Field>
          <Grid cols={2}>
            <Field label="Effective date"><Input type="date" value={hf.effectiveDate} onChange={(e) => setHf({ ...hf, effectiveDate: e.target.value })} /></Field>
            <Field label="Reason"><Input value={hf.reason} onChange={(e) => setHf({ ...hf, reason: e.target.value })} placeholder="e.g. promotion, transfer" /></Field>
          </Grid>
        </div>
      </Modal>

      {/* assign staff */}
      <Modal open={addStaffModal} onClose={() => setAddStaffModal(false)} title="Assign staff to department"
        footer={<><Button variant="ghost" onClick={() => setAddStaffModal(false)}>Cancel</Button><Button disabled={!newStaffId} onClick={() => { assignStaff(id, newStaffId); setAddStaffModal(false); }}>Assign</Button></>}>
        <Field label="Employee"><Select value={newStaffId} onChange={(e) => setNewStaffId(e.target.value)} options={[{ value: "", label: "Select…" }, ...staff.filter((s) => !dept.staffIds.includes(s.id)).map((s) => ({ value: s.id, label: `${s.name} · ${s.role}` }))]} /></Field>
      </Modal>

      {/* edit dept */}
      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${dept.name}`}
        footer={<><Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button><Button onClick={() => { updateDepartment(id, { name: ef.name, code: ef.code.toUpperCase(), description: ef.description || undefined, status: ef.status as never }); setEdit(false); }}>Save</Button></>}>
        <div className="space-y-3">
          <Grid cols={2}>
            <Field label="Name"><Input value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /></Field>
            <Field label="Code"><Input value={ef.code} onChange={(e) => setEf({ ...ef, code: e.target.value.toUpperCase() })} className="font-mono" /></Field>
          </Grid>
          <Field label="Description"><Textarea value={ef.description} onChange={(e) => setEf({ ...ef, description: e.target.value })} /></Field>
          <Field label="Status"><Select value={ef.status} onChange={(e) => setEf({ ...ef, status: e.target.value })} options={["Active", "Inactive", "Merging", "Dissolved"]} /></Field>
        </div>
      </Modal>
    </div>
  );
}
