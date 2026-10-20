import { useRef, useState, type FormEvent } from "react";
import { BookOpen, FileText, RefreshCw, Upload } from "lucide-react";
import { liveApiRequest, liveStepUpMfa } from "@/identity/liveIdentity";
import {
  CommandButton,
  CommandPageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "../components/ui";
import { ccGet, ccPost } from "./api";
import {
  ActionDialog,
  Empty,
  ErrorBox,
  Gate,
  Loading,
  useLoad,
  type ActionDialogProps,
} from "./kit";
type Metadata = {
  title: string;
  authors: string;
  edition: string;
  publicationDate: string | null;
  jurisdiction: string;
  language: string;
  specialty: string;
  audiences: string[];
  rightsBasis: string;
  rightsConfirmed: true;
  reviewBy: string;
  sourceType: string;
  sourceUrl: string | null;
};
type Document = {
  id: string;
  familyId: string;
  revision: number;
  version: number;
  metadata: Metadata;
  status: string;
  scanStatus: string;
  pageCount: number | null;
  errorCode: string | null;
  pages?: {
    id: string;
    pageNumber: number;
    pageLabel: string | null;
    quality: string;
  }[];
};
type Page = {
  id: string;
  pageNumber: number;
  pageLabel: string | null;
  text: string;
  quality: string;
};
const input =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";
export default function AiKnowledgePage() {
  return (
    <Gate any={["platform.settings.manage"]} what="AI Knowledge Base">
      <Knowledge />
    </Gate>
  );
}
function MetadataFields({ value }: { value?: Metadata }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["title", "Book / guideline title"],
          ["authors", "Authors / publisher"],
          ["edition", "Edition / version"],
          ["jurisdiction", "Jurisdiction"],
          ["language", "Language"],
          ["specialty", "Specialty"],
        ].map(([name, label]) => (
          <label key={name} className="grid gap-2 text-sm font-medium">
            {label}
            <input
              className={input}
              required
              name={name}
              maxLength={name === "authors" ? 300 : 240}
              defaultValue={
                (value?.[name as keyof Metadata] as string) ||
                (name === "language" ? "English" : "")
              }
            />
          </label>
        ))}
        <label className="grid gap-2 text-sm font-medium">
          Publication date (leave unknown blank)
          <input
            className={input}
            type="date"
            name="publicationDate"
            defaultValue={value?.publicationDate || ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Review / rights expiry date
          <input
            className={input}
            required
            type="date"
            name="reviewBy"
            defaultValue={value?.reviewBy || ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Source type
          <select
            className={input}
            name="sourceType"
            defaultValue={value?.sourceType || "BOOK"}
          >
            <option value="BOOK">Uploaded book</option>
            <option value="EXTERNAL_GUIDELINE">
              External publisher guideline
            </option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Publisher source URL (optional)
          <input
            className={input}
            type="url"
            name="sourceUrl"
            placeholder="https://…"
            defaultValue={value?.sourceUrl || ""}
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">
          Permitted answer audiences
        </legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {["PERSONAL", "PROFESSIONAL", "BUSINESS"].map((a) => (
            <label key={a} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-700"
                name="audiences"
                value={a}
                defaultChecked={
                  value ? value.audiences.includes(a) : a === "PROFESSIONAL"
                }
              />
              {a.toLowerCase()}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2 text-sm font-medium">
        Rights basis and permitted uses
        <textarea
          required
          name="rightsBasis"
          minLength={10}
          maxLength={1000}
          rows={3}
          className={input}
          defaultValue={value?.rightsBasis || ""}
          placeholder="Record the permission/licence, rights owner, AI indexing/processing rights and any audience restrictions."
        />
      </label>
    </>
  );
}
function Knowledge() {
  const [mfaCode, setMfaCode] = useState("");
  const pendingUpload = useRef<{ id: string; key: string } | null>(null);
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [uploadOpen, setUploadOpen] = useState(false),
    [editing, setEditing] = useState<Document | null>(null),
    [replacement, setReplacement] = useState<Document | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dialog, setDialog] = useState<ActionDialogProps | null>(null),
    [page, setPage] = useState<Page | null>(null);
  const catalogue = useLoad(
    () =>
      ccGet<{ items: Document[]; total: number; maxUploadBytes: number }>(
        `/ai/knowledge/documents?offset=${offset}`,
      ),
    [offset],
  );
  const maxUploadBytes = catalogue.data?.maxUploadBytes || 3500000;
  const detail = useLoad(
    () =>
      selected
        ? ccGet<Document>(`/ai/knowledge/documents/${selected}`)
        : Promise.resolve(null),
    [selected],
  );
  const refresh = () => {
    catalogue.reload();
    detail.reload();
  };
  async function verifyAccess(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await liveStepUpMfa(mfaCode.trim(), mfaCode.trim().length > 8);
      setMfaCode("");
      refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Verification could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const audiences = data.getAll("audiences").map(String);
    if (!audiences.length) {
      setError("Choose at least one permitted audience.");
      return;
    }
    const metadata = Object.fromEntries(
      [
        "title",
        "authors",
        "edition",
        "jurisdiction",
        "language",
        "specialty",
        "rightsBasis",
        "reviewBy",
        "sourceType",
      ].map((k) => [k, String(data.get(k) || "").trim()]),
    );
    const fields = {
      ...metadata,
      publicationDate: String(data.get("publicationDate") || "") || null,
      sourceUrl: String(data.get("sourceUrl") || "") || null,
      audiences,
      rightsConfirmed: true,
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing) {
        await ccPost(`/ai/knowledge/documents/${editing.id}/metadata`, {
          expectedVersion: editing.version,
          reason: data.get("reason"),
          metadata: fields,
        });
        setNotice("Draft metadata updated. Approval has been reset.");
      } else {
        const file = data.get("file");
        if (!(file instanceof File) || !file.size || file.size > maxUploadBytes)
          throw new Error(
            `Select a PDF up to ${(maxUploadBytes / 1000000).toFixed(1)} MB, matching the configured scanner limit.`,
          );
        const bytes = await file.arrayBuffer();
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        const sha256 = Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const uploadKey = JSON.stringify({
          sha256,
          fields,
          replaces: replacement?.id,
        });
        if (pendingUpload.current?.key !== uploadKey)
          pendingUpload.current = { id: crypto.randomUUID(), key: uploadKey };
        setNotice("Creating your private upload…");
        const created = await ccPost<{ id: string }>(
          "/ai/knowledge/documents",
          {
            id: pendingUpload.current.id,
            metadata: fields,
            byteSize: file.size,
            sha256,
            reason: data.get("reason"),
            scanDisclosureAccepted: true,
            ...(replacement ? { replacesId: replacement.id } : {}),
          },
        );
        setNotice(
          "Uploading PDF. Screening and indexing will run in the background…",
        );
        await liveApiRequest(
          `/api/v1/command-centre/ai/knowledge/documents/${created.id}/file`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: bytes,
          },
        );
        pendingUpload.current = null;
        setSelected(created.id);
        setNotice(
          "Document received. Background malware screening and extraction are queued. It will not be used in answers until reviewed and published.",
        );
      }
      setUploadOpen(false);
      setEditing(null);
      setReplacement(null);
      refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Upload could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function action(doc: Document, action: string) {
    setDialog({
      title: `${action[0].toUpperCase() + action.slice(1)} knowledge version?`,
      description: `${doc.metadata.title} · ${doc.metadata.edition} · version ${doc.revision}. ${action === "retire" ? "This immediately excludes it from new answers and hides historical answers whose references are no longer available. The private original is retained for audit; no public file URL exists." : action === "approve" ? "A second Sabi administrator must approve the reviewed extraction and rights. Approval and publication are separate." : ""}`,
      confirm: `${action[0].toUpperCase() + action.slice(1)} version`,
      run: (values) =>
        ccPost(`/ai/knowledge/documents/${doc.id}/${action}`, {
          expectedVersion: doc.version,
          reason: values.reason,
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        setPage(null);
        refresh();
      },
    });
  }
  function preview(doc: Document) {
    setDialog({
      title: "Open private source preview?",
      description:
        "Only authorised Sabi administrators can view this source. The preview link expires after 60 seconds. Do not share it.",
      confirm: "Open preview",
      run: (values) =>
        ccPost(`/ai/knowledge/documents/${doc.id}/preview`, {
          reason: values.reason,
        }),
      onClose: () => setDialog(null),
      onDone: (result) => {
        const url = new URL((result as { url: string }).url);
        if (url.protocol === "https:")
          window.open(url.toString(), "_blank", "noopener,noreferrer");
        setDialog(null);
      },
    });
  }
  async function loadPage(doc: Document, n: number) {
    setBusy(true);
    setError("");
    try {
      setPage(
        await ccGet<Page>(`/ai/knowledge/documents/${doc.id}/pages/${n}`),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Page unavailable.");
    } finally {
      setBusy(false);
    }
  }
  function reviewPage(doc: Document, quality: string) {
    if (!page) return;
    setDialog({
      title:
        quality === "APPROVED"
          ? "Approve this page extraction?"
          : "Exclude this page from retrieval?",
      description:
        "Check the source page, headings, units, decimal points, population restrictions and table layout. Correct unreadable extraction before approval. Scanned pages require transcribed/OCR-reviewed text; an empty page cannot be approved.",
      confirm: "Record page review",
      run: (values) =>
        ccPost(`/ai/knowledge/documents/${doc.id}/page-review`, {
          expectedVersion: doc.version,
          pageNumber: page.pageNumber,
          text: page.text,
          pageLabel: page.pageLabel,
          quality,
          reason: values.reason,
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        setPage(null);
        refresh();
      },
    });
  }
  return (
    <>
      <CommandPageHeader
        eyebrow="Sabi AI · private administration"
        title="AI Knowledge Base"
        description="A carefully governed reference library. Sources support answers behind the scenes; users never see this catalogue, the books or upload controls."
        actions={
          <CommandButton
            onClick={() => {
              setEditing(null);
              setReplacement(null);
              setUploadOpen(true);
            }}
          >
            <Upload size={16} aria-hidden="true" />
            Add document
          </CommandButton>
        }
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
        >
          {notice}
        </p>
      )}
      {uploadOpen && (
        <Panel className="mb-5">
          <PanelHeader
            title={
              editing
                ? "Edit draft metadata"
                : replacement
                  ? "Upload a replacement edition"
                  : "Add an approved-rights source"
            }
          />
          <form
            key={editing?.id || replacement?.id || "new"}
            onSubmit={upload}
            className="grid gap-5 p-5"
          >
            <MetadataFields
              value={editing?.metadata || replacement?.metadata}
            />
            {!editing && (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  Source PDF · up to {(maxUploadBytes / 1000000).toFixed(1)} MB
                  <input
                    className={`${input} py-3`}
                    name="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                  />
                </label>
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
                  />
                  <span>
                    I authorise private storage and Cloudmersive malware
                    screening of this file. I confirm Sabi has permission for
                    indexing and AI processing. No patient records belong in
                    this shared library.
                  </span>
                </label>
              </>
            )}
            <label className="grid gap-2 text-sm font-medium">
              Audit reason
              <input
                className={input}
                name="reason"
                required
                minLength={5}
                maxLength={500}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <CommandButton disabled={busy} type="submit" className="min-h-11">
                {busy
                  ? "Working…"
                  : editing
                    ? "Save draft metadata"
                    : "Upload document"}
              </CommandButton>
              <CommandButton
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </CommandButton>
            </div>
          </form>
        </Panel>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.65fr)]">
        <Panel>
          <PanelHeader
            title="Document catalogue"
            action={
              <CommandButton
                variant="secondary"
                aria-label="Refresh catalogue"
                onClick={refresh}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </CommandButton>
            }
          />
          {catalogue.loading ? (
            <Loading />
          ) : catalogue.error ? (
            catalogue.error.code === "MFA_REQUIRED" ? (
              <form onSubmit={verifyAccess} className="grid gap-4 p-5">
                <p className="text-sm leading-6">
                  Confirm recent multi-factor verification to open this private
                  library.
                </p>
                <label className="grid gap-2 text-sm">
                  Authenticator or recovery code
                  <input
                    className={input}
                    autoComplete="one-time-code"
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                  />
                </label>
                <CommandButton
                  type="submit"
                  disabled={busy || !mfaCode.trim()}
                  className="min-h-11"
                >
                  Verify access
                </CommandButton>
              </form>
            ) : (
              <ErrorBox error={catalogue.error} retry={catalogue.reload} />
            )
          ) : !catalogue.data?.items.length ? (
            <Empty
              title="Your reference library starts here"
              hint="Upload a rights-cleared PDF. Screening, extraction, review, approval and publication are tracked separately."
            />
          ) : (
            <div className="divide-y">
              {catalogue.data.items.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelected(doc.id);
                    setPage(null);
                  }}
                  className={`flex w-full gap-3 p-5 text-left transition hover:bg-emerald-50 focus-visible:outline-emerald-700 ${selected === doc.id ? "bg-emerald-50" : ""}`}
                >
                  <BookOpen
                    className="mt-1 shrink-0 text-emerald-700"
                    size={20}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold">
                      {doc.metadata.title}
                    </h2>
                    <p className="my-2 text-xs leading-5 text-slate-600">
                      {doc.metadata.edition} · version {doc.revision} ·{" "}
                      {doc.pageCount ?? "—"} pages
                    </p>
                    <StatusPill status={doc.status} />
                    <span className="ml-2 text-xs text-slate-600">
                      Scan: {doc.scanStatus.toLowerCase()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between p-4">
            <CommandButton
              variant="secondary"
              disabled={!offset}
              onClick={() => setOffset((x) => Math.max(0, x - 25))}
            >
              Previous
            </CommandButton>
            <CommandButton
              variant="secondary"
              disabled={offset + 25 >= (catalogue.data?.total || 0)}
              onClick={() => setOffset((x) => x + 25)}
            >
              Next
            </CommandButton>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Source review & version history" />
          {!selected ? (
            <Empty
              title="Select a document to review"
              hint="Only clean files can be previewed. Review extraction page by page before approving a source."
            />
          ) : detail.loading ? (
            <Loading />
          ) : detail.error ? (
            <ErrorBox error={detail.error} retry={detail.reload} />
          ) : (
            detail.data && (
              <div className="space-y-5 p-5">
                <h2 className="text-xl font-semibold">
                  {detail.data.metadata.title}
                </h2>
                <p className="text-sm leading-7 text-slate-600">
                  {detail.data.metadata.authors} ·{" "}
                  {detail.data.metadata.edition} ·{" "}
                  {detail.data.metadata.jurisdiction}
                  <br />
                  Review by {detail.data.metadata.reviewBy} · permitted for{" "}
                  {detail.data.metadata.audiences.join(", ").toLowerCase()}
                  <br />
                  Version {detail.data.revision} ·{" "}
                  {detail.data.status.toLowerCase()} · malware screening{" "}
                  {detail.data.scanStatus.toLowerCase()}
                </p>
                <p className="text-sm leading-6">
                  <strong>Rights:</strong> {detail.data.metadata.rightsBasis}
                </p>
                {detail.data.errorCode && (
                  <p role="alert" className="text-sm text-amber-800">
                    {detail.data.errorCode}. This version is not available for
                    retrieval. Check scanner/storage, then retry processing or
                    replace the file.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <CommandButton
                    variant="secondary"
                    className="min-h-11"
                    disabled={
                      detail.data.scanStatus !== "CLEAN" ||
                      detail.data.status === "RETIRED"
                    }
                    onClick={() => preview(detail.data!)}
                  >
                    <FileText size={16} aria-hidden="true" />
                    Preview source
                  </CommandButton>
                  {["REVIEW_REQUIRED", "APPROVED"].includes(
                    detail.data.status,
                  ) && (
                    <CommandButton
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => {
                        setEditing(detail.data);
                        setReplacement(null);
                        setUploadOpen(true);
                      }}
                    >
                      Edit metadata
                    </CommandButton>
                  )}
                  <CommandButton
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => {
                      setReplacement(detail.data);
                      setEditing(null);
                      setUploadOpen(true);
                    }}
                  >
                    New edition
                  </CommandButton>
                  {detail.data.status === "REVIEW_REQUIRED" && (
                    <CommandButton
                      className="min-h-11"
                      onClick={() => action(detail.data!, "approve")}
                    >
                      Approve source
                    </CommandButton>
                  )}
                  {detail.data.status === "APPROVED" && (
                    <CommandButton
                      className="min-h-11"
                      onClick={() => action(detail.data!, "publish")}
                    >
                      Publish version
                    </CommandButton>
                  )}
                  {detail.data.status === "FAILED" && (
                    <CommandButton
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => action(detail.data!, "retry")}
                    >
                      Retry processing
                    </CommandButton>
                  )}
                  {detail.data.status !== "RETIRED" && (
                    <CommandButton
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => action(detail.data!, "retire")}
                    >
                      Remove from use
                    </CommandButton>
                  )}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    Extraction pages
                  </h3>
                  <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                    {detail.data.pages?.map((p) => (
                      <button
                        disabled={busy || detail.data?.scanStatus !== "CLEAN"}
                        key={p.id}
                        className="min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50"
                        onClick={() => loadPage(detail.data!, p.pageNumber)}
                      >
                        {p.pageLabel
                          ? `Page ${p.pageLabel}`
                          : `PDF ${p.pageNumber}`}{" "}
                        · {p.quality.toLowerCase().replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                {page && (
                  <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold">
                      Physical PDF page {page.pageNumber} ·{" "}
                      {page.quality.toLowerCase()}
                    </p>
                    <label className="grid gap-2 text-sm">
                      Verified printed page label (optional)
                      <input
                        className={input}
                        value={page.pageLabel || ""}
                        onChange={(e) =>
                          setPage({
                            ...page,
                            pageLabel: e.target.value || null,
                          })
                        }
                        maxLength={40}
                        disabled={
                          !["REVIEW_REQUIRED", "APPROVED"].includes(
                            detail.data!.status,
                          )
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      Extracted text · correct errors against the source
                      <textarea
                        rows={12}
                        maxLength={30000}
                        className={`${input} font-mono text-sm leading-6`}
                        value={page.text}
                        onChange={(e) =>
                          setPage({ ...page, text: e.target.value })
                        }
                        disabled={
                          !["REVIEW_REQUIRED", "APPROVED"].includes(
                            detail.data!.status,
                          )
                        }
                      />
                    </label>
                    {["REVIEW_REQUIRED", "APPROVED"].includes(
                      detail.data.status,
                    ) && (
                      <div className="flex flex-wrap gap-2">
                        <CommandButton
                          className="min-h-11"
                          onClick={() => reviewPage(detail.data!, "APPROVED")}
                        >
                          Approve page
                        </CommandButton>
                        <CommandButton
                          variant="secondary"
                          className="min-h-11"
                          onClick={() => reviewPage(detail.data!, "EXCLUDED")}
                        >
                          Exclude page
                        </CommandButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </Panel>
      </div>
      {dialog && <ActionDialog {...dialog} />}
    </>
  );
}
