// Vital readings from the Sabi API, shaped for the vitals pages.
import { listVitals, recordVital } from "../../api/sabiApi";
import { getVitalType, vitalTypeForApi } from "./data";

const toReading = (v) => {
  const type = vitalTypeForApi(v.type);
  const recorded = new Date(v.recordedAt);
  const base = {
    id: v.id,
    typeId: type?.id,
    recordedAt: v.recordedAt,
    date: recorded.toLocaleDateString("en-NG", { month: "short", day: "2-digit", year: "numeric" }),
    time: recorded.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }),
  };
  if (v.type === "BLOOD_PRESSURE") {
    const [systolic, diastolic] = String(v.value).split("/").map(Number);
    return { ...base, systolic, diastolic };
  }
  return { ...base, value: Number(v.value) };
};

/** Newest first. */
export async function fetchReadings(typeId) {
  const type = getVitalType(typeId);
  if (!type) return [];
  const result = await listVitals({ type: type.apiType, sort: "desc" });
  return result.items.map(toReading);
}

/** Latest reading per vital type, keyed by type id. */
export async function fetchLatestReadings() {
  const result = await listVitals({ sort: "desc" });
  const latest = {};
  for (const item of result.items.map(toReading)) if (item.typeId && !latest[item.typeId]) latest[item.typeId] = item;
  return { latest, newest: result.items[0] ? toReading(result.items[0]) : null };
}

export async function saveReading(typeId, { systolic, diastolic, value }) {
  const type = getVitalType(typeId);
  const reading = type.kind === "bp" ? `${Math.round(systolic)}/${Math.round(diastolic)}` : Number(value).toFixed(type.step < 1 ? 1 : 0);
  return recordVital({ type: type.apiType, unit: type.apiUnit, value: reading, recordedAt: new Date().toISOString() });
}
