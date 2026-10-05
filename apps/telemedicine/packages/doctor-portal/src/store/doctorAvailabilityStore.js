import { createScopedStore } from "./scopedStore.js";
import { getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SEED = {
  weeklyHours: DAYS.reduce((acc, day, i) => {
    acc[day] = {
      enabled: i < 2,
      start: "09:00 AM",
      end: "05:00 PM",
      virtual: true,
      physical: true,
    };
    return acc;
  }, {}),
  slotConfig: {
    consultationDuration: "30 minutes",
    bufferTime: "5 minutes",
  },
  oneOffBlocks: [
    { id: "block-seed-1", label: "Annual Medical Conference", date: "2024-10-15", start: "09:00", end: "17:00" },
  ],
  affiliatedHours: [
    { hospital: "St. Nicholas Hospital", day: "Thursday", start: "08:00", end: "14:00" },
    { hospital: "St. Nicholas Hospital", day: "Friday", start: "08:00", end: "12:00" },
  ],
};


const store = createScopedStore({ key: "sabi-doctor-availability", seed: () => ({ ...SEED, oneOffBlocks: [], affiliatedHours: getDoctorId() === PRIMARY_DOCTOR_ID ? SEED.affiliatedHours : [] }), validate: (v) => !!v && !Array.isArray(v) && DAYS.every((day) => v.weeklyHours?.[day] && typeof v.weeklyHours[day].enabled === "boolean" && typeof v.weeklyHours[day].start === "string" && typeof v.weeklyHours[day].end === "string") && !!v.slotConfig && Array.isArray(v.oneOffBlocks) && Array.isArray(v.affiliatedHours) });
const persist = store.write;
const notify = store.notify;
export const subscribeToAvailability = store.subscribe;
export const getAvailability = store.get;
export function toggleDay(day) {
  const state = structuredClone(getAvailability());
  state.weeklyHours[day].enabled = !state.weeklyHours[day].enabled;
  persist(state);
  notify();
  return state;
}

export function updateDayHours(day, patch) {
  const state = structuredClone(getAvailability());
  state.weeklyHours[day] = { ...state.weeklyHours[day], ...patch };
  persist(state);
  notify();
  return state;
}

export function updateSlotConfig(patch) {
  const state = structuredClone(getAvailability());
  state.slotConfig = { ...state.slotConfig, ...patch };
  persist(state);
  notify();
  return state;
}

let nextBlockId = 1;
export function addOneOffBlock({ label, date, start, end }) {
  const state = structuredClone(getAvailability());
  const block = { id: `block-${Date.now()}-${nextBlockId++}`, label, date, start, end };
  state.oneOffBlocks = [block, ...state.oneOffBlocks];
  persist(state);
  notify();
  return block;
}

export function removeOneOffBlock(id) {
  const state = structuredClone(getAvailability());
  state.oneOffBlocks = state.oneOffBlocks.filter((b) => b.id !== id);
  persist(state);
  notify();
  return state;
}
