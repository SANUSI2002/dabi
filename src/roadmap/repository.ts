import type { RoadmapActor, RoadmapItem, RoadmapItemDraft, RoadmapPublicationStatus, RoadmapRelease, RoadmapReleaseDraft } from "./domain";

export type RoadmapMutationResult = { ok: true; item: RoadmapItem } | { ok: false; error: string };
export type RoadmapReleaseMutationResult = { ok: true; release: RoadmapRelease } | { ok: false; error: string };

export interface RoadmapRepository {
  listItems(): RoadmapItem[];
  createItem(draft: RoadmapItemDraft, actor: RoadmapActor): RoadmapMutationResult;
  updateItem(id: string, patch: Partial<RoadmapItemDraft>, actor: RoadmapActor, reason?: string): RoadmapMutationResult;
  transitionPublication(id: string, status: RoadmapPublicationStatus, actor: RoadmapActor, reason?: string): RoadmapMutationResult;
  listReleases(): RoadmapRelease[];
  createRelease(draft: RoadmapReleaseDraft, actor: RoadmapActor): RoadmapReleaseMutationResult;
  updateRelease(id: string, patch: Partial<RoadmapReleaseDraft>, actor: RoadmapActor, reason: string): RoadmapReleaseMutationResult;
  assignItemToRelease(itemId: string, releaseId: string | undefined, actor: RoadmapActor, reason: string): RoadmapMutationResult;
  shipRelease(id: string, actualReleaseDate: string, releaseNotes: string, publicReleaseNotes: string, actor: RoadmapActor, reason: string): RoadmapReleaseMutationResult;
}
