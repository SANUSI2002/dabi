import { create } from "zustand";
import { hasPermission } from "@/command-center/access";
import type { PlatformPermission, PlatformUser } from "@/command-center/domain";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { persisted } from "@/platform/persist";
import { findPossibleDraftDuplicates } from "@/registration/repository";
import type { OrganizationApplication, VerificationState } from "@/registration/domain";
import { useRegistration } from "@/registration/useRegistration";
import { useAuth } from "@/store/useAuth";
import { getSessionComplianceFile } from "./useComplianceUploads";
import type {
  InformationRequest, ReviewNote, VerificationAuditEvent, VerificationCase,
  VerificationCheck, VerificationCheckStatus,
} from "./domain";
import { resolveComplianceRequirements } from "./rules";

type ActionResult = { ok: true } | { ok: false; error: string };
type CheckDecision = Extract<VerificationCheckStatus, "VERIFIED" | "FAILED" | "EXPIRED">;

type VerificationCenterState = {
  cases: VerificationCase[];
  syncApplications: () => void;
  startReview: (applicationId: string) => ActionResult;
  setAssignee: (applicationId: string, assigneeId: string) => ActionResult;
  decideCheck: (applicationId: string, checkId: string, decision: CheckDecision, reason: string) => ActionResult;
  addNote: (applicationId: string, visibility: ReviewNote["visibility"], body: string) => ActionResult;
  requestInformation: (applicationId: string, message: string, requestedItems: string[]) => ActionResult;
  respondToRequest: (applicationId: string, requestId: string, body: string) => ActionResult;
  resolveRequest: (applicationId: string, requestId: string) => ActionResult;
  approve: (applicationId: string, reason: string) => ActionResult;
  reject: (applicationId: string, reason: string) => ActionResult;
};

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

function reviewer(permission: PlatformPermission): PlatformUser | undefined {
  const identity = useAuth.getState().identity;
  const users = useCommandCenter.getState().platformUsers;
  const actor = users.find((item) => item.id === identity?.platformUserId);
  return hasPermission(actor, permission) ? actor : undefined;
}

function validateReason(value: string) {
  const clean = value.trim();
  return clean.length >= 8 ? clean : undefined;
}

