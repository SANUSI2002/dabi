import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JevNoteReview } from "./JevNoteReview";
const mocks = vi.hoisted(() => ({ request: vi.fn(), key: vi.fn(() => "synthetic-request-uuid") }));
vi.mock("@/emr-live/client", () => ({ emrRequest: mocks.request, newIdempotencyKey: mocks.key, describeEmrError: (e: Error) => e.message }));
vi.mock("@/emr-live/session", () => ({ useLiveEmr: (selector: (s: unknown) => unknown) => selector({ access: { organizationId: "synthetic-hospital" } }) }));
const props = { encounterId: "synthetic-visit", noteId: "synthetic-note", noteVersion: 1, unsavedChanges: false };
const path = "/ai/encounters/synthetic-visit/notes/synthetic-note/assessments";
const item = (extra = {}) => ({ id: "assessment-one", sourceRevision: 1, questionVersion: "medication-history-v1", resolvedModel: "jev-1.13.0", mode: "REVIEW_ONLY", processingStatus: "COMPLETED", clinicalActionApplied: false,
  answers: { medication_history: { type: "choice", choice: "unresolved", confidence: 0.9 } }, reviews: [], ...extra });
beforeEach(() => mocks.request.mockReset());

describe("JEV note review", () => {
  it("does not advertise actions for a hospital with no approved policy or history", async () => {
    mocks.request.mockResolvedValue({ data: { available: false, items: [] } });
    render(<JevNoteReview {...props} />);
    await waitFor(() => expect(screen.queryByText("Loading documentation review…")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Review saved note" })).not.toBeInTheDocument();
  });
  it("queues only a source version and request key, confirms submission and leaves care independent", async () => {
    let queued = false;
    mocks.request.mockImplementation(async (_path, options) => {
      if (options?.method === "POST") { queued = true; return { data: item({ processingStatus: "QUEUED", answers: null }) }; }
      return { data: { available: true, items: queued ? [item({ processingStatus: "QUEUED", answers: null })] : [] } };
    });
    render(<JevNoteReview {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Review saved note" }));
    await screen.findByText("Documentation review requested. You can continue working while it runs.");
    expect(mocks.request).toHaveBeenCalledWith(path, { method: "POST", body: { clientRequestId: "synthetic-request-uuid", noteVersion: 1 } });
    expect(screen.getByRole("button", { name: "Review in progress…" })).toBeDisabled();
  });
  it("records an explicitly reasoned disposition, not a note edit or prescription", async () => {
    mocks.request.mockResolvedValue({ data: { available: true, items: [item()] } });
    render(<JevNoteReview {...props} />);
    await screen.findByText(/a medicine name is missing/);
    expect(screen.getByRole("button", { name: "Record decision" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Confirm the medicine name with the patient." } });
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    await screen.findByText("Review decision recorded. The clinical note and prescriptions have not been changed.");
    const writes = mocks.request.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(writes).toEqual([["/ai/assessments/assessment-one/reviews", { method: "POST", body: { clientRequestId: "synthetic-request-uuid", disposition: "DEFERRED", reason: "Confirm the medicine name with the patient." } }]]);
  });
  it("hides findings and decisions when the editor has unsaved changes", async () => {
    mocks.request.mockResolvedValue({ data: { available: true, items: [item()] } });
    render(<JevNoteReview {...props} unsavedChanges />);
    await screen.findByText(/Save your draft first/);
    await waitFor(() => expect(screen.queryByText("Loading documentation review…")).not.toBeInTheDocument());
    expect(screen.queryByText(/a medicine name is missing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record decision" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review saved note" })).toBeDisabled();
  });
  it("shows provider failure as unavailable and never as a clinical all-clear", async () => {
    mocks.request.mockResolvedValue({ data: { available: true, items: [item({ processingStatus: "FAILED", answers: null })] } });
    render(<JevNoteReview {...props} />);
    await screen.findByText(/This is not a clinical all-clear/);
    expect(screen.queryByRole("button", { name: "Record decision" })).not.toBeInTheDocument();
  });
  it("drops a late response from the previous source", async () => {
    let finish!: (value: unknown) => void;
    mocks.request.mockImplementation((p) => p === path ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ data: { available: true, items: [] } }));
    const view = render(<JevNoteReview {...props} />);
    view.rerender(<JevNoteReview {...props} noteId="next-note" />);
    await screen.findByRole("button", { name: "Review saved note" });
    finish({ data: { available: true, items: [item()] } });
    await waitFor(() => expect(screen.queryByText(/a medicine name is missing/)).not.toBeInTheDocument());
  });
});
