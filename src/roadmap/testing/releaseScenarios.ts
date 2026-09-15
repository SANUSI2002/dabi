import { useCommandCenter } from "@/command-center/useCommandCenter";
import type { RoadmapActor, RoadmapReleaseDraft } from "../domain";
import { useRoadmap } from "../useRoadmap";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyReleaseLifecycle() {
  const roadmapSnapshot = useRoadmap.getState();
  const commandSnapshot = useCommandCenter.getState();
  const actor: RoadmapActor = { id: "scenario-actor", name: "Scenario Product Lead", role: "Product Lead" };
  const draft: RoadmapReleaseDraft = {
    organizationId: "org-sabi", productId: "accounting", version: "scenario.1", name: "Scenario Release",
    description: "Lifecycle verification release", targetDate: "2026-12-20", status: "PLANNED",
  };

  try {
    const created = useRoadmap.getState().createRelease(draft, actor);
    assert(created.ok, "Release lifecycle: creation failed.");
    const emptyShip = useRoadmap.getState().shipRelease(created.release.id, "2026-09-15", "Internal notes", "", actor, "Scenario verification");
    assert(!emptyShip.ok, "Release lifecycle: empty releases must not ship.");
    const assigned = useRoadmap.getState().assignItemToRelease("roadmap-accounting-events", created.release.id, actor, "Add verified scope");
    assert(assigned.ok, "Release lifecycle: assignment failed.");
    const shipped = useRoadmap.getState().shipRelease(created.release.id, "2026-09-15", "Internal notes", "", actor, "Approved scenario shipment");
    assert(shipped.ok && shipped.release.status === "SHIPPED", "Release lifecycle: shipment failed.");
    const shippedItem = useRoadmap.getState().items.find((item) => item.id === "roadmap-accounting-events");
    assert(shippedItem?.status === "RELEASED" && shippedItem.progress === 100 && shippedItem.actualReleaseDate === "2026-09-15", "Release lifecycle: assigned item was not released atomically.");
    const edited = useRoadmap.getState().updateRelease(created.release.id, { targetDate: "2027-01-01" }, actor, "Should be locked");
    assert(!edited.ok, "Release lifecycle: shipped release was editable.");
    const removed = useRoadmap.getState().assignItemToRelease("roadmap-accounting-events", undefined, actor, "Should be locked");
    assert(!removed.ok, "Release lifecycle: shipped scope was mutable.");
    const history = useRoadmap.getState().releaseHistory.filter((entry) => entry.releaseId === created.release.id);
    assert(history.some((entry) => entry.field === "CREATED") && history.some((entry) => entry.field === "ITEM_ASSIGNMENT") && history.some((entry) => entry.field === "STATUS"), "Release lifecycle: immutable history is incomplete.");
    return { scenarios: 8, historyRecords: history.length, status: "ok" as const };
  } finally {
    useRoadmap.setState(roadmapSnapshot, true);
    useCommandCenter.setState(commandSnapshot, true);
  }
}
