import { describe, expect, it } from "vitest";
import { deploymentSurface, otherSurfaceUrl, surfaceForPath } from "./surface";

describe("Sabi deployment surfaces", () => {
  it("keeps public/telemedicine, EMR, and pharmacy paths distinct", () => {
    expect(surfaceForPath("/products/sabi-health")).toBe("health");
    expect(surfaceForPath("/telemedicine/pharmacy-market")).toBe("health");
    expect(surfaceForPath("/workspace")).toBe("emr");
    expect(surfaceForPath("/pharmacy-portal")).toBe("pharmacy");
    expect(surfaceForPath("/login")).toBe("shared");
  });

  it("redirects cross-surface paths only when an actual origin is configured", () => {
    const origins = { health: "https://www.example.test", emr: "https://emr.example.test", pharmacy: "https://pharmacy.example.test" };
    expect(otherSurfaceUrl("/pharmacy/login", "", "health", origins)).toBe("https://pharmacy.example.test/pharmacy/login");
    expect(otherSurfaceUrl("/workspace", "?tab=queue", "health", origins)).toBe("https://emr.example.test/workspace?tab=queue");
    expect(otherSurfaceUrl("/login", "", "pharmacy", origins)).toBeNull();
    expect(otherSurfaceUrl("/pharmacy/login", "", "health", {})).toBeNull();
    expect(deploymentSurface("unexpected")).toBe("all");
  });
});
