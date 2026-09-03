import { PageHeader, Badge, Button } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Plus } from "lucide-react";
import {
  SERVICE_TYPES, PATIENT_CATEGORIES, LAB_TESTS, DIAGNOSES, VACCINES, NOTIFIABLE,
} from "@/data/catalog";
import { drugs, staff } from "@/data/mock";
import { naira } from "@/lib/format";

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="System catalogs & configuration — changes affect the whole facility" />

      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
        ⚠ Changes here affect the entire system. Modify with care — every change is written to the audit log.
      </div>

      <Tabs
        tabs={["Drugs", "Lab Tests", "Diagnoses", "Vaccines", "Notifiable Diseases", "Service Types & Tariffs", "Patient Categories", "Users"]}
      >
        {(t) => {
          const addBtn = <div className="mb-3 flex justify-end"><Button className="text-xs"><Plus size={13} /> Add New</Button></div>;
          if (t === "Drugs")
            return (
              <>
                {addBtn}
                <Table columns={["Name", "Form", "Strength", "Class", "Reorder", "Status"]}>
                  {drugs.map((d, i) => (
                    <Row key={d.id} index={i}>
                      <Cell className="font-semibold">{d.name}</Cell>
                      <Cell>{d.form}</Cell>
                      <Cell>{d.strength}</Cell>
                      <Cell>{d.klass}</Cell>
                      <Cell>{d.reorder}</Cell>
                      <Cell><Badge tone="brand">Active</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Lab Tests")
            return (
              <>
                {addBtn}
                <Table columns={["Test", "Category", "Unit", "Reference", "Price", "TAT (min)"]}>
                  {LAB_TESTS.map((l, i) => (
                    <Row key={l.name} index={i}>
                      <Cell className="font-semibold">{l.name}</Cell>
                      <Cell>{l.category}</Cell>
                      <Cell>{l.unit || "—"}</Cell>
                      <Cell className="text-mist-500">{l.ref}</Cell>
                      <Cell>{naira(l.price)}</Cell>
                      <Cell>{l.tat}</Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Diagnoses")
            return (
              <>
                {addBtn}
                <Table columns={["ICD-11", "Name", "Chapter", "NCD", "Notifiable", "Status"]}>
                  {DIAGNOSES.map((d, i) => (
                    <Row key={d.code} index={i}>
                      <Cell className="font-mono text-xs">{d.code}</Cell>
                      <Cell className="font-semibold">{d.name}</Cell>
                      <Cell>{d.chapter}</Cell>
                      <Cell>{d.ncd ? <Badge tone="amber">NCD</Badge> : "—"}</Cell>
                      <Cell>{d.notifiable ? <Badge tone="action">Notifiable</Badge> : "—"}</Cell>
                      <Cell><Badge tone="brand">Active</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Vaccines")
            return (
              <>
                {addBtn}
                <Table columns={["Code", "Name", "Due age", "Dose", "Route", "Site"]}>
                  {VACCINES.map((v, i) => (
                    <Row key={v.code} index={i}>
                      <Cell className="font-mono text-xs">{v.code}</Cell>
                      <Cell className="font-semibold">{v.name}</Cell>
                      <Cell>{v.ageLabel}</Cell>
                      <Cell>{v.dose}</Cell>
                      <Cell>{v.route}</Cell>
                      <Cell>{v.site}</Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Notifiable Diseases")
            return (
              <>
                {addBtn}
                <Table columns={["Code", "Name", "Class", "Priority", "Reporting Window"]}>
                  {NOTIFIABLE.map((n, i) => (
                    <Row key={n.code} index={i}>
                      <Cell className="font-mono text-xs">{n.code}</Cell>
                      <Cell className="font-semibold">{n.name}</Cell>
                      <Cell>{n.class}</Cell>
                      <Cell><Badge tone={n.priority === "Critical" ? "action" : n.priority === "High" ? "amber" : "mist"}>{n.priority}</Badge></Cell>
                      <Cell>{n.window}</Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Service Types & Tariffs")
            return (
              <>
                {addBtn}
                <Table columns={["Code", "Name", "Category", "Default Price", "Billable", "Status"]}>
                  {SERVICE_TYPES.map((s, i) => (
                    <Row key={s.code} index={i}>
                      <Cell className="font-mono text-xs">{s.code}</Cell>
                      <Cell className="font-semibold">{s.name}</Cell>
                      <Cell>{s.category}</Cell>
                      <Cell>{naira(s.price)}</Cell>
                      <Cell>{s.billable ? "✓" : "—"}</Cell>
                      <Cell><Badge tone="brand">Active</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          if (t === "Patient Categories")
            return (
              <>
                {addBtn}
                <Table columns={["Code", "Name", "Exempt", "Reason", "Status"]}>
                  {PATIENT_CATEGORIES.map((c, i) => (
                    <Row key={c.code} index={i}>
                      <Cell className="font-mono text-xs">{c.code}</Cell>
                      <Cell className="font-semibold">{c.name}</Cell>
                      <Cell>{c.exempt ? <Badge tone="brand">Exempt</Badge> : "—"}</Cell>
                      <Cell className="text-mist-500">{c.reason}</Cell>
                      <Cell><Badge tone="brand">Active</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              </>
            );
          return (
            <>
              {addBtn}
              <Table columns={["Name", "Username", "Role", "Status"]}>
                {staff.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell className="font-semibold">{s.name}</Cell>
                    <Cell className="font-mono text-xs">{s.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}</Cell>
                    <Cell><Badge tone="mist">{s.role}</Badge></Cell>
                    <Cell><Badge tone="brand">{s.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </>
          );
        }}
      </Tabs>
    </div>
  );
}
