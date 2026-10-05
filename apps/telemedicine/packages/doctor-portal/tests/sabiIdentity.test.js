import { test } from "node:test";
import assert from "node:assert/strict";
import { createDoctorAuthClient } from "../src/services/doctorAuthClient.js";
import { groupPatients, safeMeetingUrl } from "../src/live/doctorData.js";
const user = { id: "user-1", email: "doctor@example.test", fullName: "Dr Test", accountStatus: "ACTIVE", emailVerifiedAt: "2026-10-05T09:00:00Z" };
const professional = { id: "profile-1", professionType: "DOCTOR", verificationStatus: "VERIFIED", specialty: "General practice" };
function harness({ person = user, profile = professional, mfa = false, unavailable = false } = {}) {
  const calls = [];
  const client = createDoctorAuthClient({ base: "https://sabi.example.test", lock: (work) => work(), fetcher: async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, options });
    let status = 200, data;
    if (unavailable) { status = 503; data = { message: "Temporarily unavailable" }; }
    else if (path === "/api/v1/auth/login" && mfa) data = { status: "mfa_required", challengeToken: "server-challenge" };
    else if (["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/mfa/login/verify"].includes(path)) data = { accessToken: "server-token" };
    else if (path === "/api/v1/auth/me") data = { user: person, organizations: [] };
    else if (path === "/api/v1/professionals/me") { status = profile ? 200 : 404; data = { data: profile }; }
    else data = { data: { items: [] } };
    return { ok: status < 400, status, json: async () => data };
  } });
  return { client, calls };
}
test("Sabi sign-in uses the server identity and verified doctor profile", async () => {
  const { client, calls } = harness();
  const result = await client.signIn("doctor@example.test", "synthetic password");
  assert.equal(result.doctor.id, "profile-1"); assert.equal(result.doctor.userId, "user-1"); assert.equal(result.doctor.licenceVerified, true);
  assert.deepEqual(calls.map((r) => r.path), ["/api/v1/auth/login", "/api/v1/auth/me", "/api/v1/professionals/me"]);
  assert.equal(calls[1].options.headers.Authorization, "Bearer server-token"); assert.equal(calls[0].options.credentials, "include");
});
test("MFA creates no doctor session before server verification and supports recovery", async () => {
  const { client, calls } = harness({ mfa: true });
  const result = await client.signIn("doctor@example.test", "synthetic password");
  assert.deepEqual(result, { mfaRequired: true, challengeId: "server-challenge" }); assert.equal(calls.length, 1);
  assert.equal((await client.verifySignIn(result.challengeId, "synthetic-recovery", true)).doctor.id, "profile-1");
  assert.deepEqual(JSON.parse(calls[1].options.body), { challengeToken: "server-challenge", recoveryCode: "synthetic-recovery" });
});
test("patient identities and other professions cannot enter the doctor workspace", async () => {
  for (const profile of [null, { ...professional, professionType: "NURSE" }]) {
    const { client } = harness({ profile }); await assert.rejects(client.signIn("other@example.test", "synthetic"), { code: "DOCTOR_ACCESS_REQUIRED" });
  }
});
test("pending, suspended and unverified-email doctors cannot call clinical services", async () => {
  for (const options of [{ profile: { ...professional, verificationStatus: "PENDING" } }, { profile: { ...professional, verificationStatus: "SUSPENDED" } }, { person: { ...user, emailVerifiedAt: null } }]) {
    const { client, calls } = harness(options); await client.signIn("doctor@example.test", "synthetic");
    await assert.rejects(client.authenticated("/doctor-appointments/practice/appointments"), { status: 401 });
    assert.equal(calls.some((c) => c.path.includes("/practice/")), false);
  }
});
test("simultaneous restores share a single refresh and outages stay retriable", async () => {
  const { client, calls } = harness();
  const results = await Promise.all([client.restore(), client.restore(), client.restore()]);
  assert.equal(calls.filter((r) => r.path.endsWith("/refresh")).length, 1); assert.equal(results.every((r) => r.doctor.id === "profile-1"), true);
  await assert.rejects(harness({ unavailable: true }).client.restore(), { status: 503 });
});
test("duplicate names and dependents retain separate server identities", () => {
  const rows = [{ id: "one", patient: { userId: "a", name: "Same Name" } }, { id: "two", patient: { userId: "b", name: "Same Name" } }, { id: "three", patient: { userId: "a", name: "Same Name" }, dependentId: "child", dependent: { name: "Same Name" } }];
  assert.equal(groupPatients(rows).length, 3);
  assert.equal(groupPatients([{ id: "one", patient: { name: "Same Name" } }, { id: "two", patient: { name: "Same Name" } }]).length, 2);
});
test("meeting links reject executable URLs and embedded credentials", () => {
  assert.equal(safeMeetingUrl("javascript:alert(1)"), null); assert.equal(safeMeetingUrl("https://user:password@example.test"), null);
  assert.equal(safeMeetingUrl("https://meet.example.test/room"), "https://meet.example.test/room");
});
