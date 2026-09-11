import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Boxes } from "lucide-react";
import { PageHeader, Button, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useEquipment, maintenanceStateFor } from "@/store/useEquipment";
import { EQUIPMENT_CATEGORIES, type EquipmentCategory, type OwnershipType } from "@/data/equipment";
import { MachineStateBadge, ConnectivityBadge, MaintenanceStateBadge } from "@/components/equipment/EquipmentStatusBadge";
import { startEquipmentSimulator } from "@/lib/equipmentSimulator";

const OWNERSHIP: OwnershipType[] = ["Owned", "Leased", "Rented", "Donated", "Vendor-owned", "Government-owned"];

export default function Register() {
  const store = useEquipment();
  const [category, setCategory] = useState<EquipmentCategory | "">("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "", category: "Laboratory Analyzer" as EquipmentCategory, manufacturer: "", model: "", serialNumber: "",
    department: "", building: "Main Building", room: "", ownership: "Owned" as OwnershipType,
  });

  useEffect(() => {
    startEquipmentSimulator();
  }, []);

  const filtered = category ? store.equipment.filter((e) => e.category === category) : store.equipment;

  function submit() {
    store.registerEquipment({
      name: f.name, category: f.category, manufacturer: f.manufacturer, model: f.model, serialNumber: f.serialNumber,
      ownership: f.ownership, location: { building: f.building, department: f.department, room: f.room || undefined },
    });
    setOpen(false);
    setF({ name: "", category: "Laboratory Analyzer", manufacturer: "", model: "", serialNumber: "", department: "", building: "Main Building", room: "", ownership: "Owned" });
  }

  return (
    <div>
      <PageHeader
        title="Equipment Register"
        subtitle="Master record of monitored medical devices and facility infrastructure"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Register Equipment</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Equipment" value={store.equipment.length} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="Simulated" value={store.equipment.filter((e) => e.technical.integrationKind === "SIMULATOR").length} tone="mist" delay={0.05} />
        <StatCard label="Not Configured" value={store.equipment.filter((e) => e.technical.integrationKind === "NOT_CONFIGURED").length} tone="mist" delay={0.1} />
        <StatCard label="Maintenance Overdue" value={store.equipment.filter((e) => maintenanceStateFor(e) === "Overdue").length} tone="action" delay={0.15} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setCategory("")} className={`chip ${category === "" ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200"}`}>All</button>
        {EQUIPMENT_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`chip ${category === c ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200"}`}>{c}</button>
        ))}
      </div>

      <Table columns={["Equipment", "Category", "Location", "Machine", "Connectivity", "Maintenance"]} caption="Equipment register">
        {filtered.length === 0 && <EmptyRow colSpan={6}>No equipment in this category.</EmptyRow>}
        {filtered.map((eq, i) => (
          <Row key={eq.id} index={i}>
            <Cell>
              <Link to={`/equipment-scada/register/${eq.id}`} className="font-semibold text-mist-900 hover:underline">{eq.name}</Link>
              <span className="block text-[11px] text-mist-400">{eq.equipmentId} · {eq.manufacturer} {eq.model}</span>
            </Cell>
            <Cell>{eq.category}</Cell>
            <Cell>{eq.location.department}{eq.location.room ? ` · ${eq.location.room}` : ""}</Cell>
            <Cell><MachineStateBadge state={store.machineStates[eq.id] ?? "Unknown"} /></Cell>
            <Cell><ConnectivityBadge state={store.connectivityFor(eq.id)} /></Cell>
            <Cell><MaintenanceStateBadge state={maintenanceStateFor(eq)} /></Cell>
          </Row>
        ))}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register Equipment"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.name || !f.manufacturer || !f.serialNumber || !f.department} onClick={submit}>Register</Button></>}
      >
        <div className="space-y-4">
          <Field label="Equipment name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ventilator — ICU Bed 3" /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as EquipmentCategory })} options={EQUIPMENT_CATEGORIES} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manufacturer"><Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Field>
            <Field label="Model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serial number"><Input value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></Field>
            <Field label="Ownership"><Select value={f.ownership} onChange={(e) => setF({ ...f, ownership: e.target.value as OwnershipType })} options={OWNERSHIP} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Building"><Input value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })} /></Field>
            <Field label="Department"><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
          </div>
          <Field label="Room" hint="Optional"><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            New equipment starts with integration "Not Configured" — no simulated telemetry runs until a device connection is set up.
          </p>
        </div>
      </Modal>
    </div>
  );
}
