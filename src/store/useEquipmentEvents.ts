import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { EquipmentAlarm, AlarmSeverity, AlarmCategory, TimelineEvent, TimelineEventType, EventSource } from "@/data/equipmentAlarms";

const rid = () => Math.random().toString(36).slice(2, 9);

type NewEventInput = {
  equipmentId: string;
  type: TimelineEventType;
  source: EventSource;
  actor?: string;
  detail?: string;
  patientId?: string;
  relatedOrderId?: string;
  correlationId?: string;
};

type NewAlarmInput = {
  equipmentId: string;
  source: EventSource;
  severity: AlarmSeverity;
  category: AlarmCategory;
  description: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  correlationId?: string;
};

type EquipmentEventsState = {
  timeline: TimelineEvent[];
  alarms: EquipmentAlarm[];
  seenIdempotencyKeys: Set<string>;

  logEvent: (input: NewEventInput) => TimelineEvent | undefined;
  timelineFor: (equipmentId: string) => TimelineEvent[];

  raiseAlarm: (input: NewAlarmInput) => EquipmentAlarm;
  acknowledgeAlarm: (id: string) => void;
  investigateAlarm: (id: string, note: string) => void;
  escalateAlarm: (id: string, to: string) => void;
  resolveAlarm: (id: string, resolution: string) => void;
  closeAlarm: (id: string) => void;
  suppressAlarm: (id: string) => void;
  alarmsFor: (equipmentId: string) => EquipmentAlarm[];
  openAlarmsFor: (equipmentId: string) => EquipmentAlarm[];
};

export const useEquipmentEvents = create<EquipmentEventsState>((set, get) => ({
  timeline: [],
  alarms: [],
  seenIdempotencyKeys: new Set(),

  // Idempotency: the same device event (same equipment + type + correlationId) within one second
  // is treated as a duplicate delivery and dropped rather than double-logged.
  logEvent: (input) => {
    const correlationId = input.correlationId ?? rid();
    const idempotencyKey = `${input.equipmentId}:${input.type}:${correlationId}`;
    if (get().seenIdempotencyKeys.has(idempotencyKey)) return undefined;
    const event: TimelineEvent = {
      id: rid(),
      equipmentId: input.equipmentId,
      type: input.type,
      at: new Date().toISOString(),
      source: input.source,
      actor: input.actor,
      detail: input.detail,
      patientId: input.patientId,
      relatedOrderId: input.relatedOrderId,
      correlationId,
      idempotencyKey,
    };
    set((s) => ({
      timeline: [event, ...s.timeline],
      seenIdempotencyKeys: new Set(s.seenIdempotencyKeys).add(idempotencyKey),
    }));
    return event;
  },

  timelineFor: (equipmentId) => get().timeline.filter((e) => e.equipmentId === equipmentId),

  raiseAlarm: (input) => {
    const alarm: EquipmentAlarm = {
      id: rid(),
      equipmentId: input.equipmentId,
      raisedAt: new Date().toISOString(),
      source: input.source,
      severity: input.severity,
      category: input.category,
      description: input.description,
      parameter: input.parameter,
      value: input.value,
      threshold: input.threshold,
      status: "Raised",
      correlationId: input.correlationId,
    };
    set((s) => ({ alarms: [alarm, ...s.alarms] }));
    get().logEvent({ equipmentId: input.equipmentId, type: "ALARM_RAISED", source: input.source, detail: input.description, correlationId: alarm.id });
    return alarm;
  },

  acknowledgeAlarm: (id) => {
    const who = useIdentity.getState().user.name;
    const alarm = get().alarms.find((a) => a.id === id);
    audit("acknowledged equipment alarm", `equipment-scada/alarm/${id}`, { user: who });
    set((s) => ({
      alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Acknowledged", acknowledgedBy: who, acknowledgedAt: new Date().toISOString() } : a)),
    }));
    if (alarm) get().logEvent({ equipmentId: alarm.equipmentId, type: "ALARM_ACKNOWLEDGED", source: "USER", actor: who, correlationId: alarm.id });
  },

  investigateAlarm: (id, note) => {
    const who = useIdentity.getState().user.name;
    audit("investigating equipment alarm", `equipment-scada/alarm/${id}`, { user: who, meta: { note } });
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Investigating", investigationNote: note } : a)) }));
  },

  escalateAlarm: (id, to) => {
    const who = useIdentity.getState().user.name;
    audit("escalated equipment alarm", `equipment-scada/alarm/${id}`, { user: who, meta: { to } });
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Escalated", escalatedTo: to, escalatedAt: new Date().toISOString() } : a)) }));
  },

  resolveAlarm: (id, resolution) => {
    const who = useIdentity.getState().user.name;
    const alarm = get().alarms.find((a) => a.id === id);
    audit("resolved equipment alarm", `equipment-scada/alarm/${id}`, { user: who, meta: { resolution } });
    set((s) => ({
      alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Resolved", resolution, resolvedBy: who, resolvedAt: new Date().toISOString() } : a)),
    }));
    if (alarm) get().logEvent({ equipmentId: alarm.equipmentId, type: "ALARM_RESOLVED", source: "USER", actor: who, detail: resolution, correlationId: alarm.id });
  },

  closeAlarm: (id) => {
    const who = useIdentity.getState().user.name;
    audit("closed equipment alarm", `equipment-scada/alarm/${id}`, { user: who });
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Closed" } : a)) }));
  },

  suppressAlarm: (id) => {
    const who = useIdentity.getState().user.name;
    audit("suppressed equipment alarm", `equipment-scada/alarm/${id}`, { user: who });
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, status: "Suppressed" } : a)) }));
  },

  alarmsFor: (equipmentId) => get().alarms.filter((a) => a.equipmentId === equipmentId),
  openAlarmsFor: (equipmentId) =>
    get().alarms.filter((a) => a.equipmentId === equipmentId && !["Resolved", "Closed", "Suppressed"].includes(a.status)),
}));
