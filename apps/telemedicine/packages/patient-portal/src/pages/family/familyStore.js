import {
  getCircle,
  getUpcomingCare,
  inviteMember,
  createInviteLink,
  approveMember as apiApproveMember,
  updateMemberPermissions,
  removeMember as apiRemoveMember,
  createDependent,
  getDependent,
  removeDependent,
  lookupInvite,
  acceptInvite,
  requestToJoin,
  initialsOf,
  ageFrom,
} from "../../api/familyApi";
import { getProfile } from "../../api/profileApi";
import { formatClock, listMedications } from "../../api/dashboardApi";
import { DEFAULT_ACCESS_BY_LEVEL, colorFor, fromServerPermissions, toServerPermissions } from "./data";

// The Family & Care Circle pages read members in this shape. Everything comes from the
// Sabi API (/family-care, the patient's profile and medications); details the server
// doesn't track (health scores, other people's medications) are left empty, never invented.

const splitList = (value) => (value ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []);
const whenLabel = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });

function nextAppointmentFor(events, memberId) {
  const next = events.find((e) => e.memberId === memberId && new Date(e.time) >= new Date());
  return next ? `${whenLabel(next.time)} · ${next.title}` : "Not scheduled";
}

function selfMember(profile, meds, events) {
  const form = profile?.form || {};
  const taken = meds.filter((m) => m.isTaken);
  return {
    id: "self",
    name: `You (${form.fullName || "Me"})`,
    initials: initialsOf(form.fullName || "Me"),
    color: "#2E6B5A",
    relationship: "Self",
    isSelf: true,
    isDependent: false,
    age: ageFrom(form.dob),
    score: null,
    status: "Active",
    nextAppointment: nextAppointmentFor(events, "self"),
    activeMedications: meds.length,
    dueVaccinations: 0,
    lastDose: taken.length ? `${formatClock(taken[taken.length - 1].time)} today` : "—",
    permission: "owner",
    access: DEFAULT_ACCESS_BY_LEVEL.owner,
    bloodGroup: form.bloodType || null,
    genotype: form.genotype || null,
    allergies: splitList(form.knownAllergies),
    sabiHealthId: profile?.account?.patientId || "—",
  };
}

// People who have (or were invited to have) access to the patient's data.
function circleMember(m, events) {
  const pending = m.state !== "active";
  return {
    id: m.id,
    name: m.name,
    initials: initialsOf(m.name),
    color: colorFor(m.id),
    relationship: m.relationship || "Member",
    isDependent: false,
    pending,
    joinRequest: m.state === "join-request",
    inviteLink: m.state === "link",
    canManageDependents: m.state === "active" && m.permissions.includes("PROFILE"),
    age: null,
    addedAt: m.createdAt,
    score: null,
    status: pending ? "Awaiting Response" : "Active",
    nextAppointment: nextAppointmentFor(events, m.id),
    activeMedications: 0,
    dueVaccinations: 0,
    lastDose: "—",
    permission: m.level || "caregiver",
    access: fromServerPermissions(m.state === "join-request" ? m.requestedPermissions : m.permissions),
    requestedPermissions: m.requestedPermissions,
    bloodGroup: null,
    genotype: null,
    allergies: [],
    sabiHealthId: m.email || "—",
  };
}

// Profiles the patient manages for someone without their own account.
function dependentMember(d, events) {
  return {
    id: d.id,
    name: d.fullName,
    nickname: d.nickname,
    initials: initialsOf(d.fullName),
    color: colorFor(d.id),
    relationship: d.careType === "Child" ? "Child" : "Dependent",
    isDependent: true,
    age: d.age,
    addedAt: d.createdAt,
    gender: d.gender,
    score: null,
    status: "Active",
    nextAppointment: nextAppointmentFor(events, d.id),
    activeMedications: 0,
    dueVaccinations: d.immunizationStatus && d.immunizationStatus !== "Up to date" ? 1 : 0,
    lastDose: "—",
    permission: "care-manager",
    access: DEFAULT_ACCESS_BY_LEVEL["care-manager"],
    bloodGroup: d.bloodGroup,
    genotype: d.genotype,
    allergies: d.allergies || [],
    conditions: d.conditions || [],
    sabiHealthId: `SABI-${d.id.slice(0, 8).toUpperCase()}`,
  };
}

/** You, the people in your circle (including pending invites), then your dependents. */
export async function getMembers() {
  const [circle, profile, meds, upcoming] = await Promise.all([
    getCircle(),
    getProfile(),
    listMedications().catch(() => []),
    getUpcomingCare(50).catch(() => ({ events: [] })),
  ]);
  const events = upcoming.events || [];
  // The circle lists dependents in summary; their full profiles carry the clinical details.
  const dependents = await Promise.all(circle.dependents.map((d) => getDependent(d.id).catch(() => d)));
  return [
    selfMember(profile, meds, events),
    ...circle.members.map((m) => circleMember(m, events)),
    ...dependents.map((d) => dependentMember(d, events)),
  ];
}

export async function getMember(id) {
  return (await getMembers()).find((m) => m.id === id) || null;
}

/** Request by Sabi patient ID or invite by email. Returns the one-time invite code to share. */
export async function addMember({ patientId, email, relationship, permission, access }) {
  const result = await inviteMember({
    ...(patientId ? { patientReference: patientId, relationship } : { email }),
    permissionLevel: permission,
    permissions: toServerPermissions(access, permission),
  });
  return result.token;
}

/** A shareable code: anyone signed in who uses it asks to join, and you approve them. */
export async function createCircleInvite(permission) {
  const result = await createInviteLink(permission);
  return result.token;
}

export async function addDependent(fields) {
  return createDependent(fields);
}

export async function updateMember(member, patch) {
  const permission = patch.permission || member.permission;
  const access = patch.access || member.access;
  await updateMemberPermissions(member.id, toServerPermissions(access, permission), permission);
  return { ...member, permission, access };
}

export const approveMember = (member) => apiApproveMember(member.id, toServerPermissions(member.access, member.permission));

export async function removeMember(member) {
  if (member.isDependent) await removeDependent(member.id);
  else await apiRemoveMember(member.id);
}

// ---------------- Circles the user has JOINED (not their own circle) ----------------
export async function getJoinedCircles() {
  const circle = await getCircle();
  return circle.joinedCircles.map((c) => ({
    id: c.id,
    name: `${c.ownerName}'s Family Circle`,
    ownerName: c.ownerName,
    permission: c.level,
    status: c.state === "active" ? "joined" : c.state === "invited" ? "invited" : "pending-approval",
  }));
}

/** Resolves an invite code to the circle it belongs to. */
export async function findCircleByCode(code) {
  const found = await lookupInvite(code);
  return { id: code.trim().toLowerCase(), name: `${found.ownerName}'s Family Circle`, ownerName: found.ownerName, kind: found.kind };
}

/** Accepts a personal invite, or asks to join through a shared code. */
export async function addJoinedCircle(circle, permission, access) {
  if (circle.kind === "DIRECT") await acceptInvite(circle.id);
  else await requestToJoin(circle.id, permission, toServerPermissions(access, permission));
}
