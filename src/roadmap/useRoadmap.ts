import { create } from "zustand";
import { persisted } from "@/platform/persist";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import type {
  RoadmapActivity, RoadmapActor, RoadmapAuditRecord, RoadmapComment, RoadmapDependency,
  RoadmapItem, RoadmapItemDraft, RoadmapMilestone, RoadmapPublicationStatus, RoadmapRelease, RoadmapReleaseDraft, RoadmapReleaseHistory,
} from "./domain";
import type { RoadmapMutationResult, RoadmapReleaseMutationResult } from "./repository";
import { seedRoadmapActivities, seedRoadmapAudit, seedRoadmapItems, seedRoadmapReleases } from "./seed";
import { validateRoadmapItem } from "./validation";

type RoadmapState = {
  items: RoadmapItem[];
  releases: RoadmapRelease[];
  releaseHistory: RoadmapReleaseHistory[];
  milestones: RoadmapMilestone[];
  dependencies: RoadmapDependency[];
  comments: RoadmapComment[];
  activities: RoadmapActivity[];
  auditRecords: RoadmapAuditRecord[];
  createItem: (draft: RoadmapItemDraft, actor: RoadmapActor) => RoadmapMutationResult;
  updateItem: (id: string, patch: Partial<RoadmapItemDraft>, actor: RoadmapActor, reason?: string) => RoadmapMutationResult;
  transitionPublication: (id: string, status: RoadmapPublicationStatus, actor: RoadmapActor, reason?: string) => RoadmapMutationResult;
  createRelease: (draft: RoadmapReleaseDraft, actor: RoadmapActor) => RoadmapReleaseMutationResult;
  updateRelease: (id: string, patch: Partial<RoadmapReleaseDraft>, actor: RoadmapActor, reason: string) => RoadmapReleaseMutationResult;
  assignItemToRelease: (itemId: string, releaseId: string | undefined, actor: RoadmapActor, reason: string) => RoadmapMutationResult;
  shipRelease: (id: string, actualReleaseDate: string, releaseNotes: string, publicReleaseNotes: string, actor: RoadmapActor, reason: string) => RoadmapReleaseMutationResult;
  createMilestone: (productId: string, name: string, targetDate: string | undefined, actor: RoadmapActor) => RoadmapActionResult;
  assignItemToMilestone: (itemId: string, milestoneId: string | undefined, actor: RoadmapActor, reason: string) => RoadmapMutationResult;
  addDependency: (sourceItemId: string, targetItemId: string, type: RoadmapDependency["type"], actor: RoadmapActor) => RoadmapActionResult;
  removeDependency: (dependencyId: string, actor: RoadmapActor, reason: string) => RoadmapActionResult;
  addComment: (itemId: string, body: string, actor: RoadmapActor) => RoadmapActionResult;
};

export type RoadmapActionResult = { ok: true; id: string } | { ok: false; error: string };

