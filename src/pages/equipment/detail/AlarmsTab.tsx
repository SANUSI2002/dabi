import { useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Card, Button, EmptyState } from "@/components/ui/primitives";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { AlarmSeverityBadge, AlarmLifecycleBadge } from "@/components/equipment/EquipmentStatusBadge";
import type { EquipmentRecord } from "@/data/equipment";
import { dateTime } from "@/lib/format";

export function AlarmsTab({ eq }: { eq: EquipmentRecord }) {
  const events = useEquipmentEvents();
  const alarms = events.alarmsFor(eq.id);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  return (
    <div className="space-y-2">
      {alarms.length === 0 ? (
        <EmptyState title="No alarms recorded" hint="This device has not raised any alarms." />
      ) : (
        alarms.map((alarm) => (
          <Card key={alarm.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlarmSeverityBadge severity={alarm.severity} />
                <AlarmLifecycleBadge status={alarm.status} />
                <span className="text-xs text-mist-400">{alarm.category}</span>
              </div>
              <span className="text-[11px] text-mist-300">{dateTime(alarm.raisedAt)}</span>
            </div>
            <p className="mt-1.5 text-sm text-mist-700">{alarm.description}</p>
            {alarm.resolution && <p className="mt-1 text-xs text-mist-400">Resolution: {alarm.resolution} — {alarm.resolvedBy}, {alarm.resolvedAt ? dateTime(alarm.resolvedAt) : ""}</p>}
            {!["Resolved", "Closed", "Suppressed"].includes(alarm.status) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {alarm.status === "Raised" && (
                  <button onClick={() => events.acknowledgeAlarm(alarm.id)} className="btn-soft px-2.5 py-1 text-xs">Acknowledge</button>
                )}
                {(alarm.status === "Acknowledged" || alarm.status === "Investigating") && (
                  <button onClick={() => events.escalateAlarm(alarm.id, "Biomedical Engineering")} className="btn-soft px-2.5 py-1 text-xs">Escalate</button>
                )}
                <button onClick={() => { setResolveId(alarm.id); setResolution(""); }} className="btn-primary px-2.5 py-1 text-xs">Resolve</button>
                <button onClick={() => events.suppressAlarm(alarm.id)} className="btn-ghost px-2.5 py-1 text-xs">Suppress</button>
              </div>
            )}
          </Card>
        ))
      )}

      {resolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-md">
            <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><TriangleAlert size={16} /> Resolve Alarm</h3>
            <textarea
              className="input min-h-[90px] w-full"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="What was done to resolve this alarm?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button disabled={!resolution.trim()} onClick={() => { events.resolveAlarm(resolveId, resolution.trim()); setResolveId(null); }}>
                <RotateCcw size={14} /> Resolve
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
