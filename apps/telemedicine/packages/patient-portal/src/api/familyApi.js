// Family & Care Circle (/api/v1/family-care).
// - Members are care relationships: people the patient has granted access to *their* data.
//   Access is one-way; a member's own records stay private.
// - Dependents are profiles the patient manages for someone without their own account.
// - Invites: a direct invite (email or patient ID) is accepted by that person as sent; an open
//   invite link lets anyone signed in ask to join, and the owner approves what they get.
//   Email delivery isn't configured, so the invite code is shown to the owner to share.
import { authorizedRequest } from "../utils/sabiIdentity";

const BASE = "/api/v1/family-care";
const data = async (promise) => (await promise).data;
const get = (path, query) => data(authorizedRequest(`${BASE}${path}`, { query }));
const send = (method, path, body) => data(authorizedRequest(`${BASE}${path}`, { method, body }));

export const initialsOf = (name = "") =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, age);
}

// ---------------- Members ----------------
function memberState(m) {
  if (m.status === "ACTIVE") return "active";
  if (m.status === "PENDING") {
    if (m.joinRequestedAt) return "join-request";
    return m.invitationKind === "CIRCLE_LINK" ? "link" : "invited";
  }
  return m.status.toLowerCase(); // expired | declined | revoked
}

export const toMember = (m) => ({
  id: m.id,
  kind: "member",
  state: memberState(m),
  name: m.name || m.caregiverEmail || "Open invite link",
  email: m.caregiverEmail || null,
  relationship: m.relationshipLabel || null,
  level: m.permissionLevel || null,
  permissions: m.permissions || [],
  requestedPermissions: m.requestedPermissions || [],
  expiresAt: m.expiresAt,
  createdAt: m.createdAt,
});

export const toDependent = (d) => ({
  ...d,
  kind: "dependent",
  name: d.fullName,
  age: ageFrom(d.dateOfBirth),
});

const toJoined = (m) => ({
  id: m.id,
  ownerName: m.ownerName || "Family circle",
  state: memberState(m),
  level: m.permissionLevel,
  permissions: m.permissions || [],
});

/** The signed-in patient's circle. Revoked/declined relationships are left out. */
export async function getCircle() {
  const circle = await get("/circle");
  const hidden = new Set(["revoked", "declined"]);
  return {
    members: circle.members.map(toMember).filter((m) => !hidden.has(m.state)),
    dependents: circle.dependents.map(toDependent),
    joinedCircles: circle.joinedCircles.map(toJoined).filter((c) => !hidden.has(c.state)),
  };
}

export const getMember = async (id) => {
  const m = await get(`/members/${id}`);
  return { ...toMember(m), name: m.name };
};

/** Direct invite by email or Sabi patient ID. Returns the one-time invite code to share. */
export const inviteMember = ({ email, patientReference, relationship, permissionLevel, permissions }) =>
  send(
    "POST",
    "/members",
    patientReference
      ? { method: "patientId", patientReference: patientReference.trim(), relationship, permissionLevel, permissions }
      : { method: "email", email: email.trim(), permissionLevel, permissions },
  );

/** Open invite link: anyone signed in with the code can ask to join; you approve them. */
export const createInviteLink = (permissionLevel) => send("POST", "/join-links", { permissionLevel });

export const approveMember = (id, permissions) => send("POST", `/members/${id}/approve`, { permissions });
export const updateMemberPermissions = (id, permissions) => send("PATCH", `/${id}/permissions`, { permissions });
export const removeMember = (id) => send("DELETE", `/members/${id}`);

// ---------------- Joining someone else's circle ----------------
export const lookupInvite = (token) => send("POST", "/join/lookup", { token: token.trim().toLowerCase() });
export const acceptInvite = (token) => send("POST", "/invitations/accept", { token: token.trim().toLowerCase() });
export const requestToJoin = (token, permissionLevel, requestedPermissions) =>
  send("POST", "/join", { token: token.trim().toLowerCase(), permissionLevel, requestedPermissions });

/** A link the owner can share; opening it pre-fills the code on the join screen. */
export const inviteUrl = (token) => `${window.location.origin}/family/join#${token}`;

// ---------------- Dependents ----------------
export const getDependent = async (id) => toDependent(await get(`/dependents/${id}`));
export const createDependent = async (fields) => toDependent(await send("POST", "/dependents", fields));
export const updateDependent = async (id, fields) => toDependent(await send("PATCH", `/dependents/${id}`, fields));
export const removeDependent = (id) => send("DELETE", `/dependents/${id}`);

// ---------------- Care calendar ----------------
export const getCalendar = (from, to) => get("/calendar", { from: from.toISOString(), to: to.toISOString() });
export const getUpcomingCare = (limit = 20) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return get("/calendar/upcoming", { from: from.toISOString(), limit });
};
