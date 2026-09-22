import { SEED_MEMBERS, DEFAULT_ACCESS_BY_LEVEL } from "./data";

const KEY = "sabi-family-members";

// Minimal localStorage-backed store so a member added on "Add Member" /
// "Setup Dependent Profile" actually shows up back on the Family & Care
// Circle dashboard afterwards, without needing a backend (same pattern
// as pages/vitals/vitalsStore.js).
export function getMembers() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  return SEED_MEMBERS;
}

function persist(members) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(members));
  } catch {
    /* ignore write failures (e.g. private browsing) */
  }
  return members;
}

export function getMember(id) {
  return getMembers().find((m) => m.id === id) || null;
}

export function addMember(member) {
  const permission = member.permission || "care-manager";
  const id = member.id || `member-${Date.now()}`;
  const withDefaults = {
    id,
    color: member.color || "#2E6B5A",
    initials:
      member.initials ||
      (member.name || "New Member")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    score: member.score ?? null,
    status: member.status || "Pending Setup",
    nextAppointment: member.nextAppointment || "Not scheduled",
    activeMedications: member.activeMedications ?? 0,
    dueVaccinations: member.dueVaccinations ?? 0,
    lastDose: member.lastDose || "—",
    access: member.access || DEFAULT_ACCESS_BY_LEVEL[permission] || DEFAULT_ACCESS_BY_LEVEL["care-manager"],
    sabiHealthId: member.sabiHealthId || `SABI-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${(member.name || "X")[0].toUpperCase()}`,
    allergies: member.allergies || [],
    ...member,
    permission,
  };
  const next = [...getMembers(), withDefaults];
  persist(next);
  return withDefaults;
}

export function updateMember(id, patch) {
  const next = getMembers().map((m) => (m.id === id ? { ...m, ...patch } : m));
  persist(next);
  return next.find((m) => m.id === id);
}

export function removeMember(id) {
  const next = getMembers().filter((m) => m.id !== id);
  persist(next);
  return next;
}

export function resetToSeed() {
  persist(SEED_MEMBERS);
  return SEED_MEMBERS;
}

// ---------------- Circles the user has JOINED (not their own circle) ----------------
// Joining someone else's family circle (via QR/code) is conceptually
// different from adding a member to your own circle — you become a
// member of THEIR circle, with whatever access level you requested.

const JOINED_KEY = "sabi-family-joined-circles";

export function getJoinedCircles() {
  try {
    const raw = window.localStorage.getItem(JOINED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

function persistJoined(circles) {
  try {
    window.localStorage.setItem(JOINED_KEY, JSON.stringify(circles));
  } catch {
    /* ignore */
  }
  return circles;
}

export function addJoinedCircle(circle, permission, access) {
  const next = [
    { ...circle, permission, access, joinedAt: new Date().toISOString(), status: "pending-approval" },
    ...getJoinedCircles().filter((c) => c.id !== circle.id),
  ];
  persistJoined(next);
  return next[0];
}
