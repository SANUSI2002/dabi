import { liveApiRequest } from "@/identity/liveIdentity";
/** Bounded rider requests: uploads/decisions never leave an endless busy state. */
export const getLive = <T>(path: string) =>
  liveApiRequest<{ data: T }>(path, {
    signal: AbortSignal.timeout(60000),
  }).then((r) => r.data);
export const writeLive = <T>(path: string, body: unknown, method = "POST") =>
  liveApiRequest<{ data: T }>(path, {
    method,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  }).then((r) => r.data);
