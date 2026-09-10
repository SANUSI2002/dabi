import { PageHeader, Button, Card } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Input } from "@/components/ui/form";
import { useTerminology, TERM_KEYS, type TermKey } from "@/platform/useTerminology";

const GROUPS: { title: string; keys: TermKey[] }[] = [
  { title: "Structure", keys: ["organisation", "branch", "department"] },
  { title: "Department leadership", keys: ["hod", "deputyHod", "supervisor"] },
  { title: "Management ladder", keys: ["lineManager", "manager", "seniorManager", "director", "executive"] },
  { title: "People", keys: ["employee", "staff"] },
];

export default function TerminologySettings() {
  const { label, setTerm, reset, defaults } = useTerminology();

  return (
    <div>
      <PageHeader title="Organisation Terminology" subtitle="Rename the hierarchy to match how your organisation actually talks. Labels update everywhere they're shown."
        actions={<Button variant="soft" onClick={() => reset()}>Reset all to defaults</Button>} />

      <div className="space-y-4">
        {GROUPS.map((g) => (
          <Card key={g.title} className="p-0">
            <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">{g.title}</p>
            <Table columns={["Default term", "Your label (singular)", "Your label (plural)", ""]}>
              {g.keys.map((k, i) => (
                <Row key={k} index={i}>
                  <Cell className="text-mist-500">{defaults[k].singular}</Cell>
                  <Cell><Input value={label(k, "singular")} onChange={(e) => setTerm(k, { singular: e.target.value })} className="h-8" /></Cell>
                  <Cell><Input value={label(k, "plural")} onChange={(e) => setTerm(k, { plural: e.target.value })} className="h-8" /></Cell>
                  <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => reset(k)}>reset</button></Cell>
                </Row>
              ))}
            </Table>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist-400">
        Example: a hospital can set <b>{defaults.hod.singular}</b> → “Director of Laboratory” and <b>{defaults.director.singular}</b> → “Chief Medical Director” without touching code.
        Keys available: {TERM_KEYS.join(", ")}.
      </p>
    </div>
  );
}
