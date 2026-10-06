import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_EVENT, IDLE_TIMEOUT_MS, idleSignInUrl, signedOutForInactivity, startIdleTimeout } from "../../shared-portal/idleTimeout.js";

function harness({ signedIn = () => true } = {}) {
  let clock = 1_000_000;
  const target = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
  let idle = 0;
  mock.timers.enable({ apis: ["setInterval"] });
  const stop = startIdleTimeout({ onIdle: () => { idle += 1; }, isSignedIn: signedIn, now: () => clock, target, doc, storage });
  const advance = (ms) => { clock += ms; mock.timers.tick(ms); };
  return { target, storage, advance, time: () => clock, idle: () => idle, sleep: (ms) => { clock += ms; }, stop: () => { stop(); mock.timers.reset(); } };
}

test("signs out once after five minutes without input", () => {
  const h = harness();
  try {
    h.advance(IDLE_TIMEOUT_MS - 20_000); assert.equal(h.idle(), 0);
    h.advance(30_000); assert.equal(h.idle(), 1);
    h.advance(IDLE_TIMEOUT_MS); assert.equal(h.idle(), 1);
  } finally { h.stop(); }
});

test("input, a live video call and another active tab all keep the session", () => {
  const h = harness();
  try {
    h.advance(4 * 60_000); h.target.dispatchEvent(new Event("pointerdown"));
    h.advance(4 * 60_000); h.target.dispatchEvent(new Event(ACTIVITY_EVENT));
    h.advance(4 * 60_000); h.storage.setItem("sabi:last-activity", String(h.time()));
    h.advance(4 * 60_000); assert.equal(h.idle(), 0);
  } finally { h.stop(); }
});

test("holds the clock while signed out and follows a sign-out from another tab", () => {
  let signedIn = false;
  const h = harness({ signedIn: () => signedIn });
  try {
    h.advance(30 * 60_000); assert.equal(h.idle(), 0);
    signedIn = true;
    h.target.dispatchEvent(Object.assign(new Event("storage"), { key: "sabi:idle-sign-out", newValue: "1" }));
    assert.equal(h.idle(), 1);
  } finally { h.stop(); }
});

test("signs out when a sleeping device wakes past the limit", () => {
  const h = harness();
  try { h.sleep(IDLE_TIMEOUT_MS + 1); h.target.dispatchEvent(new Event("focus")); assert.equal(h.idle(), 1); }
  finally { h.stop(); }
});

test("builds the sign-in address and recognises the idle reason", () => {
  assert.equal(idleSignInUrl("/doctor-portal/"), "/doctor-portal/login?reason=idle");
  assert.equal(idleSignInUrl("/"), "/login?reason=idle");
  assert.equal(signedOutForInactivity("?reason=idle"), true);
  assert.equal(signedOutForInactivity("?reason=other"), false);
});
