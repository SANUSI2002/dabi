import { liveApiRequest, type LiveApiError } from "@/identity/liveIdentity";
import { useLiveEmr } from "./session";

// Calls the tenant-scoped EMR API (/api/v1/emr/organizations/:organizationId/...) for the hospital
// selected in the live session. The organization-scoped access token is short-lived: on a 401 the
// session refreshes and re-selects the hospital once, then retries the same request.

type EmrRequest = { method?: "GET" | "POST" | "PATCH"; body?: unknown; version?: number; idempotencyKey?: string };

const FIELD_LABELS: Record<string, string> = {
  givenName: "First name", familyName: "Surname", otherNames: "Other name", dateOfBirth: "Date of birth",
  phone: "Phone", nationalId: "NIN", hospitalNumber: "Hospital number", nextOfKinPhone: "Next-of-kin phone",
  emergencyContactPhone: "Emergency contact phone", preferredName: "Preferred name", reportedAllergies: "Known allergies",
  address: "Address", state: "State", lga: "LGA", addressWard: "Ward", language: "Language", occupation: "Occupation",
  nextOfKinName: "Next of kin", nextOfKinRelationship: "Relationship", emergencyContactName: "Emergency contact name",
  emergencyContactRelationship: "Emergency contact relationship", reason: "Reason / chief complaint",
};

/** A readable sentence for staff from the EMR error envelope (field problems first). */
export function describeEmrError(cause: unknown): string {
  const error = cause as Partial<LiveApiError>;
  const detail = error.details?.[0];
  if (detail) {
    const field = detail.field.replace(/^(body|query)\./, "");
    const label = FIELD_LABELS[field.split(".")[0]] ?? field;
    return `${label}: ${detail.message}`;
  }
  if (error.status === 403) return "Your role does not allow this action.";
  return error.message || "The EMR service could not complete this request.";
}

async function send<T>(path: string, request: EmrRequest): Promise<T> {
  const organizationId = useLiveEmr.getState().access?.organizationId;
  if (!organizationId) throw new Error("No hospital is selected.");
  return liveApiRequest<T>(`/api/v1/emr/organizations/${encodeURIComponent(organizationId)}${path}`, {
    method: request.method ?? "GET",
    ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    headers: {
      ...(request.version !== undefined ? { "If-Match": `W/"${request.version}"` } : {}),
      ...(request.idempotencyKey ? { "Idempotency-Key": request.idempotencyKey } : {}),
    },
  });
}

export async function emrRequest<T>(path: string, request: EmrRequest = {}): Promise<T> {
  try {
    return await send<T>(path, request);
  } catch (cause) {
    if ((cause as Partial<LiveApiError>).status !== 401) throw cause;
    await useLiveEmr.getState().reselect();
    return send<T>(path, request);
  }
}

/** Idempotency key for one user action: a retried click never registers the same patient twice. */
export const newIdempotencyKey = () => crypto.randomUUID();
