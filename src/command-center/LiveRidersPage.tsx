import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getLive, writeLive } from "@/rider/riderApi";
import {
  CommandPageHeader,
  CommandButton,
  CommandInput,
  CommandSelect,
  Panel,
  PanelHeader,
  StatusPill,
} from "./components/ui";
import { safeCredentialPreview } from "./LiveDoctorsPage";
import {
  riderCredentialLabel,
  type RiderApplication,
  type RiderCredential,
} from "@/rider/onboardingTypes";
const base = "/command-center/sabi-health/riders";
const api = "/api/v1/platform/riders";
type Queue = {
  items: {
    id: string;
    fullName: string;
    status: string;
    city: string;
    state: string;
    user: { email: string };
  }[];
  nextOffset: number | null;
};
function DocumentReview({
  doc,
  editable,
  busy,
  action,
}: {
  doc: RiderCredential;
  editable: boolean;
  busy: boolean;
  action: (path: string, body?: unknown) => void;
}) {
  const [source, setSource] = useState(doc.sourceName || "");
  const [reference, setReference] = useState(doc.reference || "");
  const [note, setNote] = useState(doc.note || "");
  const [decision, setDecision] = useState("VERIFIED");
  return (
    <Panel>
      <PanelHeader
        title={riderCredentialLabel(doc.kind)}
        action={<StatusPill status={doc.scanStatus} />}
      />
      <div className="space-y-3 p-5 text-sm">
        <p>
          Authenticity: {doc.reviewStatus} · {(doc.byteSize / 1024).toFixed(0)}{" "}
          KB
        </p>
        <CommandButton
          variant="secondary"
          disabled={busy || doc.scanStatus !== "CLEAN"}
          onClick={() => action(`/credentials/${doc.id}/preview`)}
        >
          Preview document
        </CommandButton>
        {doc.scanStatus === "PENDING" && (
          <p role="status">Security screening is running in the background.</p>
        )}
        {doc.scanStatus === "FAILED" && editable && (
          <CommandButton
            disabled={busy}
            variant="secondary"
            onClick={() => action(`/credentials/${doc.id}/retry-scan`)}
          >
            Retry security check
          </CommandButton>
        )}
        {doc.scanErrorCode && <p>Screening result: {doc.scanErrorCode}</p>}
        <p className="text-slate-500">
          A clean security check does not prove authenticity. Verify the
          document with its issuing authority, then record your findings.
        </p>
        {editable && doc.scanStatus === "CLEAN" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              action(`/credentials/${doc.id}/review`, {
                reviewStatus: decision,
                sourceName: source,
                reference,
                note,
              });
            }}
          >
            <label className="block">
              Verification source
              <CommandInput
                className="mt-1 w-full"
                required
                minLength={2}
                maxLength={200}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <label className="block">
              Verification reference
              <CommandInput
                className="mt-1 w-full"
                required
                minLength={2}
                maxLength={200}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="block">
              Findings
              <textarea
                required
                minLength={2}
                maxLength={1000}
                className="mt-1 min-h-24 w-full rounded-lg border p-3"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="block">
              Authenticity decision
              <CommandSelect
                className="ml-2"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </CommandSelect>
            </label>
            <CommandButton disabled={busy}>Save document review</CommandButton>
          </form>
        ) : (
          doc.note && (
            <p>
              {doc.sourceName} · {doc.reference}
              <br />
              {doc.note}
            </p>
          )
        )}
      </div>
    </Panel>
  );
}
export default function LiveRidersPage({
  canApprove,
  userId,
}: {
  canApprove: boolean;
  userId: string;
}) {
  const { pathname } = useLocation();
  const id = pathname.slice(base.length + 1).split("/")[0];
  const [status, setStatus] = useState("SUBMITTED");
  const [offset, setOffset] = useState(0);
  const [queue, setQueue] = useState<Queue>({ items: [], nextOffset: null });
  const [app, setApp] = useState<RiderApplication | null>(null);
  const scanning = !!app?.credentials.some((d) => d.scanStatus === "PENDING");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{
    url: string;
    label: string;
    contentType: string;
  } | null>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!preview)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=previewDialog.current;
    dialog?.showModal();
    return ()=>{dialog?.close();previous?.focus();};
  },[preview]);
  const load = useCallback(async () => {
    if (id) setApp(await getLive<RiderApplication>(`${api}/${id}`));
    else
      setQueue(
        await getLive<Queue>(`${api}?status=${status}&offset=${offset}`),
      );
  }, [id, status, offset]);
  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError("");
    setApp(null);
    load()
      .catch((cause) => {
        if (!stopped) setError(cause.message);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [load]);
  useEffect(() => {
    if (!scanning || busy) return;
    let stopped = false,
      polling = false;
    const timer = setInterval(async () => {
      if (polling || gate.current || document.visibilityState !== "visible")
        return;
      polling = true;
      try {
        const result = await getLive<RiderApplication>(`${api}/${id}`);
        if (!stopped && !gate.current) setApp(result);
      } catch (cause) {
        if (!stopped)
          setError(
            cause instanceof Error ? cause.message : "Status refresh failed.",
          );
      } finally {
        polling = false;
      }
    }, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id, busy, scanning]);
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => {
      setPreview(null);
      setNotice("Preview expired. Reopen the document to continue.");
    }, 60000);
    return () => clearTimeout(timer);
  }, [preview]);
  async function action(suffix: string, body: unknown = {}) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (suffix.endsWith("/preview")) {
        const result = await getLive<{ url: string }>(`${api}/${id}${suffix}`);
        const doc = app?.credentials.find((d) => suffix.includes(d.id));
        if (
          !safeCredentialPreview(result.url) ||
          !doc ||
          !["application/pdf", "image/jpeg", "image/png"].includes(
            doc.contentType,
          )
        )
          throw new Error("The private preview is not trusted.");
        setPreview({
          url: result.url,
          label: riderCredentialLabel(doc.kind),
          contentType: doc.contentType,
        });
      } else {
        await writeLive(`${api}/${id}${suffix}`, {
          ...(body as object),
          version: app?.version,
        });
        setNotice(
          "Action saved and audited. Decision emails are queued automatically.",
        );
        await load();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to complete action.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  const editable =
    canApprove && app?.userId !== userId && app?.status === "SUBMITTED";
  return (
    <>
      <CommandPageHeader
        eyebrow="Sabi Health · Rider operations"
        title={app?.fullName || "Rider applications"}
        description="Review screened credentials and manage delivery partner access."
        actions={
          id ? (
            <Link to={base}>Back to rider queue</Link>
          ) : (
            <CommandButton
              variant="secondary"
              disabled={loading || busy}
              onClick={() => {
                setLoading(true);
                load()
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Refresh queue
            </CommandButton>
          )
        }
      />
      {error && (
        <div
          className="mb-4 rounded-xl bg-red-50 p-4 text-red-800"
          role="alert"
        >
          {error}{" "}
          <Link to="/identity/mfa?next=command-center">
            Verify authenticator again
          </Link>
        </div>
      )}
      {notice && (
        <p
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading rider applications…</p>
      ) : !id ? (
        <Panel>
          <div className="space-y-4 p-5">
            <label>
              Application status
              <CommandSelect
                className="ml-3"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
              >
                {[
                  "SUBMITTED",
                  "DRAFT",
                  "APPROVED",
                  "CHANGES_REQUESTED",
                  "REJECTED",
                  "SUSPENDED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </CommandSelect>
            </label>
            {!queue.items.length && <p>No applications in this queue.</p>}
            {queue.items.map((row) => (
              <Link
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                to={`${base}/${row.id}`}
              >
                <div>
                  <strong>{row.fullName}</strong>
                  <p>
                    {row.user.email} · {row.city}, {row.state}
                  </p>
                </div>
                <StatusPill status={row.status} />
              </Link>
            ))}
            <div className="flex gap-3">
              <CommandButton
                variant="secondary"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Previous
              </CommandButton>
              <CommandButton
                variant="secondary"
                disabled={queue.nextOffset === null}
                onClick={() => setOffset(queue.nextOffset!)}
              >
                Next
              </CommandButton>
            </div>
          </div>
        </Panel>
      ) : (
        app && (
          <div className="space-y-5">
            <Panel>
              <PanelHeader
                title="Application details"
                action={<StatusPill status={app.status} />}
              />
              <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                <p>
                  {app.email}
                  <br />
                  {app.phone}
                </p>
                <p>
                  {app.city}, {app.state}
                  <br />
                  {app.vehicleType}
                </p>
                <p>
                  Driving licence expiry: {app.licenceExpiresAt.slice(0, 10)}
                </p>
                <p>Insurance expiry: {app.insuranceExpiresAt.slice(0, 10)}</p>
                <p className="break-all">Reference: {app.id}</p>
                {app.decisionReason && <p>{app.decisionReason}</p>}
              </div>
            </Panel>
            {app.blockers.length > 0 && (
              <Panel>
                <PanelHeader title="Outstanding approval requirements" />
                <ul className="list-disc space-y-2 p-5 pl-10 text-sm text-amber-800">
                  {app.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </Panel>
            )}
            <div className="grid gap-5 xl:grid-cols-2">
              {app.credentials.map((doc) => (
                <DocumentReview
                  key={doc.id}
                  doc={doc}
                  editable={editable}
                  busy={busy}
                  action={action}
                />
              ))}
            </div>
            {canApprove && app.userId !== userId && (
              <Panel>
                <PanelHeader title="Rider access decision" />
                <div className="space-y-4 p-5">
                  <p>
                    Approval activates delivery access only after every
                    screening and authenticity check passes.
                  </p>
                  <CommandButton
                    disabled={busy || !editable || app.blockers.length > 0}
                    onClick={() => action("/approve")}
                  >
                    Approve rider
                  </CommandButton>
                  <label className="block">
                    Decision reason
                    <textarea
                      className="mt-1 min-h-24 w-full rounded-lg border p-3"
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {(app.status === "APPROVED"
                      ? [["suspend", "Suspend rider"]]
                      : [
                          ["request-changes", "Request changes"],
                          ["reject", "Reject application"],
                        ]
                    ).map(([path, label]) => (
                      <CommandButton
                        key={path}
                        variant="secondary"
                        disabled={
                          busy ||
                          reason.trim().length < 2 ||
                          (app.status !== "SUBMITTED" &&
                            app.status !== "APPROVED")
                        }
                        onClick={() => action(`/${path}`, { reason })}
                      >
                        {label}
                      </CommandButton>
                    ))}
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )
      )}
      {preview && (
          <dialog ref={previewDialog} onCancel={()=>setPreview(null)}
            role="dialog"
            aria-modal="true"
            aria-label={preview.label}
            className="flex h-[85vh] w-[calc(100%-32px)] max-w-5xl flex-col rounded-xl bg-white p-4 backdrop:bg-slate-950/60"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPreview(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2>{preview.label}</h2>
              <CommandButton
                variant="secondary"
                onClick={() => setPreview(null)}
              >
                Close preview
              </CommandButton>
            </div>
            {preview.contentType === "application/pdf" ? (
              <iframe
                title={preview.label}
                referrerPolicy="no-referrer"
                className="min-h-0 flex-1"
                src={preview.url}
              />
            ) : (
              <img
                alt={preview.label}
                referrerPolicy="no-referrer"
                className="min-h-0 flex-1 object-contain"
                src={preview.url}
              />
            )}
          </dialog>
      )}
    </>
  );
}
