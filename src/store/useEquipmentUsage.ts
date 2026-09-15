import { create } from "zustand";
import { audit } from "@/store/useAudit";
import type { EquipmentUsageSession, UsageOutcome } from "@/data/equipmentUsage";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type NewSessionInput = { operator: string; patientId?: string; patientName?: string; testName?: string; orderId?: string };

type EquipmentUsageState = {
  sessions: EquipmentUsageSession[];
  startSession: (equipmentId: string, input: NewSessionInput) => EquipmentUsageSession;
  endSession: (id: string, outcome: UsageOutcome) => void;
  currentSessionFor: (equipmentId: string) => EquipmentUsageSession | undefined;
  sessionsFor: (equipmentId: string) => EquipmentUsageSession[];
};

export const useEquipmentUsage = create<EquipmentUsageState>(persisted<EquipmentUsageState>("equipment-usage", (set, get) => ({
  sessions: [],

  startSession: (equipmentId, input) => {
    const session: EquipmentUsageSession = {
      id: rid(),
      equipmentId,
      operator: input.operator,
      patientId: input.patientId,
      patientName: input.patientName,
      testName: input.testName,
      orderId: input.orderId,
      startedAt: new Date().toISOString(),
    };
    audit("equipment usage session started", `equipment-scada/usage/${equipmentId}`, { meta: { operator: input.operator, test: input.testName } });
    set((s) => ({ sessions: [session, ...s.sessions] }));
    return session;
  },

  endSession: (id, outcome) => {
    set((s) => ({
      sessions: s.sessions.map((session) => (session.id === id ? { ...session, endedAt: new Date().toISOString(), outcome } : session)),
    }));
  },

  currentSessionFor: (equipmentId) => get().sessions.find((s) => s.equipmentId === equipmentId && !s.endedAt),
  sessionsFor: (equipmentId) => get().sessions.filter((s) => s.equipmentId === equipmentId),
})));
