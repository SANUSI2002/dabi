import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { emrRequest, newIdempotencyKey, describeEmrError } from "@/emr-live/client";
import { useLiveEmr } from "@/emr-live/session";

type Disposition = "ACCEPTED" | "REJECTED" | "DEFERRED";
type Assessment = {
  id: string; sourceRevision: number; questionVersion: string; resolvedModel: string | null;
  mode: "SHADOW" | "REVIEW_ONLY"; processingStatus: string; clinicalActionApplied: false;
  answers: { medication_history?: { type: "choice"; choice: string; confidence: number } } | null;
  reviews: { id: string; disposition: Disposition; reason: string }[];
};
type Result = { available: boolean; items: Assessment[] };
type Props = { encounterId: string; noteId: string; noteVersion: number; unsavedChanges: boolean };
const labels: Record<string, string> = {
  identified: "Current medicine use is documented by name.",
  unresolved: "Current medicine use is reported, but a medicine name is missing.",
  denied: "Current medicine use is explicitly denied in the note.",
  not_documented: "Current medicine use is not addressed in the note.",
  conflicting: "The note contains conflicting statements about current medicine use.",
};

/** Re-key on hospital/source changes so another patient's pending response can never appear here. */
export function JevNoteReview(props: Props) {
  const organizationId = useLiveEmr((s) => s.access?.organizationId);
  return organizationId ? <JevNoteReviewPanel key={`${organizationId}:${props.encounterId}:${props.noteId}:${props.noteVersion}`} {...props} /> : null;
}
export function JevNoteReviewPanel({ encounterId, noteId, noteVersion, unsavedChanges, request = emrRequest }: Props & { request?: typeof emrRequest }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<Disposition>("DEFERRED");
  const id = useId();
  const live = useRef(true);
  const requestId = useRef<string | null>(null);
  const reviewRequest = useRef<{ signature: string; id: string } | null>(null);
  const path = `/ai/encounters/${encounterId}/notes/${noteId}/assessments`;
  const attempts = useRef(0);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  const refresh = useCallback(async () => {
    const result = await request<{ data: Result }>(path);
    if (live.current) setData(result.data);
    return result.data;
  }, [path, request]);
  useEffect(() => {
    let active = true;
    request<{ data: Result }>(path).then((r) => { if (active) setData(r.data); })
      .catch((e) => { if (active) setError(describeEmrError(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, request]);
  const pending = data?.items.some((a) => ["QUEUED", "RUNNING"].includes(a.processingStatus));
  useEffect(() => {
    if (!pending || attempts.current >= 8) return;
    const timer = window.setTimeout(() => {
      attempts.current += 1;
      refresh().catch(() => { if (live.current) setMessage("Status could not refresh. Your note is unchanged; refresh this review when ready."); });
    }, Math.min(15000, 2000 * 2 ** attempts.current));
    return () => window.clearTimeout(timer);
  }, [pending, data, refresh]); // Bounded polling, then explicit refresh; no endless background loop.

  async function requestReview() {
    if (busy || unsavedChanges) return;
    setBusy(true); setError("");
    requestId.current ??= newIdempotencyKey();
    try {
      const response = await request<{ data: Assessment }>(path, { method: "POST", body: { clientRequestId: requestId.current, noteVersion } });
      if (!live.current) return;
      requestId.current = null; attempts.current = 0;
      setMessage(["QUEUED", "RUNNING"].includes(response.data.processingStatus)
        ? "Documentation review requested. You can continue working while it runs."
        : response.data.processingStatus === "COMPLETED" ? "The existing review already covers this saved version. No duplicate request was sent."
          : "The previous request is retained for this saved version. No automatic retry was sent; continue your usual documentation checks.");
      await refresh();
    } catch (e) { if (live.current) setError(describeEmrError(e)); }
    finally { if (live.current) setBusy(false); }
  }
  const latest = data?.items[0];
  const assessment = latest?.answers?.medication_history;
  const current = latest && latest.sourceRevision === noteVersion && latest.processingStatus === "COMPLETED" && !unsavedChanges;
  const reviewable = data?.available && current && latest.mode === "REVIEW_ONLY" && Boolean(assessment);
  async function recordReview() {
    if (!reviewable || !latest || busy || reason.trim().length < 3) return;
    setBusy(true); setError("");
    const signature = JSON.stringify([latest.id, disposition, reason.trim()]);
    if (reviewRequest.current?.signature !== signature) reviewRequest.current = { signature, id: newIdempotencyKey() };
    try {
      await request(`/ai/assessments/${latest.id}/reviews`, { method: "POST", body: { clientRequestId: reviewRequest.current.id, disposition, reason: reason.trim() } });
      if (!live.current) return;
      setMessage("Review decision recorded. The clinical note and prescriptions have not been changed.");
      setReason(""); reviewRequest.current = null; await refresh();
    } catch (e) { if (live.current) setError(describeEmrError(e)); }
    finally { if (live.current) setBusy(false); }
  }
  // Do not advertise a non-working feature in an organization with no approved policy/history.
  if (!loading && data && !data.available && !data.items.length) return null;
  return <section aria-labelledby={`${id}-heading`} className="card space-y-4 border-brand-200">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id={`${id}-heading`} className="font-display text-lg font-bold text-mist-900">Documentation review</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-mist-700">JEV reviews how medicine history is documented in your saved note. It does not diagnose or check prescribing safety.</p>
      </div>
      <Button type="button" variant="soft" className="min-h-11" disabled={!data?.available || busy || pending || unsavedChanges} onClick={() => void requestReview()}>
        {busy ? "Saving…" : pending ? "Review in progress…" : "Review saved note"}
      </Button>
    </div>
    {loading && <p role="status" className="text-sm text-mist-700">Loading documentation review…</p>}
    {unsavedChanges && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Save your draft first. Previous results do not cover unsaved changes.</p>}
    {error && <p role="alert" className="text-sm text-action-800">{error} Your note can still be saved or signed normally.</p>}
    <p role="status" aria-atomic="true" className="text-sm text-brand-800">{message || (pending ? "Documentation review is running. You can continue working." : "")}</p>
    {latest && <div className="space-y-3 rounded-xl border border-mist-200 p-4">
      <p className="break-words text-sm text-mist-700">Saved note version {latest.sourceRevision} · {latest.questionVersion} · {latest.resolvedModel ?? "Model result pending"}</p>
      {current && assessment ? <p className="font-semibold text-mist-900">{labels[assessment.choice] ?? "Assessment cannot be displayed. Review the source note directly."}</p>
        : <p className="text-sm text-mist-700">{unsavedChanges || latest.processingStatus === "STALE" ? "This review is out of date. Save and request a fresh review." : latest.processingStatus === "FAILED" ? "Review unavailable. This is not a clinical all-clear; continue your usual documentation checks." : latest.mode === "SHADOW" ? "Recorded for controlled evaluation; no assessment advice is displayed." : "No current review finding is available."}</p>}
      {assessment && current && <p className="text-sm text-mist-700">This is a documentation finding, not a probability of disease or a medicine-safety conclusion.</p>}
      {reviewable && <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-mist-800">Your decision
          <select className="min-h-11 w-full rounded-xl border border-mist-300 bg-white px-3 text-base" value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
            <option value="DEFERRED">Defer — clarification needed</option><option value="ACCEPTED">Accept finding</option><option value="REJECTED">Reject finding</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-mist-800">Reason (required)
          <textarea className="min-h-24 w-full rounded-xl border border-mist-300 p-3 text-base" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} aria-describedby={`${id}-hint`} />
        </label>
        <p id={`${id}-hint`} className="text-sm text-mist-700 sm:col-span-2">Record your reasoning. This appends a review decision only; make any clinical changes in the note yourself.</p>
        <Button type="button" variant="soft" className="min-h-11 justify-self-start" disabled={busy || reason.trim().length < 3} onClick={() => void recordReview()}>Record decision</Button>
      </div>}
      {latest.reviews?.length > 0 && <ul className="space-y-2 text-sm text-mist-800" aria-label="Recorded review decisions">{latest.reviews.map((r) => <li key={r.id} className="break-words"><strong>{r.disposition}</strong> — {r.reason}</li>)}</ul>}
    </div>}
    <Button type="button" variant="ghost" className="min-h-11" disabled={busy || loading} onClick={() => { attempts.current = 0; setError(""); void refresh().catch((e) => { if (live.current) setError(describeEmrError(e)); }); }}>Refresh review</Button>
  </section>;
}