function audit(actor: PlatformUser, action: string, reason?: string, previousValue?: string, newValue?: string): VerificationAuditEvent {
  return { id: uid("vevt"), action, actorId: actor.id, actorName: actor.name, actorRole: actor.role, timestamp: now(), reason, previousValue, newValue };
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function createCase(application: OrganizationApplication, applications: OrganizationApplication[]): VerificationCase {
  const resolved = resolveComplianceRequirements(application);
  const duplicate = findPossibleDraftDuplicates(application, applications).length > 0;
  const nameMismatch = !!application.corporate.registeredLegalName && normalized(application.corporate.registeredLegalName) !== normalized(application.organization.legalName);
  const today = new Date().toISOString().slice(0, 10);
  const facilityExpired = !!application.regulatoryRegistration.expiryDate && application.regulatoryRegistration.expiryDate < today;
  const officerExpired = !!application.operatingOfficer.licenceExpiryDate && application.operatingOfficer.licenceExpiryDate < today;
  const riskFlags = [
    duplicate && "Possible duplicate application",
    nameMismatch && "Registered legal name differs from application legal name",
    facilityExpired && "Facility registration appears expired",
    officerExpired && "Operating-officer licence appears expired",
    resolved.fallback && "No active jurisdiction requirement set",
  ].filter(Boolean) as string[];
  const risk = facilityExpired || officerExpired ? "CRITICAL" : duplicate || resolved.fallback ? "HIGH" : nameMismatch ? "MEDIUM" : "LOW";
  const checks: VerificationCheck[] = [
    { id: `${application.id}:corporate`, kind: "CORPORATE", label: "Corporate identity", required: true, status: "NOT_STARTED", evidenceAvailability: "APPLICATION_DATA" },
    { id: `${application.id}:facility`, kind: "FACILITY", label: "Facility registration", required: true, status: facilityExpired ? "EXPIRED" : "NOT_STARTED", evidenceAvailability: "APPLICATION_DATA" },
    { id: `${application.id}:officer`, kind: "OFFICER", label: "Operating officer credential", required: true, status: officerExpired ? "EXPIRED" : "NOT_STARTED", evidenceAvailability: "APPLICATION_DATA" },
    ...resolved.requirements.map((requirement) => ({
      id: `${application.id}:${requirement.id}`,
      kind: "DOCUMENT" as const,
      label: requirement.label,
      requirementId: requirement.id,
      required: requirement.required,
      status: "NOT_STARTED" as const,
      evidenceAvailability: "SESSION_ONLY" as const,
    })),
  ];
  const createdAt = application.submittedAt ?? now();
  return {
    id: uid("vcase"), applicationId: application.id, status: application.status === "DRAFT" || application.status === "WITHDRAWN" ? "SUBMITTED" : application.status,
    risk, riskFlags, checks, notes: [], informationRequests: [], events: [{ id: uid("vevt"), action: "Application entered verification queue", actorId: "system", actorName: "Sabi workflow", actorRole: "SYSTEM", timestamp: createdAt, newValue: "SUBMITTED" }], createdAt, updatedAt: createdAt,
  };
}

function setApplicationStatus(applicationId: string, status: OrganizationApplication["status"]) {
  useRegistration.getState().updateApplication(applicationId, (application) => ({ ...application, status }));
}

function updateApplicationVerification(applicationId: string, check: VerificationCheck, decision: CheckDecision) {
  if (check.kind === "DOCUMENT") return;
  const mapped: VerificationState = decision;
  useRegistration.getState().updateApplication(applicationId, (application) => ({
    ...application,
    verification: {
      ...application.verification,
      ...(check.kind === "CORPORATE" ? { corporate: mapped } : {}),
      ...(check.kind === "FACILITY" ? { facility: mapped } : {}),
      ...(check.kind === "OFFICER" ? { operatingOfficer: mapped } : {}),
    },
  }));
}

function approvalBlockers(application: OrganizationApplication | undefined, item: VerificationCase) {
  const blockers: string[] = [];
  if (!application) blockers.push("Application data is unavailable");
  if (item.status !== "UNDER_REVIEW") blockers.push("Case must be under review");
  if (item.checks.some((check) => check.required && check.status !== "VERIFIED")) blockers.push("Every required check must be verified");
  if (item.informationRequests.some((request) => request.status !== "RESOLVED")) blockers.push("All information requests must be resolved");
  if (!application?.corporate.registrationNumber || !application.regulatoryRegistration.registrationNumber || !application.operatingOfficer.registrationNumber) blockers.push("Required registration metadata is incomplete");
  return blockers;
}

export function getApprovalBlockers(application: OrganizationApplication | undefined, item: VerificationCase) {
  return approvalBlockers(application, item);
}

export const useVerificationCenter = create<VerificationCenterState>(
  persisted<VerificationCenterState>("verification-center-v1", (set, get) => ({
    cases: [],
    syncApplications: () => {
      const applications = useRegistration.getState().applications;
      const eligible = applications.filter((item) => item.status !== "DRAFT" && item.status !== "WITHDRAWN");
      const existing = new Set(get().cases.map((item) => item.applicationId));
      const added = eligible.filter((item) => !existing.has(item.id)).map((item) => createCase(item, applications));
      if (added.length) set((state) => ({ cases: [...added, ...state.cases] }));
    },
    startReview: (applicationId) => {
      const actor = reviewer("onboarding.manage");
      if (!actor) return { ok: false, error: "You do not have permission to manage verification cases." };
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      if (!item || !["SUBMITTED", "NEEDS_INFORMATION"].includes(item.status)) return { ok: false, error: "This case cannot be started from its current state." };
      const updatedAt = now();
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, status: "UNDER_REVIEW", assigneeId: entry.assigneeId ?? actor.id, updatedAt, events: [...entry.events, audit(actor, "Started application review", undefined, entry.status, "UNDER_REVIEW")] } : entry) }));
      setApplicationStatus(applicationId, "UNDER_REVIEW");
      return { ok: true };
    },
    setAssignee: (applicationId, assigneeId) => {
      const actor = reviewer("onboarding.manage");
      if (!actor) return { ok: false, error: "You do not have permission to assign verification cases." };
      const assignee = useCommandCenter.getState().platformUsers.find((item) => item.id === assigneeId && item.status === "Active");
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      if (!item || !assignee) return { ok: false, error: "Choose an active platform reviewer." };
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, assigneeId, updatedAt: now(), events: [...entry.events, audit(actor, `Assigned review to ${assignee.name}`, undefined, entry.assigneeId, assigneeId)] } : entry) }));
      return { ok: true };
    },
    decideCheck: (applicationId, checkId, decision, rawReason) => {
      const actor = reviewer("documents.verify");
      const reason = validateReason(rawReason);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      const check = item?.checks.find((entry) => entry.id === checkId);
      if (!actor) return { ok: false, error: "You do not have permission to decide verification checks." };
      if (!reason) return { ok: false, error: "Provide a review reason of at least eight characters." };
      if (!item || !check || item.status !== "UNDER_REVIEW") return { ok: false, error: "Start the review before deciding checks." };
      if (check.kind === "DOCUMENT" && (!check.requirementId || !getSessionComplianceFile(applicationId, check.requirementId))) return { ok: false, error: "This document is not available in the secure review session. Request a new upload before deciding it." };
      const reviewedAt = now();
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, updatedAt: reviewedAt, checks: entry.checks.map((candidate) => candidate.id === checkId ? { ...candidate, status: decision, reason, reviewedBy: actor.id, reviewedAt } : candidate), events: [...entry.events, audit(actor, `${decision.replace("_", " ")} ${check.label}`, reason, check.status, decision)] } : entry) }));
      updateApplicationVerification(applicationId, check, decision);
      return { ok: true };
    },
    addNote: (applicationId, visibility, rawBody) => {
      const actor = reviewer("onboarding.manage");
      const body = validateReason(rawBody);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      if (!actor) return { ok: false, error: "You do not have permission to add review notes." };
      if (!body) return { ok: false, error: "Write a note of at least eight characters." };
      if (!item) return { ok: false, error: "Verification case not found." };
      const note: ReviewNote = { id: uid("vnote"), visibility, body, authorId: actor.id, authorName: actor.name, createdAt: now() };
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, updatedAt: note.createdAt, notes: [...entry.notes, note], events: [...entry.events, audit(actor, `Added ${visibility.toLowerCase()} review note`)] } : entry) }));
      return { ok: true };
    },
    requestInformation: (applicationId, rawMessage, requestedItems) => {
      const actor = reviewer("onboarding.manage");
      const message = validateReason(rawMessage);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      if (!actor) return { ok: false, error: "You do not have permission to request applicant information." };
      if (!message) return { ok: false, error: "Write an applicant message of at least eight characters." };
      if (!item || item.status !== "UNDER_REVIEW") return { ok: false, error: "Start the review before requesting information." };
      const requestedAt = now();
      const request: InformationRequest = { id: uid("vreq"), message, requestedItems: requestedItems.filter(Boolean), status: "OPEN", requestedBy: actor.id, requestedByName: actor.name, requestedAt, responses: [] };
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, status: "NEEDS_INFORMATION", updatedAt: requestedAt, informationRequests: [...entry.informationRequests, request], events: [...entry.events, audit(actor, "Requested information from applicant", message, entry.status, "NEEDS_INFORMATION")] } : entry) }));
      setApplicationStatus(applicationId, "NEEDS_INFORMATION");
      return { ok: true };
    },
    respondToRequest: (applicationId, requestId, rawBody) => {
      const body = validateReason(rawBody);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      const request = item?.informationRequests.find((entry) => entry.id === requestId);
      if (!body) return { ok: false, error: "Write a response of at least eight characters." };
      if (!item || !request || request.status !== "OPEN") return { ok: false, error: "This information request is no longer open." };
      const createdAt = now();
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, status: "UNDER_REVIEW", updatedAt: createdAt, informationRequests: entry.informationRequests.map((candidate) => candidate.id === requestId ? { ...candidate, status: "RESPONDED", responses: [...candidate.responses, { id: uid("vresp"), body, createdAt }] } : candidate), events: [...entry.events, { id: uid("vevt"), action: "Applicant responded to information request", actorId: `applicant:${applicationId}`, actorName: "Organization applicant", actorRole: "APPLICANT", timestamp: createdAt, previousValue: "NEEDS_INFORMATION", newValue: "UNDER_REVIEW" }] } : entry) }));
      setApplicationStatus(applicationId, "UNDER_REVIEW");
      return { ok: true };
    },
    resolveRequest: (applicationId, requestId) => {
      const actor = reviewer("onboarding.manage");
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      const request = item?.informationRequests.find((entry) => entry.id === requestId);
      if (!actor) return { ok: false, error: "You do not have permission to resolve information requests." };
      if (!item || !request || request.status !== "RESPONDED") return { ok: false, error: "Only responded requests can be resolved." };
      const resolvedAt = now();
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, updatedAt: resolvedAt, informationRequests: entry.informationRequests.map((candidate) => candidate.id === requestId ? { ...candidate, status: "RESOLVED", resolvedAt, resolvedBy: actor.id } : candidate), events: [...entry.events, audit(actor, "Resolved applicant information request", undefined, "RESPONDED", "RESOLVED")] } : entry) }));
      return { ok: true };
    },
    approve: (applicationId, rawReason) => {
      const actor = reviewer("onboarding.manage");
      const reason = validateReason(rawReason);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      const application = useRegistration.getState().applications.find((entry) => entry.id === applicationId);
      if (!actor || !hasPermission(actor, "documents.verify")) return { ok: false, error: "Approval requires onboarding and document-verification permissions." };
      if (!reason) return { ok: false, error: "Provide an approval rationale of at least eight characters." };
      if (!item) return { ok: false, error: "Verification case not found." };
      const blockers = approvalBlockers(application, item);
      if (blockers.length) return { ok: false, error: blockers.join(". ") + "." };
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, status: "APPROVED", updatedAt: now(), events: [...entry.events, audit(actor, "Approved organization application", reason, entry.status, "APPROVED")] } : entry) }));
      setApplicationStatus(applicationId, "APPROVED");
      return { ok: true };
    },
    reject: (applicationId, rawReason) => {
      const actor = reviewer("onboarding.manage");
      const reason = validateReason(rawReason);
      const item = get().cases.find((entry) => entry.applicationId === applicationId);
      if (!actor) return { ok: false, error: "You do not have permission to reject verification cases." };
      if (!reason) return { ok: false, error: "Provide a rejection reason of at least eight characters." };
      if (!item || !["UNDER_REVIEW", "NEEDS_INFORMATION"].includes(item.status)) return { ok: false, error: "This case cannot be rejected from its current state." };
      set((state) => ({ cases: state.cases.map((entry) => entry.id === item.id ? { ...entry, status: "REJECTED", updatedAt: now(), notes: [...entry.notes, { id: uid("vnote"), visibility: "APPLICANT", body: reason, authorId: actor.id, authorName: actor.name, createdAt: now() }], events: [...entry.events, audit(actor, "Rejected organization application", reason, entry.status, "REJECTED")] } : entry) }));
      setApplicationStatus(applicationId, "REJECTED");
      return { ok: true };
    },
  }), { scope: "global", pick: (state) => ({ cases: state.cases }) }),
);
