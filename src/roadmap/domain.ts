export type RoadmapItemType =
  | "FEATURE"
  | "IMPROVEMENT"
  | "INITIATIVE"
  | "RESEARCH"
  | "INFRASTRUCTURE"
  | "SECURITY"
  | "INTEGRATION"
  | "MIGRATION"
  | "BUG_FIX"
  | "COMPLIANCE"
  | "EXPERIMENT";

export type RoadmapVisibility = "INTERNAL" | "PUBLIC" | "CUSTOMER" | "BETA_CUSTOMER";
export type RoadmapPublicationStatus = "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type RoadmapStatus = "IDEA" | "RESEARCH" | "PLANNED" | "DESIGN" | "IN_PROGRESS" | "BETA" | "RELEASE_CANDIDATE" | "RELEASED" | "DELAYED" | "POSTPONED" | "CANCELLED";
export type RoadmapPriority = "P0" | "P1" | "P2" | "P3" | "P4";
export type RoadmapConfidence = "HIGH" | "MEDIUM" | "LOW";
export type RoadmapHealth = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "BLOCKED";
export type PublicTimeframeMode = "EXACT_DATE" | "MONTH" | "QUARTER" | "HALF_YEAR" | "YEAR" | "COMING_SOON" | "NO_DATE";
export type RoadmapDependencyType = "BLOCKED_BY" | "DEPENDS_ON" | "RELATED_TO" | "REQUIRES";

export type RoadmapPublicContent = {
  title: string;
  summary: string;
  timeframeMode: PublicTimeframeMode;
  timeframeLabel: string;
  statusLabel?: string;
  showProgress: boolean;
  releaseNotes?: string;
};

export type RoadmapItem = {
  id: string;
  organizationId: string;
  productId: string;
  moduleId?: string;
  parentId?: string;
  type: RoadmapItemType;
  title: string;
  internalDescription: string;
  status: RoadmapStatus;
  progress: number;
  priority: RoadmapPriority;
  ownerId?: string;
  ownerName?: string;
  teamId?: string;
  startDate?: string;
  targetDate?: string;
  actualReleaseDate?: string;
  relaunchDate?: string;
  releaseId?: string;
  milestoneId?: string;
  visibility: RoadmapVisibility;
  publicationStatus: RoadmapPublicationStatus;
  publicContent?: RoadmapPublicContent;
  confidence: RoadmapConfidence;
  health: RoadmapHealth;
  riskReason?: string;
  mitigation?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type RoadmapRelease = {
  id: string;
  organizationId: string;
  productId: string;
  version: string;
  name: string;
  description: string;
  targetDate?: string;
  actualReleaseDate?: string;
  status: "PLANNED" | "IN_PROGRESS" | "SHIPPED" | "CANCELLED";
  releaseNotes?: string;
  publicName?: string;
  publicSummary?: string;
  publicReleaseNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type RoadmapReleaseHistory = {
  id: string;
  organizationId: string;
  releaseId: string;
  field: "CREATED" | "TARGET_DATE" | "STATUS" | "ITEM_ASSIGNMENT" | "DETAILS";
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  actorId: string;
  actorName: string;
  timestamp: string;
};

export type RoadmapMilestone = {
  id: string;
  organizationId: string;
  productId: string;
  name: string;
  targetDate?: string;
  completedAt?: string;
};

export type RoadmapDependency = {
  id: string;
  organizationId: string;
  sourceItemId: string;
  targetItemId: string;
  type: RoadmapDependencyType;
  createdAt: string;
  createdBy: string;
};

export type RoadmapComment = {
  id: string;
  organizationId: string;
  itemId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  editHistory: { body: string; editedAt: string }[];
};

export type RoadmapActivity = {
  id: string;
  organizationId: string;
  itemId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type RoadmapAuditRecord = {
  id: string;
  organizationId: string;
  itemId?: string;
  releaseId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: string;
};

export type RoadmapActor = { id: string; name: string; role: string };

export type RoadmapPublicDTO = {
  id: string;
  product: { id: string; name: string };
  module?: { id: string; name: string };
  parentPublicId?: string;
  type: RoadmapItemType;
  title: string;
  summary: string;
  status: "Exploring" | "Planned" | "In Progress" | "Beta" | "Released" | "Delayed" | "Postponed";
  timeframe: string;
  progress?: number;
  releaseNotes?: string;
  release?: { id: string; name: string };
};

export type RoadmapItemDraft = Omit<RoadmapItem, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">;
export type RoadmapReleaseDraft = Omit<RoadmapRelease, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">;
