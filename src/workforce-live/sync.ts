import { create } from "zustand";
import { describeEmrError } from "@/emr-live/client";

// The Workforce live layer. In live mode the existing Workforce/HR stores are filled from the
// organization's records and their actions are replaced with ones that write to the Workforce API:
// the change shows at once, the request runs in a single queue (so dependent steps — create an
// employee, then fill in their profile — reach the server in order), and the store is reloaded from
// the server after each change. A failed change is reported in the banner and the reload puts the
// screen back to what the server holds. The demo stores are untouched outside live mode.

type SyncState = {
  error: string;
  pending: number;
  report: (message: string) => void;
  dismiss: () => void;
};

export const useWorkforceSync = create<SyncState>((set) => ({
  error: "",
  pending: 0,
  report: (message) => set({ error: message }),
  dismiss: () => set({ error: "" }),
}));

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs a live change: `optimistic` updates the store now; `work` (the API calls) runs in order after
 * every earlier change; `reload` refreshes from the server afterwards — on success or failure.
 */
export function liveChange(work: () => Promise<unknown>, reload: () => Promise<void>, optimistic?: () => void): Promise<boolean> {
  optimistic?.();
  useWorkforceSync.setState((s) => ({ pending: s.pending + 1 }));
  const run = queue.then(async () => {
    try {
      await work();
      return true;
    } catch (cause) {
      useWorkforceSync.getState().report(describeEmrError(cause));
      return false;
    } finally {
      await reload().catch(() => undefined);
      useWorkforceSync.setState((s) => ({ pending: s.pending - 1 }));
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

export const uuid = () => crypto.randomUUID();
export const isoDay = (value?: string | null) => (value ? value.slice(0, 10) : undefined);
/** Drops undefined fields, and turns "" into null (cleared) for the API. */
export const clean = (patch: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === "" ? null : v]));
