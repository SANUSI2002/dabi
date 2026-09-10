import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useOrg } from "@/store/useOrg";

export default function OrgSetup() {
  const {
    companies, departments, jobPositions, jobRoles, employeeTypes, tags,
    addCompany, addDepartment, addJobPosition, addJobRole, addEmployeeType, addTag,
    departmentName, jobPositionName,
  } = useOrg();

  const [branchOpen, setBranchOpen] = useState(false);
  const [bf, setBf] = useState({ name: "", code: "", address: "", lga: "", state: "", country: "Nigeria" });
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [posOpen, setPosOpen] = useState(false);
  const [pf, setPf] = useState({ name: "", departmentId: departments[0]?.id ?? "" });
  const [roleOpen, setRoleOpen] = useState(false);
  const [rf, setRf] = useState({ name: "", jobPositionId: jobPositions[0]?.id ?? "" });
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [tf, setTf] = useState({ name: "", color: "#0fc06d" });

  return (
    <div>
      <PageHeader title="Organisation Setup" subtitle="Company, departments, job positions & roles — the foundation the HR suite runs on" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Companies" value={companies.length} tone="brand" icon={<Building2 size={18} />} />
        <StatCard label="Departments" value={departments.length} tone="mist" delay={0.05} />
        <StatCard label="Job positions" value={jobPositions.length} tone="mist" delay={0.1} />
        <StatCard label="Employee types" value={employeeTypes.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Company", "Departments", "Job Positions", "Job Roles", "Employee Types", "Tags"]}>
        {(t) =>
          t === "Company" ? (
            <div>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setBf({ name: "", code: "", address: "", lga: "", state: "", country: "Nigeria" }); setBranchOpen(true); }}><Plus size={14} /> Add branch</Button></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {companies.map((c) => (
                  <Card key={c.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-display font-bold text-mist-900">{c.name}</p>
                      {c.isHeadquarters && <Badge tone="brand">Headquarters</Badge>}
                    </div>
                    <p className="text-sm text-mist-500">{c.address}, {c.lga} LGA, {c.state} State, {c.country}</p>
                    <p className="mt-1 font-mono text-xs text-mist-400">{c.code}</p>
                  </Card>
                ))}
              </div>
              {companies.length > 1 && (
                <p className="mt-4 text-xs text-mist-400">
                  Multiple branches are set up — employees can now be moved between them from <Link to="/hr/branch-transfers" className="text-brand-600 hover:underline">Branch Transfers</Link>.
                </p>
              )}
            </div>
          ) : t === "Departments" ? (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setDeptName(""); setDeptOpen(true); }}><Plus size={14} /> Add department</Button></div>
              <Table columns={["Department", "Job positions"]}>
                {departments.map((d, i) => (
                  <Row key={d.id} index={i}>
                    <Cell className="font-semibold">{d.name}</Cell>
                    <Cell>{jobPositions.filter((p) => p.departmentId === d.id).length}</Cell>
                  </Row>
                ))}
              </Table>
            </>
          ) : t === "Job Positions" ? (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setPf({ name: "", departmentId: departments[0]?.id ?? "" }); setPosOpen(true); }}><Plus size={14} /> Add job position</Button></div>
              <Table columns={["Job position", "Department", "Job roles"]}>
                {jobPositions.map((p, i) => (
                  <Row key={p.id} index={i}>
                    <Cell className="font-semibold">{p.name}</Cell>
                    <Cell><Badge tone="mist">{departmentName(p.departmentId)}</Badge></Cell>
                    <Cell>{jobRoles.filter((r) => r.jobPositionId === p.id).length}</Cell>
                  </Row>
                ))}
              </Table>
            </>
          ) : t === "Job Roles" ? (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setRf({ name: "", jobPositionId: jobPositions[0]?.id ?? "" }); setRoleOpen(true); }}><Plus size={14} /> Add job role</Button></div>
              <Table columns={["Job role", "Job position"]}>
                {jobRoles.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{r.name}</Cell>
                    <Cell><Badge tone="mist">{jobPositionName(r.jobPositionId)}</Badge></Cell>
                  </Row>
                ))}
                {jobRoles.length === 0 && <Row><Cell className="text-mist-400">No job roles yet.</Cell><Cell /></Row>}
              </Table>
            </>
          ) : t === "Employee Types" ? (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setTypeName(""); setTypeOpen(true); }}><Plus size={14} /> Add type</Button></div>
              <div className="flex flex-wrap gap-2">
                {employeeTypes.map((t2) => <Badge key={t2.id} tone="mist">{t2.name}</Badge>)}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" onClick={() => { setTf({ name: "", color: "#0fc06d" }); setTagOpen(true); }}><Plus size={14} /> Add tag</Button></div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tg) => (
                  <span key={tg.id} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: tg.color }}>{tg.name}</span>
                ))}
              </div>
            </>
          )
        }
      </Tabs>

      <Modal open={branchOpen} onClose={() => setBranchOpen(false)} title="Add branch / facility"
        footer={<><Button variant="ghost" onClick={() => setBranchOpen(false)}>Cancel</Button>
          <Button disabled={!bf.name.trim() || !bf.code.trim()} onClick={() => { addCompany(bf); setBranchOpen(false); }}>Add branch</Button></>}>
        <div className="space-y-4">
          <Field label="Branch name"><Input value={bf.name} onChange={(e) => setBf({ ...bf, name: e.target.value })} placeholder="e.g. Sabi Health Post — Apapa" /></Field>
          <Field label="Facility code"><Input value={bf.code} onChange={(e) => setBf({ ...bf, code: e.target.value })} placeholder="e.g. PHC-SABI-021" /></Field>
          <Field label="Address"><Input value={bf.address} onChange={(e) => setBf({ ...bf, address: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="LGA"><Input value={bf.lga} onChange={(e) => setBf({ ...bf, lga: e.target.value })} /></Field>
            <Field label="State"><Input value={bf.state} onChange={(e) => setBf({ ...bf, state: e.target.value })} /></Field>
            <Field label="Country"><Input value={bf.country} onChange={(e) => setBf({ ...bf, country: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal open={deptOpen} onClose={() => setDeptOpen(false)} title="Add department"
        footer={<><Button variant="ghost" onClick={() => setDeptOpen(false)}>Cancel</Button><Button disabled={!deptName.trim()} onClick={() => { addDepartment({ name: deptName.trim(), code: deptName.trim().slice(0,3).toUpperCase(), companyIds: [companies[0]?.id ?? "co1"] }); setDeptOpen(false); }}>Add</Button></>}>
        <Field label="Name"><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} /></Field>
      </Modal>

      <Modal open={posOpen} onClose={() => setPosOpen(false)} title="Add job position"
        footer={<><Button variant="ghost" onClick={() => setPosOpen(false)}>Cancel</Button><Button disabled={!pf.name.trim()} onClick={() => { addJobPosition(pf); setPosOpen(false); }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name"><Input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></Field>
          <Field label="Department"><Select value={pf.departmentId} onChange={(e) => setPf({ ...pf, departmentId: e.target.value })} options={departments.map((d) => ({ value: d.id, label: d.name }))} /></Field>
        </div>
      </Modal>

      <Modal open={roleOpen} onClose={() => setRoleOpen(false)} title="Add job role"
        footer={<><Button variant="ghost" onClick={() => setRoleOpen(false)}>Cancel</Button><Button disabled={!rf.name.trim()} onClick={() => { addJobRole(rf); setRoleOpen(false); }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name"><Input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} /></Field>
          <Field label="Job position"><Select value={rf.jobPositionId} onChange={(e) => setRf({ ...rf, jobPositionId: e.target.value })} options={jobPositions.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        </div>
      </Modal>

      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title="Add employee type"
        footer={<><Button variant="ghost" onClick={() => setTypeOpen(false)}>Cancel</Button><Button disabled={!typeName.trim()} onClick={() => { addEmployeeType({ name: typeName.trim() }); setTypeOpen(false); }}>Add</Button></>}>
        <Field label="Name"><Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Intern" /></Field>
      </Modal>

      <Modal open={tagOpen} onClose={() => setTagOpen(false)} title="Add tag"
        footer={<><Button variant="ghost" onClick={() => setTagOpen(false)}>Cancel</Button><Button disabled={!tf.name.trim()} onClick={() => { addTag(tf); setTagOpen(false); }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name"><Input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} /></Field>
          <Field label="Colour"><Input type="color" value={tf.color} onChange={(e) => setTf({ ...tf, color: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
