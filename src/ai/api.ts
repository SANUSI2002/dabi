import {
  liveApiRequest,
  restoreLiveIdentity,
  type LiveIdentity,
} from "@/identity/liveIdentity";
import type { AiRequest } from "../../apps/telemedicine/packages/shared-portal/ai/AiWorkspace.jsx";
let refreshing: Promise<LiveIdentity | null> | null = null;
export const aiRequest: AiRequest = async (path, options = {}) => {
  const init = {
    ...options,
    cache: "no-store" as const,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  };
  try {
    return await liveApiRequest(path, init);
  } catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    refreshing ??= restoreLiveIdentity().finally(() => {
      refreshing = null;
    });
    if (!(await refreshing)) throw error;
    return liveApiRequest(path, init);
  }
};
export type AiKind = "PERSONAL" | "PROFESSIONAL" | "BUSINESS";
export type AiFeatures = {
  chat: boolean;
  knowledge: boolean;
  documents: boolean;
  memory: boolean;
  reminders: boolean;
};
export type AiEnrollmentInput = {
  kind: AiKind;
  country: string;
  profession?: string;
  authority?: string;
  licenceNumber?: string;
  expiresAt?: string;
  organizationName?: string;
  registrationNumber?: string;
  attestation: true;
};
export type AiAccount = {
  category: AiKind;
  features: AiFeatures;
  policyVersion: number;
  enrollment: null | {
    kind: AiKind;
    status: string;
    version: number;
    expiresAt: string | null;
    details: AiEnrollmentInput;
    decisionReason: string | null;
  };
};
export type AiProfession = {
  id: string;
  label: string;
  authority: string | null;
  url: string | null;
};
export async function aiAccountGet<T>(path: string) {
  return (
    await liveApiRequest<{ data: T }>(`/api/v1/ai-account${path}`, {
      cache: "no-store",
    })
  ).data;
}
export async function aiAccountPost<T>(path: string, body: unknown) {
  return (
    await liveApiRequest<{ data: T }>(`/api/v1/ai-account${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  ).data;
}
