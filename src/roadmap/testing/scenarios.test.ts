import { describe, expect, it } from "vitest";
import { verifyReleaseLifecycle } from "./releaseScenarios";
import { verifyRoadmapScenarios } from "./scenarios";

describe("roadmap privacy and release controls", () => {
  it("publishes only sanitized public roadmap data", () => {
    expect(verifyRoadmapScenarios()).toEqual({ scenarios: 12, publicItems: 3, status: "ok" });
  });

  it("ships release scope atomically and locks shipped history", () => {
    const result = verifyReleaseLifecycle();
    expect(result.status).toBe("ok");
    expect(result.scenarios).toBe(8);
    expect(result.historyRecords).toBeGreaterThanOrEqual(3);
  });
});
