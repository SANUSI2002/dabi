import { describe, expect, it } from "vitest";
import { deploymentSurface, otherSurfaceUrl, surfaceForPath } from "./surface";

describe("Sabi deployment surfaces", () => {
  it("keeps all five deployment routes distinct", () => {
    expect(surfaceForPath("/products/sabi-health")).toBe("health");
    expect(surfaceForPath("/telemedicine/pharmacy-market")).toBe("telemedicine");
    expect(surfaceForPath("/command-center/packages")).toBe("command-center");
    expect(surfaceForPath("/command-center/login")).toBe("command-center");
    expect(surfaceForPath("/workspace")).toBe("emr");
    expect(surfaceForPath("/pharmacy-portal")).toBe("pharmacy");
    expect(surfaceForPath("/access")).toBe("health");
    expect(surfaceForPath("/emr/login")).toBe("emr");
    expect(surfaceForPath("/login")).toBe("shared");
  });

  it("redirects cross-surface paths only when an actual origin is configured", () => {
    const origins = { health: "https://www.example.test", emr: "https://emr.example.test", pharmacy: "https://pharmacy.example.test", "command-center": "https://command.example.test", telemedicine: "https://care.example.test" };
    expect(otherSurfaceUrl("/pharmacy/login", "", "health", origins)).toBe("https://pharmacy.example.test/pharmacy/login");
    expect(otherSurfaceUrl("/workspace", "?tab=queue", "health", origins)).toBe("https://emr.example.test/workspace?tab=queue");
    expect(otherSurfaceUrl("/command-center/packages", "", "health", origins)).toBe("https://command.example.test/command-center/packages");
    expect(otherSurfaceUrl("/command-center/login", "", "health", origins)).toBe("https://command.example.test/command-center/login");
    expect(otherSurfaceUrl("/telemedicine/login", "", "health", origins)).toBe("https://care.example.test/login");
    expect(otherSurfaceUrl("/login", "", "pharmacy", origins)).toBeNull();
    expect(otherSurfaceUrl("/pharmacy/login", "", "health", {})).toBeNull();
    expect(deploymentSurface("unexpected")).toBe("all");
  });
});
