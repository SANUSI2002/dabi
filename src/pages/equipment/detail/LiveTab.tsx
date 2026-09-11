import { UserRound, Wrench, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { useEquipment } from "@/store/useEquipment";
import { useEquipmentUsage } from "@/store/useEquipmentUsage";
import { triggerScenario, type SimulatorScenario } from "@/lib/equipmentSimulator";
import type { EquipmentRecord } from "@/data/equipment";
import { timeAgo } from "@/lib/format";
import { Row2 } from "./shared";

const SCENARIOS: SimulatorScenario[] = ["Normal", "Device Error", "Over-Threshold", "Connectivity Loss", "Maintenance", "Calibration"];

export function LiveTab({ eq }: { eq: EquipmentRecord }) {
  const store = useEquipment();
  const usage = useEquipmentUsage();
  const heartbeat = store.heartbeats[eq.id];
  const currentSession = usage.currentSessionFor(eq.id);

  return (
    <div className="space-y-4">
      <Card className={currentSession ? "ring-1 ring-brand-200 bg-brand-50/40" : ""}>
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><UserRound size={16} /> Current Activity</h3>
        {currentSession ? (
          <div className="text-sm">
            <p className="font-semibold text-mist-900">In use — {currentSession.operator}</p>
            <p className="mt-0.5 text-mist-600">
              {currentSession.testName ?? "Task in progress"}
              {currentSession.patientName ? ` for ${currentSession.patientName}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-mist-400"><Clock3 size={11} aria-hidden /> Started {timeAgo(currentSession.startedAt)}</p>
          </div>
        ) : (
          <p className="text-sm text-mist-400">No active test or task on this equipment right now.</p>
        )}
      </Card>
      <Card>
        <h3 className="mb-3 font-display font-bold text-mist-900">Connectivity</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Row2 k="Last heartbeat" v={heartbeat?.lastHeartbeatAt ? timeAgo(heartbeat.lastHeartbeatAt) : "Never"} />
          <Row2 k="Latency" v={heartbeat?.latencyMs ? `${Math.round(heartbeat.latencyMs)} ms` : "—"} />
          <Row2 k="Consecutive failures" v={String(heartbeat?.consecutiveFailures ?? 0)} />
          <Row2 k="Connection attempts" v={String(heartbeat?.connectionAttempts ?? 0)} />
        </dl>
      </Card>
      {eq.technical.integrationKind === "SIMULATOR" && (
        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><Wrench size={16} /> Simulator Scenario</h3>
          <p className="mb-3 text-xs text-mist-400">
            Demo control for this simulated device — triggers realistic telemetry/event sequences. No physical equipment is affected.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SCENARIOS.map((s) => (
              <button key={s} onClick={() => triggerScenario(eq.id, s)} className="chip bg-white text-mist-600 ring-1 ring-mist-200 hover:bg-mist-50">
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
