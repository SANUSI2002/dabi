import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CredentialUpload from "../../apps/telemedicine/packages/doctor-portal/src/pages/auth/CredentialUpload.jsx";
afterEach(cleanup);
const pdf = (name = "licence.pdf", size = 100) => new File([new Uint8Array(size)], name, { type: "application/pdf" });
function harness(extra = {}) {
  const upload = vi.fn();
  function Form() {
    const [files, setFiles] = useState({});
    return ["licence", "registrationCertificate"].map((kind) => <CredentialUpload key={kind} kind={kind} label={kind} file={files[kind]} maxBytes={3500000} busy="" {...extra}
      onSelect={(key, file) => { setFiles((current) => ({ ...current, [key]: file })); upload(key, file); }} onRetry={upload} />);
  }
  render(<Form />);
  return { upload, input: (kind) => document.getElementById(kind) };
}
describe("automatic doctor credential selection", () => {
  it("passes a stable File before clearing the native FileList, with no second upload button", () => {
    const form = harness(), file = pdf(), input = form.input("licence");
    let nativeFiles = [file];
    Object.defineProperty(input, "files", { configurable: true, get: () => nativeFiles });
    Object.defineProperty(input, "value", { configurable: true, get: () => "", set: () => { nativeFiles = []; } });
    fireEvent.change(input);
    expect(input.files).toEqual([]); expect(form.upload).toHaveBeenCalledWith("licence", file);
    expect(screen.queryByRole("button", { name: /Upload privately|Upload replacement/ })).not.toBeInTheDocument();
  });
  it("handles each document once and does nothing when the picker is cancelled", () => {
    const form = harness();
    fireEvent.change(form.input("licence"), { target: { files: [pdf()] } });
    fireEvent.change(form.input("registrationCertificate"), { target: { files: [pdf("certificate.pdf")] } });
    fireEvent.change(form.input("licence"), { target: { files: [] } });
    expect(form.upload).toHaveBeenCalledTimes(2); expect(screen.getByText(/certificate.pdf/)).toBeInTheDocument();
  });
  it("shows local validation errors and automatic upload progress", () => {
    const form = harness();
    fireEvent.change(form.input("licence"), { target: { files: [pdf("large.pdf", 3500001)] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/3.5 MB/);
    cleanup(); harness({ busy: "licence" });
    expect(screen.getByText(/Uploading your document/)).toBeInTheDocument(); expect(document.getElementById("licence")).toBeDisabled();
  });
  it("shows uploaded documents as background processing rather than approval errors", () => {
    harness({ document: { scanStatus: "PENDING", reviewStatus: "PENDING" } });
    expect(screen.getAllByText("Document uploaded")).toHaveLength(2);
    expect(screen.getAllByText(/Security check in progress automatically/)).toHaveLength(2);
  });
});
