import { useState } from "react";
import { Home, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveOutreach, useLiveOutreachLoad } from "@/emr-live/outreach";
import { useListValues } from "@/lib/listOptions";

export default function Outreach() {
  const { outreachActivities: demoActivities, addOutreach } = useEmr();
  const staff = useHr((s) => s.staff);
  const live = useIsLiveEmr();
  useLiveOutreachLoad(live);
  const liveActivities = useLiveOutreach((st) => st.activities);
  const liveChws = useLiveOutreach((st) => st.chws);
  const liveError = useLiveOutreach((st) => st.error);
  const outreachActivities = live ? liveActivities : demoActivities;
  const [open, setOpen] = useState(false);
  // Live: the roster is the hospital's members who carry out outreach (names only — no contact details).
  const chws = live
    ? liveChws.map((c) => ({ id: c.userId, name: c.name, cadre: "Community Health Worker", phone: undefined as string | undefined, status: "Active" }))
    : staff.filter((s) => s.role.includes("Community"));
  const activityTypes = useListValues("outreach-activity-types"); // the hospital's Outreach Activity Types
  const [f, setF] = useState({ chw: chws[0]?.name ?? staff[0]?.name ?? "", type: "Household visit", ward: "Kirikiri", households: 0, referrals: 0, date: "", notes: "" });
  const [chwUserId, setChwUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [logKey, setLogKey] = useState(newIdempotencyKey);
  const chosenChw = chwUserId || chws[0]?.id || "";

  return (
    <div>
      <PageHeader
        title="Community Outreach (CHW)"
        subtitle="Household visits, campaigns & community referrals"
        actions={<Button onClick={() => { setLogKey(newIdempotencyKey()); setActionError(""); setOpen(true); }}><Plus size={15} /> Log Activity</Button>}
      />
      {live && liveError && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{liveError}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Activities" value={outreachActivities.length} tone="brand" icon={<Home size={18} />} />
        <StatCard label="Households Reached" value={outreachActivities.reduce((n, a) => n + a.households, 0)} tone="mist" delay={0.05} />
        <StatCard label="Community Referrals" value={outreachActivities.reduce((n, a) => n + a.referrals, 0)} tone="action" delay={0.1} />
        <StatCard label="Active CHWs" value={chws.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Activity Log", "CHW Roster"]}>
        {(t) =>
          t === "Activity Log" ? (
            <Table columns={["CHW", "Type", "Ward", "Households", "Referrals", "Date"]} caption="Community outreach activity log">
              {outreachActivities.length === 0 && <Row><Cell className="text-mist-400">No activities logged yet.</Cell></Row>}
              {outreachActivities.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{a.chw}</Cell>
                  <Cell>
                    <Badge tone="mist">{a.type}</Badge>
                    {a.notes && <span className="mt-0.5 block text-[11px] text-mist-400">{a.notes}</span>}
                  </Cell>
                  <Cell>{a.ward}</Cell>
                  <Cell>{a.households}</Cell>
                  <Cell>{a.referrals}</Cell>
                  <Cell>{shortDate(a.date)}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["Name", "Cadre", "Phone", "Status"]}>
              {chws.map((c, i) => (
                <Row key={c.id} index={i}>
                  <Cell className="font-semibold">{c.name}</Cell>
                  <Cell>{c.cadre}</Cell>
                  <Cell>{c.phone ?? "—"}</Cell>
                  <Cell><Badge tone="brand">{c.status}</Badge></Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log Outreach Activity"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.date || busy || (live && (!chosenChw || !f.ward.trim()))} onClick={async () => {
            setBusy(true); setActionError("");
            try {
              if (live) await useLiveOutreach.getState().log({ ...f, chwUserId: chosenChw }, logKey);
              else addOutreach({ ...f, date: new Date(f.date).toISOString(), notes: f.notes.trim() || undefined });
              setOpen(false); setF({ ...f, date: "", households: 0, referrals: 0, notes: "" });
            } catch (cause) { setActionError(describeEmrError(cause)); }
            finally { setBusy(false); }
          }}>{busy ? "Saving…" : "Save Activity"}</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          {live ? (
            <Field label="CHW" hint={chws.length ? undefined : "No community health workers yet — give a member the Community Health Worker role first."}>
              <Select value={chosenChw} onChange={(e) => setChwUserId(e.target.value)} options={chws.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
          ) : (
            <Field label="CHW"><Select value={f.chw} onChange={(e) => setF({ ...f, chw: e.target.value })} options={chws.map((c) => c.name)} /></Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Activity type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={activityTypes} /></Field>
            <Field label="Ward / zone"><Input value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} /></Field>
            <Field label="Households reached"><Input type="number" value={f.households || ""} onChange={(e) => setF({ ...f, households: +e.target.value })} /></Field>
            <Field label="Referrals made"><Input type="number" value={f.referrals || ""} onChange={(e) => setF({ ...f, referrals: +e.target.value })} /></Field>
          </div>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Households missed, follow-up needed, supplies used…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
