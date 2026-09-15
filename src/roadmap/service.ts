import { hasPermission } from "@/command-center/access";
import type { PlatformUser } from "@/command-center/domain";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { serializePublishedRoadmap } from "./publicDto";
import type { RoadmapDependencyType, RoadmapItemDraft, RoadmapPublicationStatus, RoadmapReleaseDraft } from "./domain";
import type { RoadmapMutationResult, RoadmapReleaseMutationResult, RoadmapRepository } from "./repository";
import { useRoadmap } from "./useRoadmap";
import type { RoadmapActionResult } from "./useRoadmap";
import { usePublicRoadmap } from "./usePublicRoadmap";

const repository: RoadmapRepository = {
  listItems: () => useRoadmap.getState().items,
  createItem: (draft, actor) => useRoadmap.getState().createItem(draft, actor),
  updateItem: (id, patch, actor, reason) => useRoadmap.getState().updateItem(id, patch, actor, reason),
  transitionPublication: (id, status, actor, reason) => useRoadmap.getState().transitionPublication(id, status, actor, reason),
  listReleases: () => useRoadmap.getState().releases,
  createRelease: (draft, actor) => useRoadmap.getState().createRelease(draft, actor),
  updateRelease: (id, patch, actor, reason) => useRoadmap.getState().updateRelease(id, patch, actor, reason),
  assignItemToRelease: (itemId, releaseId, actor, reason) => useRoadmap.getState().assignItemToRelease(itemId, releaseId, actor, reason),
  shipRelease: (id, actualReleaseDate, releaseNotes, publicReleaseNotes, actor, reason) => useRoadmap.getState().shipRelease(id, actualReleaseDate, releaseNotes, publicReleaseNotes, actor, reason),
};

function denied(message: string): RoadmapMutationResult { return { ok: false, error: message }; }
function releaseDenied(message: string): RoadmapReleaseMutationResult { return { ok: false, error: message }; }
function actionDenied(message: string): RoadmapActionResult { return { ok: false, error: message }; }
function actor(user: PlatformUser) { return { id: user.id, name: user.name, role: user.role }; }
function syncPublicProjection() {
  const catalog = useCommandCenter.getState();
  usePublicRoadmap.getState().setPublishedSnapshot(serializePublishedRoadmap(repository.listItems(), catalog.products, catalog.modules, repository.listReleases()));
}
function synced(result: RoadmapMutationResult) {
  if (result.ok) syncPublicProjection();
  return result;
}
function releaseSynced(result: RoadmapReleaseMutationResult) {
  if (result.ok) syncPublicProjection();
  return result;
}

