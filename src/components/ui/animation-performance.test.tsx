import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GatewayFlow from "./gateway-flow";
import { WorksWheel } from "./works-wheel";

let intersection: IntersectionObserverCallback;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { frames.set(++nextFrame, cb); return nextFrame; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: IntersectionObserverCallback) { intersection = cb; }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const visible = (value: boolean) => act(() => intersection([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver));
const flush = (limit = 150) => {
  for (let i = 0; i < limit && frames.size; i++) {
    const callbacks = [...frames.values()]; frames.clear();
    act(() => callbacks.forEach((cb) => cb(i * 16.67)));
  }
};
const items = [{ title: "Records", image: "/records.webp" }, { title: "Care", image: "/care.webp" }];

describe("image wheel animation lifecycle", () => {
  it("queues no work off-screen or idle, and stops after an interaction settles", () => {
    render(<WorksWheel items={items} />);
    expect(frames.size).toBe(0);
    visible(true);
    expect(frames.size).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Care" }));
    expect(frames.size).toBe(1);
    flush();
    expect(frames.size).toBe(0);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });
  it("does not intercept ordinary vertical scrolling", () => {
    render(<WorksWheel items={items} />); visible(true);
    const event = new WheelEvent("wheel", { deltaY: 150, bubbles: true, cancelable: true });
    screen.getByRole("listbox").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(frames.size).toBe(0);
    expect(screen.getByRole("listbox")).toHaveClass("touch-pan-y");
  });
  it("pauses on viewport exit and resumes the pending selection on entry", () => {
    render(<WorksWheel items={items} />); visible(true);
    fireEvent.click(screen.getByRole("button", { name: "Care" }));
    visible(false); expect(frames.size).toBe(0);
    visible(true); flush(); expect(frames.size).toBe(0);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });
  it("stops on tab hiding and cleans up on unmount", () => {
    const { unmount } = render(<WorksWheel items={items} />); visible(true);
    fireEvent.click(screen.getByRole("button", { name: "Care" }));
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange")); expect(frames.size).toBe(0);
    hidden.mockReturnValue(false); fireEvent(document, new Event("visibilitychange"));
    expect(frames.size).toBe(1); unmount(); expect(frames.size).toBe(0);
  });
  it("keeps keyboard selection instantaneous with reduced motion", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    render(<WorksWheel items={items} />); visible(true);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" }); flush(1);
    expect(frames.size).toBe(0);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" }); flush(1);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(frames.size).toBe(0);
  });
});

/** Execute the actual srcDoc scripts against a synthetic canvas, without a browser or network. */
function canvasRuntime(source: string) {
  const listeners: Record<string, ((event?: unknown) => void)[]> = {};
  const documentListeners: Record<string, (() => void)[]> = {};
  const ctx = { clearRect: vi.fn(), setTransform: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn() };
  const pathCtx = { clearRect: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), bezierCurveTo: vi.fn(), setLineDash: vi.fn(), stroke: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const pathCanvas = { width: 0, height: 0, getContext: () => pathCtx };
  const win = { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 3, parent: {}, addEventListener: (name: string, cb: (event?: unknown) => void) => { (listeners[name] ||= []).push(cb); } };
  const doc = { hidden: false, getElementById: () => canvas, createElement: () => pathCanvas, querySelectorAll: () => [], addEventListener: (name: string, cb: () => void) => { (documentListeners[name] ||= []).push(cb); } };
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const script of scripts.slice(0, 2)) new Function("window", "document", "requestAnimationFrame", "cancelAnimationFrame", "performance", script)(win, doc, requestAnimationFrame, cancelAnimationFrame, { now: () => 0 });
  documentListeners.DOMContentLoaded.forEach((cb) => cb());
  const control = (active: boolean, speed: number) => listeners.message.forEach((cb) => cb({ source: win.parent, data: { type: "threeui-controls", controls: { active, speed } } }));
  return { ctx, pathCtx, canvas, control, doc, documentListeners };
}
describe("Gateway Flow canvas budget", () => {
  it("starts paused; zero speed paints one static frame without requesting another", () => {
    const { container } = render(<GatewayFlow speed={0} />);
    const source = container.querySelector("iframe")!.getAttribute("srcdoc")!;
    const runtime = canvasRuntime(source);
    expect(frames.size).toBe(0);
    runtime.control(true, 0);
    expect(runtime.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    expect(runtime.canvas.width * runtime.canvas.height).toBeLessThanOrEqual(1500001);
  });
  it("caches curves, throttles painting and cancels on pause", () => {
    const { container } = render(<GatewayFlow />);
    const runtime = canvasRuntime(container.querySelector("iframe")!.getAttribute("srcdoc")!);
    runtime.control(true, .5);
    const strokes = runtime.pathCtx.stroke.mock.calls.length;
    expect(strokes).toBeGreaterThan(0);
    flush(6);
    expect(runtime.pathCtx.stroke).toHaveBeenCalledTimes(strokes);
    expect(runtime.ctx.drawImage.mock.calls.length).toBeLessThan(6);
    runtime.control(false, .5); expect(frames.size).toBe(0);
    runtime.control(true, .5); expect(frames.size).toBe(1);
    runtime.doc.hidden = true;
    runtime.documentListeners.visibilitychange.forEach((cb) => cb()); expect(frames.size).toBe(0);
  });
});
