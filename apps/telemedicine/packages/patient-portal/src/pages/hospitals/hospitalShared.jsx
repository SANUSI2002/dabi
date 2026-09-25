import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { useApiData } from "../../api/useApiData";
import { listDependents } from "../../api/sabiApi";

export function PageShell({ children, placeholder, mainClassName = "sabi-main sabi-hospitals-main" }) {
  const [zoom] = useZoom();
  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className={mainClassName}>
        <Topbar placeholder={placeholder} />
        {children}
      </div>
    </div>
  );
}

/** Renders a loading or error state in place of content; renders children once loaded. */
export function LoadState({ loading, error, onRetry, children, label = "Loading…" }) {
  if (error) {
    return (
      <div className="sabi-card sabi-live-state error" role="alert">
        <AlertTriangle size={32} />
        <h3>We couldn&apos;t load this right now</h3>
        <p>{error.message}</p>
        {onRetry && <button type="button" className="sabi-btn-primary" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="sabi-card sabi-live-state" aria-busy="true">
        <Loader2 size={28} className="sabi-spin" />
        <p>{label}</p>
      </div>
    );
  }
  return children;
}

export const SELF = { key: "self", dependentId: null, name: "You" };

/** The people this account can enroll or book for: the patient and their registered dependents. */
export function useCareSubjects() {
  const { data, loading, error, reload } = useApiData(listDependents, []);
  const subjects = [SELF, ...(data || []).map((d) => ({ key: d.id, dependentId: d.id, name: d.name }))];
  return { subjects, loading, error, reload };
}

export const subjectKey = (dependentId) => dependentId || "self";

export const formatNaira = (amount) => `₦${Number(amount || 0).toLocaleString("en-NG")}`;

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