export const roadmapService = {
  listInternal(user: PlatformUser) {
    return hasPermission(user, "roadmap.view") ? repository.listItems() : [];
  },
  listPublic() {
    const catalog = useCommandCenter.getState();
    return serializePublishedRoadmap(repository.listItems(), catalog.products, catalog.modules, repository.listReleases());
  },
  create(draft: RoadmapItemDraft, user: PlatformUser) {
    if (!hasPermission(user, "roadmap.create")) return denied("You do not have permission to create roadmap items.");
    return synced(repository.createItem(draft, actor(user)));
  },
  update(id: string, patch: Partial<RoadmapItemDraft>, user: PlatformUser, reason?: string) {
    if (!hasPermission(user, "roadmap.edit")) return denied("You do not have permission to edit roadmap items.");
    if ((patch.startDate !== undefined || patch.targetDate !== undefined) && !hasPermission(user, "roadmap.manage_dates")) return denied("You do not have permission to change roadmap dates.");
    if (patch.priority !== undefined && !hasPermission(user, "roadmap.manage_priority")) return denied("You do not have permission to change roadmap priority.");
    if (patch.visibility !== undefined && !hasPermission(user, "roadmap.manage_visibility")) return denied("You do not have permission to change roadmap visibility.");
    const previous = repository.listItems().find((item) => item.id === id);
    if (previous?.publicationStatus === "PUBLISHED" && patch.publicContent && JSON.stringify(patch.publicContent) !== JSON.stringify(previous.publicContent)) return denied("Unpublish this item before changing its public content.");
    if (previous?.publicationStatus === "PUBLISHED" && patch.visibility && patch.visibility !== "PUBLIC") return denied("Unpublish this item before changing its visibility.");
    return synced(repository.updateItem(id, patch, actor(user), reason));
  },
  transitionPublication(id: string, status: RoadmapPublicationStatus, user: PlatformUser, reason?: string) {
    const permission = status === "PUBLISHED" || status === "APPROVED" ? "roadmap.publish" : status === "UNPUBLISHED" ? "roadmap.unpublish" : status === "ARCHIVED" ? "roadmap.archive" : "roadmap.edit";
    if (!hasPermission(user, permission)) return denied(`You do not have permission to ${status.toLowerCase().replaceAll("_", " ")} roadmap items.`);
    return synced(repository.transitionPublication(id, status, actor(user), reason));
  },
  listReleases(user: PlatformUser) {
    return hasPermission(user, "roadmap.view") ? repository.listReleases() : [];
  },
  createRelease(draft: RoadmapReleaseDraft, user: PlatformUser) {
    if (!hasPermission(user, "roadmap.manage_releases")) return releaseDenied("You do not have permission to create releases.");
    return releaseSynced(repository.createRelease(draft, actor(user)));
  },
  updateRelease(id: string, patch: Partial<RoadmapReleaseDraft>, user: PlatformUser, reason: string) {
    if (!hasPermission(user, "roadmap.manage_releases")) return releaseDenied("You do not have permission to edit releases.");
    return releaseSynced(repository.updateRelease(id, patch, actor(user), reason));
  },
  assignItemToRelease(itemId: string, releaseId: string | undefined, user: PlatformUser, reason: string) {
    if (!hasPermission(user, "roadmap.manage_releases")) return denied("You do not have permission to assign release scope.");
    if (!reason.trim()) return denied("A reason is required when changing release scope.");
    return synced(repository.assignItemToRelease(itemId, releaseId, actor(user), reason));
  },
  shipRelease(id: string, actualReleaseDate: string, releaseNotes: string, publicReleaseNotes: string, user: PlatformUser, reason: string) {
    if (!hasPermission(user, "roadmap.manage_releases")) return releaseDenied("You do not have permission to ship releases.");
    return releaseSynced(repository.shipRelease(id, actualReleaseDate, releaseNotes, publicReleaseNotes, actor(user), reason));
  },
  createMilestone(productId: string, name: string, targetDate: string | undefined, user: PlatformUser) {
    if (!hasPermission(user, "roadmap.manage_dates")) return actionDenied("You do not have permission to create milestones.");
    return useRoadmap.getState().createMilestone(productId, name, targetDate, actor(user));
  },
  assignItemToMilestone(itemId: string, milestoneId: string | undefined, user: PlatformUser, reason: string) {
    if (!hasPermission(user, "roadmap.manage_dates")) return denied("You do not have permission to assign milestones.");
    return useRoadmap.getState().assignItemToMilestone(itemId, milestoneId, actor(user), reason);
  },
  addDependency(sourceItemId: string, targetItemId: string, type: RoadmapDependencyType, user: PlatformUser) {
    if (!hasPermission(user, "roadmap.edit")) return actionDenied("You do not have permission to add dependencies.");
    return useRoadmap.getState().addDependency(sourceItemId, targetItemId, type, actor(user));
  },
  removeDependency(dependencyId: string, user: PlatformUser, reason: string) {
    if (!hasPermission(user, "roadmap.edit")) return actionDenied("You do not have permission to remove dependencies.");
    return useRoadmap.getState().removeDependency(dependencyId, actor(user), reason);
  },
  addComment(itemId: string, body: string, user: PlatformUser) {
    if (!hasPermission(user, "roadmap.comment")) return actionDenied("You do not have permission to comment on roadmap items.");
    return useRoadmap.getState().addComment(itemId, body, actor(user));
  },
};
