import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVITY_EVENT, IDLE_TIMEOUT_MS, startIdleTimeout } from "./idleTimeout";
import { idleSignInPath } from "@/identity/idleSignOut";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, clear: () => map.clear(), getItem: (k) => map.get(k) ?? null, key: (i) => [...map.keys()][i] ?? null, removeItem: (k) => { map.delete(k); }, setItem: (k, v) => { map.set(k, v); } };
}

describe("idle sign-out timer", () => {
  let clock = 0, storage: Storage, onIdle: ReturnType<typeof vi.fn<() => void>>, stop: (() => void) | undefined;
  const now = () => clock;
  const advance = (ms: number) => { clock += ms; vi.advanceTimersByTime(ms); };
  const start = (isSignedIn = () => true) => { stop = startIdleTimeout({ onIdle, isSignedIn, now, storage }); };
  beforeEach(() => { vi.useFakeTimers(); clock = 1_000_000; storage = memoryStorage(); onIdle = vi.fn<() => void>(); });
  afterEach(() => { stop?.(); vi.useRealTimers(); });

  it("signs out once after five minutes without input", () => {
    start();
    advance(IDLE_TIMEOUT_MS - 20_000); expect(onIdle).not.toHaveBeenCalled();
    advance(30_000); expect(onIdle).toHaveBeenCalledOnce();
    advance(IDLE_TIMEOUT_MS); expect(onIdle).toHaveBeenCalledOnce();
  });

  it("restarts the clock on input and on the activity event used by video calls", () => {
    start();
    advance(4 * 60_000); window.dispatchEvent(new KeyboardEvent("keydown"));
    advance(4 * 60_000); window.dispatchEvent(new Event(ACTIVITY_EVENT));
    advance(4 * 60_000); expect(onIdle).not.toHaveBeenCalled();
    advance(70_000); expect(onIdle).toHaveBeenCalledOnce();
  });

  it("does not run out while nobody is signed in, and starts counting at sign-in", () => {
    let signedIn = false; start(() => signedIn);
    advance(20 * 60_000); expect(onIdle).not.toHaveBeenCalled();
    signedIn = true; advance(4 * 60_000); expect(onIdle).not.toHaveBeenCalled();
    advance(70_000); expect(onIdle).toHaveBeenCalledOnce();
  });

  it("stays signed in while another tab is in use", () => {
    start();
    advance(4 * 60_000); storage.setItem("sabi:last-activity", String(clock));
    advance(4 * 60_000); expect(onIdle).not.toHaveBeenCalled();
  });

  it("follows another tab that signed out and tells other tabs when it signs out", () => {
    start();
    window.dispatchEvent(new StorageEvent("storage", { key: "sabi:idle-sign-out", newValue: "1" }));
    expect(onIdle).toHaveBeenCalledOnce();
    stop?.(); onIdle = vi.fn<() => void>(); start(); advance(IDLE_TIMEOUT_MS + 10_000);
    expect(storage.getItem("sabi:idle-sign-out")).toBeTruthy();
  });

  it("signs out as soon as a device wakes after sleeping past the limit", () => {
    start();
    clock += IDLE_TIMEOUT_MS + 1; // no timers ran while asleep
    window.dispatchEvent(new Event("focus"));
    expect(onIdle).toHaveBeenCalledOnce();
  });
});

describe("idle sign-in destination", () => {
  it("returns people to the sign-in page for the area they were in, and leaves public pages alone", () => {
    expect(idleSignInPath("/pharmacy-portal")).toBe("/pharmacy/login");
    expect(idleSignInPath("/command-center/tenants")).toBe("/command-center/login");
    expect(idleSignInPath("/inpatient")).toBe("/login");
    expect(idleSignInPath("/products/emr")).toBeNull();
    expect(idleSignInPath("/")).toBeNull();
  });
});
