import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pwa = vi.hoisted(() => ({ registerSW: vi.fn(), update: vi.fn() }));
vi.mock("virtual:pwa-register", () => ({ registerSW: pwa.registerSW }));
const { registerPwa } = await import("../../apps/telemedicine/packages/shared-portal/pwa/registerPwa.ts");

type Options = { onNeedRefresh: () => void; onRegisteredSW: (url: string, registration: { update: () => Promise<void> } | undefined) => void };
const options = () => pwa.registerSW.mock.calls[0][0] as Options;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  pwa.registerSW.mockReturnValue(pwa.update);
});
afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });

describe("installable app updates", () => {
  it("never reloads on its own: a new version waits for the person to choose Reload", () => {
    registerPwa();
    expect(pwa.registerSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }));
    options().onNeedRefresh();
    const notice = document.getElementById("sabi-pwa-update")!;
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain("Save any unsaved work");
    expect(pwa.update).not.toHaveBeenCalled();

    const reload = [...notice.querySelectorAll("button")].find((b) => b.textContent === "Reload")!;
    reload.click();
    expect(pwa.update).toHaveBeenCalledWith(true);
    expect(reload.disabled).toBe(true);
  });

  it("shows one notice at most, and Later dismisses it", () => {
    registerPwa();
    options().onNeedRefresh();
    options().onNeedRefresh();
    expect(document.querySelectorAll("#sabi-pwa-update")).toHaveLength(1);
    [...document.querySelectorAll("#sabi-pwa-update button")].find((b) => b.textContent === "Later")!.dispatchEvent(new MouseEvent("click"));
    expect(document.getElementById("sabi-pwa-update")).toBeNull();
    expect(pwa.update).not.toHaveBeenCalled();
  });

  it("checks for updates hourly while online", () => {
    vi.useFakeTimers();
    const registration = { update: vi.fn().mockResolvedValue(undefined) };
    registerPwa();
    options().onRegisteredSW("sw.js", registration);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("does nothing in browsers without service workers", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    registerPwa();
    expect(pwa.registerSW).not.toHaveBeenCalled();
  });
});