function uid(prefix: string) {
  return `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export const useRoadmap = create<RoadmapState>(
  persisted<RoadmapState>("product-roadmap-v1", (set, get) => {
    const commit = (previous: RoadmapItem | undefined, item: RoadmapItem, actor: RoadmapActor, action: string, reason?: string) => {
      const timestamp = new Date().toISOString();
      const detail = previous ? `${previous.title}: ${action.replaceAll("_", " ").toLowerCase()}` : `${item.title} created`;
      const activity: RoadmapActivity = { id: uid("roadmap-activity"), organizationId: item.organizationId, itemId: item.id, actorId: actor.id, actorName: actor.name, action, detail, createdAt: timestamp };
      const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: item.organizationId, itemId: item.id, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, previousValue: previous, newValue: item, reason, timestamp };
      set((state) => ({ items: previous ? state.items.map((entry) => entry.id === item.id ? item : entry) : [item, ...state.items], activities: [activity, ...state.activities], auditRecords: [audit, ...state.auditRecords] }));
      useCommandCenter.getState().recordAuditEvent({ organizationId: item.organizationId, resourceType: "roadmap-item", resourceId: item.id, action: `roadmap.${action.toLowerCase()}`, previousValue: previous, newValue: item, reason }, actor.id);
    };

    const validated = (draft: RoadmapItemDraft, editingId?: string) => {
      const catalog = useCommandCenter.getState();
      return validateRoadmapItem(draft, get().items, catalog.products, catalog.modules, editingId);
    };

    const recordReleaseHistory = (release: RoadmapRelease, actor: RoadmapActor, field: RoadmapReleaseHistory["field"], previousValue: unknown, newValue: unknown, reason?: string) => {
      const history: RoadmapReleaseHistory = { id: uid("release-history"), organizationId: release.organizationId, releaseId: release.id, field, previousValue, newValue, reason, actorId: actor.id, actorName: actor.name, timestamp: new Date().toISOString() };
      const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: release.organizationId, releaseId: release.id, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: `RELEASE_${field}`, previousValue, newValue, reason, timestamp: history.timestamp };
      set((state) => ({ releaseHistory: [history, ...state.releaseHistory], auditRecords: [audit, ...state.auditRecords] }));
      useCommandCenter.getState().recordAuditEvent({ organizationId: release.organizationId, resourceType: "roadmap-release", resourceId: release.id, action: `roadmap.release.${field.toLowerCase()}`, previousValue, newValue, reason }, actor.id);
    };

    return {
      items: seedRoadmapItems,
      releases: seedRoadmapReleases,
      releaseHistory: [],
      milestones: [],
      dependencies: [],
      comments: [],
      activities: seedRoadmapActivities,
      auditRecords: seedRoadmapAudit,
      createItem: (draft, actor) => {
        const errors = validated(draft);
        if (errors.length) return { ok: false, error: errors.join(" ") };
        const now = new Date().toISOString();
        const item: RoadmapItem = { ...draft, id: uid("roadmap"), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
        commit(undefined, item, actor, "CREATED");
        return { ok: true, item };
      },
      updateItem: (id, patch, actor, reason) => {
        const previous = get().items.find((entry) => entry.id === id);
        if (!previous) return { ok: false, error: "Roadmap item not found." };
        const draft: RoadmapItemDraft = { ...previous, ...patch };
        const errors = validated(draft, id);
        if (errors.length) return { ok: false, error: errors.join(" ") };
        const item: RoadmapItem = { ...previous, ...patch, updatedAt: new Date().toISOString(), updatedBy: actor.id };
        commit(previous, item, actor, "UPDATED", reason);
        return { ok: true, item };
      },
      transitionPublication: (id, status, actor, reason) => {
        const previous = get().items.find((entry) => entry.id === id);
        if (!previous) return { ok: false, error: "Roadmap item not found." };
        const allowed: Record<RoadmapPublicationStatus, RoadmapPublicationStatus[]> = {
          DRAFT: ["READY_FOR_REVIEW", "ARCHIVED"],
          READY_FOR_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
          APPROVED: ["PUBLISHED", "DRAFT", "ARCHIVED"],
          PUBLISHED: ["UNPUBLISHED", "ARCHIVED"],
          UNPUBLISHED: ["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "ARCHIVED"],
          ARCHIVED: ["DRAFT"],
        };
        if (!allowed[previous.publicationStatus].includes(status)) return { ok: false, error: `Cannot move ${previous.publicationStatus.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}.` };
        const draft: RoadmapItemDraft = { ...previous, publicationStatus: status };
        const errors = validated(draft, id);
        if (errors.length) return { ok: false, error: errors.join(" ") };
        const item: RoadmapItem = { ...previous, publicationStatus: status, updatedAt: new Date().toISOString(), updatedBy: actor.id };
        commit(previous, item, actor, status === "PUBLISHED" ? "PUBLISHED" : status === "UNPUBLISHED" ? "UNPUBLISHED" : "PUBLICATION_STATUS_CHANGED", reason);
        return { ok: true, item };
      },
      createRelease: (draft, actor) => {
        const catalog = useCommandCenter.getState();
        if (!draft.name.trim() || !draft.version.trim()) return { ok: false, error: "Release name and version are required." };
        if (draft.status === "SHIPPED") return { ok: false, error: "Use the controlled shipment workflow to mark a release as shipped." };
        if (!catalog.products.some((product) => product.id === draft.productId)) return { ok: false, error: "Select a valid Product Catalog product." };
        if (get().releases.some((release) => release.productId === draft.productId && release.version.toLowerCase() === draft.version.toLowerCase())) return { ok: false, error: "This product already has a release with that version." };
        const now = new Date().toISOString();
        const release: RoadmapRelease = { ...draft, id: uid("release"), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
        set((state) => ({ releases: [release, ...state.releases] }));
        recordReleaseHistory(release, actor, "CREATED", undefined, release, "Release created");
        return { ok: true, release };
      },
      updateRelease: (id, patch, actor, reason) => {
        const previous = get().releases.find((release) => release.id === id);
        if (!previous) return { ok: false, error: "Release not found." };
        if (!reason.trim()) return { ok: false, error: "A reason is required for release changes." };
        if (patch.productId && patch.productId !== previous.productId) return { ok: false, error: "A release cannot move to another product." };
        if (patch.status === "SHIPPED") return { ok: false, error: "Use the controlled shipment workflow to mark a release as shipped." };
        if (previous.status === "SHIPPED") return { ok: false, error: "Shipped releases are immutable." };
        const release: RoadmapRelease = { ...previous, ...patch, updatedAt: new Date().toISOString(), updatedBy: actor.id };
        if (!release.name.trim() || !release.version.trim()) return { ok: false, error: "Release name and version are required." };
        if (get().releases.some((entry) => entry.id !== id && entry.productId === release.productId && entry.version.toLowerCase() === release.version.toLowerCase())) return { ok: false, error: "This product already has a release with that version." };
        set((state) => ({ releases: state.releases.map((entry) => entry.id === id ? release : entry) }));
        recordReleaseHistory(release, actor, previous.targetDate !== release.targetDate ? "TARGET_DATE" : previous.status !== release.status ? "STATUS" : "DETAILS", previous, release, reason);
        return { ok: true, release };
      },
      assignItemToRelease: (itemId, releaseId, actor, reason) => {
        const item = get().items.find((entry) => entry.id === itemId);
        if (!item) return { ok: false, error: "Roadmap item not found." };
        const release = releaseId ? get().releases.find((entry) => entry.id === releaseId) : undefined;
        if (releaseId && !release) return { ok: false, error: "Release not found." };
        if (release && release.productId !== item.productId) return { ok: false, error: "A roadmap item can only be assigned to a release for the same product." };
        if (release?.status === "SHIPPED") return { ok: false, error: "Items cannot be assigned to an already shipped release." };
        const previousReleaseId = item.releaseId;
        if (previousReleaseId === releaseId) return { ok: false, error: "This roadmap item is already in that release." };
        const previousRelease = previousReleaseId ? get().releases.find((entry) => entry.id === previousReleaseId) : undefined;
        if (previousRelease?.status === "SHIPPED") return { ok: false, error: "Items cannot be removed from a shipped release." };
        const updated: RoadmapItem = { ...item, releaseId, updatedAt: new Date().toISOString(), updatedBy: actor.id };
        commit(item, updated, actor, "RELEASE_ASSIGNMENT_CHANGED", reason);
        if (previousRelease) recordReleaseHistory(previousRelease, actor, "ITEM_ASSIGNMENT", { itemId, releaseId: previousReleaseId }, { itemId, releaseId }, reason);
        if (release) recordReleaseHistory(release, actor, "ITEM_ASSIGNMENT", previousReleaseId, { itemId, releaseId }, reason);
        return { ok: true, item: updated };
      },
      shipRelease: (id, actualReleaseDate, releaseNotes, publicReleaseNotes, actor, reason) => {
        const previous = get().releases.find((release) => release.id === id);
        if (!previous) return { ok: false, error: "Release not found." };
        if (previous.status === "SHIPPED") return { ok: false, error: "This release has already shipped." };
        if (previous.status === "CANCELLED") return { ok: false, error: "A cancelled release must be re-opened before it can ship." };
        if (!actualReleaseDate || !releaseNotes.trim() || !reason.trim()) return { ok: false, error: "Actual release date, internal release notes and reason are required." };
        if (Number.isNaN(new Date(`${actualReleaseDate}T12:00:00`).getTime())) return { ok: false, error: "Enter a valid actual release date." };
        const assigned = get().items.filter((item) => item.releaseId === id);
        if (!assigned.length) return { ok: false, error: "Assign at least one roadmap item before shipping this release." };
        const assignedIds = new Set(assigned.map((item) => item.id));
        const unresolved = get().dependencies.filter((dependency) => assignedIds.has(dependency.sourceItemId) && dependency.type !== "RELATED_TO" && !assignedIds.has(dependency.targetItemId) && get().items.find((item) => item.id === dependency.targetItemId)?.status !== "RELEASED");
        if (unresolved.length) return { ok: false, error: `${unresolved.length} unresolved external dependency${unresolved.length === 1 ? " blocks" : " dependencies block"} this release.` };
        if (assigned.some((item) => item.publicationStatus === "PUBLISHED") && !publicReleaseNotes.trim()) return { ok: false, error: "Public release notes are required because this release contains published items." };
        const now = new Date().toISOString();
        const release: RoadmapRelease = { ...previous, status: "SHIPPED", actualReleaseDate, releaseNotes, publicReleaseNotes, updatedAt: now, updatedBy: actor.id };
        const updatedItems = get().items.map((item) => assignedIds.has(item.id) ? { ...item, status: "RELEASED" as const, progress: 100, actualReleaseDate, health: "ON_TRACK" as const, updatedAt: now, updatedBy: actor.id, ...(item.publicContent && publicReleaseNotes ? { publicContent: { ...item.publicContent, releaseNotes: item.publicContent.releaseNotes || publicReleaseNotes } } : {}) } : item);
        const activities: RoadmapActivity[] = assigned.map((item) => ({ id: uid("roadmap-activity"), organizationId: item.organizationId, itemId: item.id, actorId: actor.id, actorName: actor.name, action: "RELEASED", detail: `${item.title} shipped in ${release.name}`, createdAt: now }));
        const audits: RoadmapAuditRecord[] = assigned.map((item) => ({ id: uid("roadmap-audit"), organizationId: item.organizationId, itemId: item.id, releaseId: release.id, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "RELEASED", previousValue: item, newValue: updatedItems.find((entry) => entry.id === item.id), reason, timestamp: now }));
        set((state) => ({ releases: state.releases.map((entry) => entry.id === id ? release : entry), items: updatedItems, activities: [...activities, ...state.activities], auditRecords: [...audits, ...state.auditRecords] }));
        recordReleaseHistory(release, actor, "STATUS", previous, release, reason);
        for (const item of assigned) useCommandCenter.getState().recordAuditEvent({ organizationId: item.organizationId, resourceType: "roadmap-item", resourceId: item.id, action: "roadmap.released", previousValue: item, newValue: updatedItems.find((entry) => entry.id === item.id), reason }, actor.id);
        return { ok: true, release };
      },
      createMilestone: (productId, name, targetDate, actor) => {
        if (!name.trim()) return { ok: false, error: "Milestone name is required." };
        if (!useCommandCenter.getState().products.some((product) => product.id === productId)) return { ok: false, error: "Select a valid catalog product." };
        const id = uid("milestone"); const milestone: RoadmapMilestone = { id, organizationId: "org-sabi", productId, name: name.trim(), targetDate };
        const timestamp = new Date().toISOString(); const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: milestone.organizationId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "MILESTONE_CREATED", newValue: milestone, timestamp };
        set((state) => ({ milestones: [milestone, ...state.milestones], auditRecords: [audit, ...state.auditRecords] }));
        useCommandCenter.getState().recordAuditEvent({ organizationId: milestone.organizationId, resourceType: "roadmap-milestone", resourceId: id, action: "roadmap.milestone.created", newValue: milestone }, actor.id);
        return { ok: true, id };
      },
      assignItemToMilestone: (itemId, milestoneId, actor, reason) => {
        const item = get().items.find((entry) => entry.id === itemId); if (!item) return { ok: false, error: "Roadmap item not found." };
        const milestone = milestoneId ? get().milestones.find((entry) => entry.id === milestoneId) : undefined;
        if (milestoneId && !milestone) return { ok: false, error: "Milestone not found." };
        if (milestone && milestone.productId !== item.productId) return { ok: false, error: "Milestone and roadmap item must belong to the same product." };
        if (!reason.trim()) return { ok: false, error: "A reason is required when changing a milestone." };
        const updated = { ...item, milestoneId, updatedAt: new Date().toISOString(), updatedBy: actor.id }; commit(item, updated, actor, "MILESTONE_CHANGED", reason); return { ok: true, item: updated };
      },
      addDependency: (sourceItemId, targetItemId, type, actor) => {
        const source = get().items.find((entry) => entry.id === sourceItemId); const target = get().items.find((entry) => entry.id === targetItemId);
        if (!source || !target) return { ok: false, error: "Select two valid roadmap items." }; if (sourceItemId === targetItemId) return { ok: false, error: "An item cannot depend on itself." };
        if (get().dependencies.some((entry) => entry.sourceItemId === sourceItemId && entry.targetItemId === targetItemId && entry.type === type)) return { ok: false, error: "This dependency already exists." };
        const directed = [...get().dependencies.filter((entry) => entry.type !== "RELATED_TO"), { sourceItemId, targetItemId, type }];
        const visit = (current: string, seen: Set<string>): boolean => current === sourceItemId || directed.filter((entry) => entry.sourceItemId === current).some((entry) => !seen.has(entry.targetItemId) && visit(entry.targetItemId, new Set([...seen, entry.targetItemId])));
        if (type !== "RELATED_TO" && visit(targetItemId, new Set([targetItemId]))) return { ok: false, error: "This dependency would create a cycle." };
        const createdAt = new Date().toISOString(); const id = uid("dependency"); const dependency: RoadmapDependency = { id, organizationId: source.organizationId, sourceItemId, targetItemId, type, createdAt, createdBy: actor.id };
        const activity: RoadmapActivity = { id: uid("roadmap-activity"), organizationId: source.organizationId, itemId: sourceItemId, actorId: actor.id, actorName: actor.name, action: "DEPENDENCY_ADDED", detail: `${source.title} ${type.toLowerCase().replaceAll("_", " ")} ${target.title}`, createdAt };
        const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: source.organizationId, itemId: sourceItemId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "DEPENDENCY_ADDED", newValue: dependency, timestamp: createdAt };
        set((state) => ({ dependencies: [dependency, ...state.dependencies], activities: [activity, ...state.activities], auditRecords: [audit, ...state.auditRecords] }));
        useCommandCenter.getState().recordAuditEvent({ organizationId: source.organizationId, resourceType: "roadmap-dependency", resourceId: id, action: "roadmap.dependency.added", newValue: dependency }, actor.id); return { ok: true, id };
      },
      removeDependency: (dependencyId, actor, reason) => {
        const dependency = get().dependencies.find((entry) => entry.id === dependencyId); if (!dependency) return { ok: false, error: "Dependency not found." }; if (!reason.trim()) return { ok: false, error: "A reason is required to remove a dependency." };
        const timestamp = new Date().toISOString(); const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: dependency.organizationId, itemId: dependency.sourceItemId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "DEPENDENCY_REMOVED", previousValue: dependency, reason, timestamp };
        set((state) => ({ dependencies: state.dependencies.filter((entry) => entry.id !== dependencyId), auditRecords: [audit, ...state.auditRecords] })); useCommandCenter.getState().recordAuditEvent({ organizationId: dependency.organizationId, resourceType: "roadmap-dependency", resourceId: dependencyId, action: "roadmap.dependency.removed", previousValue: dependency, reason }, actor.id); return { ok: true, id: dependencyId };
      },
      addComment: (itemId, body, actor) => {
        const item = get().items.find((entry) => entry.id === itemId); if (!item) return { ok: false, error: "Roadmap item not found." }; if (body.trim().length < 2) return { ok: false, error: "Enter a comment." };
        const createdAt = new Date().toISOString(); const id = uid("comment"); const comment: RoadmapComment = { id, organizationId: item.organizationId, itemId, authorId: actor.id, authorName: actor.name, body: body.trim(), createdAt, editHistory: [] };
        const activity: RoadmapActivity = { id: uid("roadmap-activity"), organizationId: item.organizationId, itemId, actorId: actor.id, actorName: actor.name, action: "COMMENTED", detail: `${actor.name} commented on ${item.title}`, createdAt };
        const audit: RoadmapAuditRecord = { id: uid("roadmap-audit"), organizationId: item.organizationId, itemId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "COMMENT_ADDED", newValue: { id, body: body.trim() }, timestamp: createdAt };
        set((state) => ({ comments: [...state.comments, comment], activities: [activity, ...state.activities], auditRecords: [audit, ...state.auditRecords] })); useCommandCenter.getState().recordAuditEvent({ organizationId: item.organizationId, resourceType: "roadmap-comment", resourceId: id, action: "roadmap.comment.added", newValue: { itemId, body: body.trim() } }, actor.id); return { ok: true, id };
      },
    };
  }, {
    scope: "global",
    pick: (state) => ({ items: state.items, releases: state.releases, releaseHistory: state.releaseHistory, milestones: state.milestones, dependencies: state.dependencies, comments: state.comments, activities: state.activities, auditRecords: state.auditRecords }),
    merge: (base, saved) => {
      const savedItems = saved.items ?? [];
      const savedIds = new Set(savedItems.map((item) => item.id));
      const seedItemsById = new Map(seedRoadmapItems.map((item) => [item.id, item]));
      const mergedItems = [...savedItems.map((item) => ({ ...seedItemsById.get(item.id), ...item })), ...seedRoadmapItems.filter((item) => !savedIds.has(item.id))];
      const seedReleasesById = new Map(seedRoadmapReleases.map((release) => [release.id, release]));
      const savedReleases = (saved.releases ?? []).map((release) => ({ ...seedReleasesById.get(release.id), ...release, version: release.version || seedReleasesById.get(release.id)?.version || "Unversioned", createdAt: release.createdAt || "2026-09-01T09:00:00.000Z", updatedAt: release.updatedAt || "2026-09-01T09:00:00.000Z", createdBy: release.createdBy || "pu_ada", updatedBy: release.updatedBy || "pu_ada" }));
      const savedReleaseIds = new Set(savedReleases.map((release) => release.id));
      return { ...base, ...saved, items: mergedItems, releases: [...savedReleases, ...seedRoadmapReleases.filter((release) => !savedReleaseIds.has(release.id))], releaseHistory: saved.releaseHistory ?? [] };
    },
  }),
);
