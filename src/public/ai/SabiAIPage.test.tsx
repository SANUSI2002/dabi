import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", () => ({ apiBaseUrl: "https://api.sabi.test", apiConfigured: true }));

const { default: SabiAIPage } = await import("./SabiAIPage");
const { default: HomePage } = await import("@/public/pages/HomePage");

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const page = () => render(<MemoryRouter initialEntries={["/ai"]}><SabiAIPage /></MemoryRouter>);

describe("Sabi AI landing page", () => {
  it("leads with the brief's headline and links to every section", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: "Made for the way you care." })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Sabi AI" });
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#top", "#professionals", "#everyday-health", "#how-it-works", "#faqs", "/access", "#waitlist"]);
    for (const heading of ["More clarity for the work that matters.", "Understand more. Feel better prepared.", "Ask. Share. Explore.", "Meet Sabi where you need it.", "Bring more clarity to healthcare."]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    for (const id of ["professionals", "everyday-health", "how-it-works", "faqs", "waitlist"]) expect(document.getElementById(id)).not.toBeNull();
  });

  it("labels every conversation as a sample and switches prompts", async () => {
    page();
    expect(screen.getByText("Sample · fictional details")).toBeInTheDocument();
    expect(screen.getByText("Preview · sample data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Summarise this patient history for review." }));
    expect(await screen.findByText(/Please check this against the source record/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it("adds suggested follow-ups to the sample thread, and never presents uploads as working", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "What questions should I ask my doctor?" }));
    expect(screen.getByText("When should this test be repeated?")).toBeInTheDocument();
    expect(screen.getByLabelText("Attach a document (available when Sabi AI opens)").tagName).not.toBe("BUTTON");
  });

  it("states availability honestly and keeps the professional boundary", () => {
    page();
    expect(screen.getAllByText("Planned")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /Sabi supports understanding and clinical work. It does not replace professional judgment or emergency services./ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See pilot areas" })).toHaveAttribute("href", "/ai/organisations");
    const text = document.body.textContent ?? "";
    for (const banned of ["Standing Orders", "EMDEX", "Gemini", "Google", "revolutionis", "cutting-edge", "AI doctor"]) expect(text).not.toContain(banned);
  });

  it("answers the six FAQs", () => {
    page();
    for (const q of ["What is Sabi AI?", "Who can use Sabi?", "How can Sabi support healthcare professionals?", "Can Sabi help me understand a medical report?", "Where can I use Sabi?", "Does Sabi replace a healthcare professional?"]) {
      expect(screen.getByRole("button", { name: q })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Does Sabi replace a healthcare professional?" }));
    expect(screen.getByText(/In an emergency, call your local emergency number/, { selector: "#faqs p" })).toBeInTheDocument();
  });

  it("joins the waitlist with contact details only", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { joined: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    page();
    const form = document.querySelector("#waitlist form") as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "clinician@waitlist.test" } });
    fireEvent.change(within(form).getByLabelText("I am a…"), { target: { value: "CAREGIVER" } });
    fireEvent.click(within(form).getByRole("checkbox"));
    fireEvent.submit(form);
    expect(await screen.findByText("You're on the list.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://api.sabi.test/api/v1/waitlist", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ product: "sabi-ai", consent: true, email: "clinician@waitlist.test", role: "CAREGIVER", source: "ai-waitlist-section" });
  });

  it("explains a failed sign-up", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    page();
    const form = document.querySelector("#waitlist form") as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "clinician@waitlist.test" } });
    fireEvent.click(within(form).getByRole("checkbox"));
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("alert")).toHaveTextContent("Too many attempts"));
  });
});

describe("home page products", () => {
  it("shows Sabi AI as the third product beside Sabi EMR and Sabi Health", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const section = screen.getByRole("heading", { name: "Bring your practice onto Sabi." }).closest("section") as HTMLElement;
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Every department, one patient chart.", "Practise online, once you're verified.", "AI built for healthcare."]);
    expect(within(section).getByRole("link", { name: /Explore Sabi AI/ })).toHaveAttribute("href", "/ai");
    expect(within(section).getByRole("link", { name: "Join the waitlist" })).toHaveAttribute("href", "/ai#waitlist");
    expect(screen.getByRole("link", { name: /Meet Sabi AI, built for healthcare/ })).toHaveAttribute("href", "/ai");
  });
});
