import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTACT_LINES, telUrl, whatsappUrl } from "./contact";
import { ContactEmails, ContactLines, FloatingWhatsApp } from "./ui";

describe("public contact lines", () => {
  it("builds international call and WhatsApp links for both numbers", () => {
    expect(CONTACT_LINES.map(telUrl)).toEqual(["tel:+2349032213671", "tel:+2347089085813"]);
    expect(whatsappUrl(CONTACT_LINES[1], "Hi there")).toBe("https://wa.me/2347089085813?text=Hi%20there");
  });

  it("lists a call link and a WhatsApp link for each line", () => {
    render(<ContactLines />);
    expect(screen.getByRole("link", { name: "0903 221 3671" })).toHaveAttribute("href", "tel:+2349032213671");
    expect(screen.getAllByRole("link", { name: "WhatsApp" }).map((link) => link.getAttribute("href")?.split("?")[0])).toEqual(["https://wa.me/2349032213671", "https://wa.me/2347089085813"]);
  });
});

describe("public contact emails", () => {
  it.each([false, true])("shows both labelled mailto links on light=%s surfaces", (light) => {
    render(<ContactEmails light={light} />);
    expect(screen.getByRole("link", { name: "Support support@sabihealth.org" })).toHaveAttribute("href", "mailto:support@sabihealth.org");
    expect(screen.getByRole("link", { name: "General enquiries info@sabihealth.org" })).toHaveAttribute("href", "mailto:info@sabihealth.org");
  });
});

describe("floating WhatsApp button", () => {
  it("opens a panel with both lines and closes on Escape", () => {
    render(<FloatingWhatsApp />);
    const toggle = screen.getByRole("button", { name: "Chat with us on WhatsApp" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    const panel = screen.getByRole("dialog", { name: "Chat with Sabi Health on WhatsApp" });
    const links = panel.querySelectorAll("a");
    expect(links).toHaveLength(2);
    links.forEach((link) => { expect(link).toHaveAttribute("target", "_blank"); expect(link).toHaveAttribute("rel", "noopener noreferrer"); });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });
});
