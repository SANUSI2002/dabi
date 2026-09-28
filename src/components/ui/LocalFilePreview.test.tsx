import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalFilePreview } from "./LocalFilePreview";

const createObjectURL = vi.fn(() => "blob:synthetic-preview");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
});
afterEach(() => { createObjectURL.mockClear(); revokeObjectURL.mockClear(); });

describe("local-only document preview", () => {
  it("previews an image in the browser and releases its object URL", () => {
    const { unmount } = render(<LocalFilePreview label="Preview a clinical document" />);
    expect(screen.getByText(/not uploaded, attached to a record or retained/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Select preview a clinical document"), { target: { files: [new File(["synthetic"], "scan.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview scan.png" }));
    expect(screen.getByRole("img", { name: "scan.png" })).toHaveAttribute("src", "blob:synthetic-preview");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-preview");
  });

  it("rejects unsupported file types", () => {
    render(<LocalFilePreview label="Preview a study image or PDF" />);
    fireEvent.change(screen.getByLabelText("Select preview a study image or pdf"), { target: { files: [new File(["synthetic"], "test.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PDF, PNG, JPEG or WebP file.");
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
