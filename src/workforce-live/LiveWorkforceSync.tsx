import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLiveEmr } from "@/emr-live/session";
import { clearPeople, goLivePeople, loadPeople } from "./people";
import { useWorkforceSync } from "./sync";

// Mounted once in the live shell. Each Workforce domain fills its stores from the organization's
// records when the signed-in role may read them, and is emptied otherwise — demo people never show
// in a live hospital. Failed changes appear in the banner.

type Domain = { permission: string; goLive: () => void; load: () => Promise<void>; clear: () => void };
const DOMAINS: Domain[] = [
  { permission: "hr.read", goLive: goLivePeople, load: loadPeople, clear: clearPeople },
];

export function LiveWorkforceSync() {
  const permissions = useLiveEmr((s) => s.access?.permissions);
  const error = useWorkforceSync((s) => s.error);

  useEffect(() => {
    if (!permissions) return;
    for (const domain of DOMAINS) {
      if (permissions.includes(domain.permission)) {
        domain.goLive();
        domain.load().catch((cause) => {
          domain.clear();
          useWorkforceSync.getState().report(cause instanceof Error ? cause.message : "Workforce records could not be loaded.");
        });
      } else {
        domain.clear();
      }
    }
  }, [permissions]);

  if (!error) return null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-action-50 px-4 py-3 text-sm text-action-800 shadow-lg ring-1 ring-action-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">{error}</p>
      <button aria-label="Dismiss" onClick={() => useWorkforceSync.getState().dismiss()} className="text-action-600 hover:text-action-800"><X size={15} /></button>
    </div>
  );
}
