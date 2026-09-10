import { useMemo, useState } from "react";
import { BedDouble, Plus, Crown, Pencil, PowerOff, Power } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { useWards } from "@/store/useWards";
import { useMasterData } from "@/platform/useMasterData";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function Inpatient() {
  const { admissions, patientById, admit, discharge } = useEmr();
  const { wards, beds, addWard, updateWard, addBed, setBedVip, setBedActive } = useWards();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", ward: wards[1]?.name ?? "", bed: "", diagnosis: "" });
  const active = admissions.filter((a) => a.status === "Active");
  const activeBeds = beds.filter((b) => b.active);
  const masterData = useMasterData((s) => s.data);
  const wardTypeOptions = useMemo(() => {
    const items = (masterData["ward-types"] ?? []).filter((i) => i.active).map((i) => i.label);
    return items.length ? items : ["General Ward", "Maternity Ward"];
  }, [masterData]);

  const [wardModal, setWardModal] = useState<{ id: string; name: string; type: string } | null>(null);
  const [bedForWard, setBedForWard] = useState<string | null>(null);
  const [newBedLabel, setNewBedLabel] = useState("");
  const [manageBed, setManageBed] = useState<string | null>(null);
  const bed = beds.find((b) => b.id === manageBed);
  const bedOccupied = (wardName: string, label: string) => active.some((a) => a.ward === wardName && a.bed === label);

  return (
    <div>
      <PageHeader
        title="Inpatient Management"
        subtitle={`${active.length} active admissions · ${activeBeds.length - active.length} beds available`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Admit Patient</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Admissions" value={active.length} tone="brand" icon={<BedDouble size={18} />} />
        <StatCard label="Beds Available" value={activeBeds.length - active.length} tone="mist" delay={0.05} />
        <StatCard label="Beds Occupied" value={active.length} tone="action" delay={0.1} />
        <StatCard label="Outcomes Today" value={admissions.filter((a) => a.status === "Discharged").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Current Patients", "Ward Overview", "Outcomes"]}>
        {(t) =>
          t === "Current Patients" ? (
            active.length === 0 ? (
              <div className="card py-16 text-center text-mist-400">No active admissions. Click "Admit Patient" to start.</div>
            ) : (
              <Table columns={["Patient", "Ward", "Bed", "Diagnosis", "Admitted", ""]}>
                {active.map((a, i) => {
                  const p = patientById(a.patientId);
                  return (
                    <Row key={a.id} index={i}>
                      <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                      <Cell>{a.ward}</Cell>
                      <Cell>{a.bed}</Cell>
                      <Cell>{a.diagnosis}</Cell>
                      <Cell className="text-mist-400">{dateTime(a.admittedAt)}</Cell>
                      <Cell>
                        <button onClick={() => discharge(a.id, "Recovered")} className="btn-action px-2.5 py-1 text-xs">
                          Discharge
                        </button>
                      </Cell>
                    </Row>
                  );
                })}
              </Table>
            )
          ) : t === "Ward Overview" ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="soft" onClick={() => setWardModal({ id: "", name: "", type: wardTypeOptions[0] })}><Plus size={14} /> Add ward</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {wards.map((w) => {
                  const wBeds = beds.filter((b) => b.wardId === w.id);
                  return (
                    <div key={w.id} className="card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-display font-bold text-mist-900">{w.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <Badge tone="mist">{w.type}</Badge>
                          <button onClick={() => setWardModal({ id: w.id, name: w.name, type: w.type })} className="btn-ghost px-2 py-1 text-xs"><Pencil size={12} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {wBeds.map((b) => {
                          const occ = active.find((a) => a.ward === w.name && a.bed === b.label);
                          return (
                            <button
                              key={b.id}
                              onClick={() => setManageBed(b.id)}
                              className={cn(
                                "relative rounded-xl p-2 text-center text-[11px] font-semibold ring-1 transition hover:opacity-80",
                                !b.active ? "bg-mist-100 text-mist-400 ring-mist-200 line-through" :
                                occ ? "bg-action-50 text-action-700 ring-action-200" : "bg-brand-50 text-brand-700 ring-brand-200",
                              )}
                            >
                              {b.isVip && <Crown size={11} className="absolute right-1 top-1 text-amber-500" />}
                              {b.label}
                              <span className="block font-normal">{!b.active ? "Retired" : occ ? "Occupied" : "Available"}</span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => { setBedForWard(w.id); setNewBedLabel(`Bed ${wBeds.length + 1}`); }}
                          className="grid place-items-center rounded-xl border border-dashed border-mist-300 p-2 text-mist-400 hover:border-brand-400 hover:text-brand-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Table columns={["Patient", "Ward", "Admitted", "Outcome"]}>
              {admissions.filter((a) => a.status === "Discharged").map((a, i) => {
                const p = patientById(a.patientId);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{a.ward}</Cell>
                    <Cell className="text-mist-400">{dateTime(a.admittedAt)}</Cell>
                    <Cell><Badge tone="brand">{a.outcome}</Badge></Cell>
                  </Row>
                );
              })}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Admit Patient"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!f.patientId || !f.diagnosis}
              onClick={() => { admit(f.patientId, f.ward, f.bed, f.diagnosis); setOpen(false); }}
            >
              Admit Patient
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ward">
              <Select
                value={f.ward}
                onChange={(e) => {
                  const w = wards.find((x) => x.name === e.target.value);
                  const firstFree = w && beds.find((b) => b.wardId === w.id && b.active && !bedOccupied(w.name, b.label));
                  setF({ ...f, ward: e.target.value, bed: firstFree?.label ?? "" });
                }}
                options={wards.map((w) => w.name)}
              />
            </Field>
            <Field label="Bed">
              <Select
                value={f.bed}
                onChange={(e) => setF({ ...f, bed: e.target.value })}
                options={(() => {
                  const w = wards.find((x) => x.name === f.ward);
                  const free = w ? beds.filter((b) => b.wardId === w.id && b.active && !bedOccupied(w.name, b.label)) : [];
                  return free.length ? free.map((b) => ({ value: b.label, label: b.isVip ? `${b.label} · VIP` : b.label })) : [{ value: "", label: "No free beds" }];
                })()}
              />
            </Field>
          </div>
          <Field label="Admitting diagnosis"><Input value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
          <Field label="Reason for admission"><Textarea placeholder="Clinical details…" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!wardModal}
        onClose={() => setWardModal(null)}
        title={wardModal?.id ? "Edit ward" : "Add ward"}
        footer={<><Button variant="ghost" onClick={() => setWardModal(null)}>Cancel</Button>
          <Button
            disabled={!wardModal?.name.trim()}
            onClick={() => {
              if (!wardModal) return;
              if (wardModal.id) updateWard(wardModal.id, { name: wardModal.name.trim(), type: wardModal.type });
              else addWard(wardModal.name.trim(), wardModal.type);
              setWardModal(null);
            }}
          >
            {wardModal?.id ? "Save changes" : "Add ward"}
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Ward name"><Input value={wardModal?.name ?? ""} onChange={(e) => setWardModal((s) => (s ? { ...s, name: e.target.value } : s))} /></Field>
          <Field label="Type"><Select value={wardModal?.type ?? wardTypeOptions[0]} onChange={(e) => setWardModal((s) => (s ? { ...s, type: e.target.value } : s))} options={wardTypeOptions} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!bedForWard}
        onClose={() => setBedForWard(null)}
        title="Add bed"
        footer={<><Button variant="ghost" onClick={() => setBedForWard(null)}>Cancel</Button>
          <Button disabled={!newBedLabel.trim()} onClick={() => { if (bedForWard) addBed(bedForWard, newBedLabel.trim()); setBedForWard(null); }}>Add bed</Button></>}
      >
        <Field label="Bed label"><Input value={newBedLabel} onChange={(e) => setNewBedLabel(e.target.value)} /></Field>
      </Modal>

      <Modal
        open={!!manageBed}
        onClose={() => setManageBed(null)}
        title={`Manage — ${bed?.label ?? ""}`}
        footer={<Button onClick={() => setManageBed(null)}>Done</Button>}
      >
        {bed && (
          <div className="space-y-4">
            <Checkbox label="VIP bed" checked={bed.isVip} onChange={(e) => setBedVip(bed.id, e.target.checked)} />
            {(() => {
              const w = wards.find((x) => x.id === bed.wardId);
              const occupied = w ? bedOccupied(w.name, bed.label) : false;
              return bed.active ? (
                <Button variant="action" disabled={occupied} onClick={() => setBedActive(bed.id, false)}>
                  <PowerOff size={14} /> {occupied ? "Cannot retire — currently occupied" : "Retire this bed"}
                </Button>
              ) : (
                <Button onClick={() => setBedActive(bed.id, true)}><Power size={14} /> Reactivate this bed</Button>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
