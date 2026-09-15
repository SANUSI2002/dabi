import { create } from "zustand";
import type { ComplianceRequirement, StagedComplianceDocument } from "./domain";

const sessionFileVault = new Map<string, File>();

type UploadState = {
  documents: StagedComplianceDocument[];
  stageDocument: (applicationId: string, requirement: ComplianceRequirement, file: File) => { error?: string };
  removeDocument: (applicationId: string, requirementId: string) => void;
};

export const useComplianceUploads = create<UploadState>((set) => ({
  documents: [],
  stageDocument: (applicationId, requirement, file) => {
    const accepts = requirement.accepts ?? ["application/pdf", "image/jpeg", "image/png"];
    const maximumSizeMb = requirement.maximumSizeMb ?? 10;
    if (!accepts.includes(file.type)) return { error: "Use a PDF, JPEG or PNG document." };
    if (file.size > maximumSizeMb * 1024 * 1024) return { error: `The document must be ${maximumSizeMb} MB or smaller.` };
    const id = `staged_${applicationId}_${requirement.id}_${Date.now().toString(36)}`;
    sessionFileVault.set(id, file);
    const document: StagedComplianceDocument = { id, applicationId, requirementId: requirement.id, filename: file.name, mimeType: file.type, size: file.size, status: "STAGED", malwareScan: "NOT_RUN", stagedAt: new Date().toISOString() };
    set((state) => ({ documents: [...state.documents.filter((item) => !(item.applicationId === applicationId && item.requirementId === requirement.id)), document] }));
    return {};
  },
  removeDocument: (applicationId, requirementId) => set((state) => {
    state.documents.filter((item) => item.applicationId === applicationId && item.requirementId === requirementId).forEach((item) => sessionFileVault.delete(item.id));
    return { documents: state.documents.filter((item) => !(item.applicationId === applicationId && item.requirementId === requirementId)) };
  }),
}));

export function getSessionComplianceFile(applicationId: string, requirementId: string) {
  const document = useComplianceUploads.getState().documents.find((item) => item.applicationId === applicationId && item.requirementId === requirementId);
  if (!document) return undefined;
  const file = sessionFileVault.get(document.id);
  return file ? { document, file } : undefined;
}
