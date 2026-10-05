import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CredentialUpload from "../../apps/telemedicine/packages/doctor-portal/src/pages/auth/CredentialUpload.jsx";

afterEach(cleanup);
const pdf = (name = "licence.pdf", size = 100) => new File([new Uint8Array(size)], name, { type: "application/pdf" });
function harness(extra = {}) {
  const upload = vi.fn(), selected = vi.fn();
  function Form() {
    const [files, setFiles] = useState({});
    return ["licence", "registrationCertificate"].map((kind) => <CredentialUpload key={kind} kind={kind} label={kind} file={files[kind]} maxBytes={3500000} busy="" {...extra}
      onSelect={(key, file) => { selected(key, file); setFiles((current) => ({ ...current, [key]: file })); }} onUpload={upload} />);
  }
  render(<Form />);
  return { upload, selected, input: (kind) => document.getElementById(kind), buttons: () => screen.getAllByRole("button") };
}
describe("doctor credential file selection", () => {
  it("passes a stable File even when clearing the native input empties its FileList", () => {
    const form = harness(), file = pdf();
    const input = form.input("licence");
    let nativeFiles = [file];
    Object.defineProperty(input, "files", { configurable: true, get: () => nativeFiles });
    Object.defineProperty(input, "value", { configurable: true, get: () => "", set: () => { nativeFiles = []; } });
    fireEvent.change(input);
    expect(input.files).toEqual([]);
    expect(form.selected).toHaveBeenCalledWith("licence", file);
    expect(form.buttons()[0]).toBeEnabled();
    expect(screen.getByText(/licence.pdf.*Ready to upload/)).toBeInTheDocument();
  });
  it("captures each File before clearing the picker, enabling both upload buttons", () => {
    const form = harness(), licence = pdf(), certificate = pdf("certificate.pdf");
    expect(form.buttons()[0]).toBeDisabled();
    fireEvent.change(form.input("licence"), { target: { files: [licence] } });
    fireEvent.change(form.input("registrationCertificate"), { target: { files: [certificate] } });
    expect(form.selected).toHaveBeenNthCalledWith(1, "licence", licence);
    expect(form.selected).toHaveBeenNthCalledWith(2, "registrationCertificate", certificate);
    expect(form.input("licence").value).toBe("");
    expect(screen.getByText(/licence.pdf.*Ready to upload/)).toBeInTheDocument();
    for (const button of form.buttons()) { expect(button).toBeEnabled(); fireEvent.click(button); }
    expect(form.upload.mock.calls).toEqual([["licence"], ["registrationCertificate"]]);
  });
  it("retains the selected file when the user cancels the picker and allows reselection", () => {
    const form = harness(), file = pdf();
    fireEvent.change(form.input("licence"), { target: { files: [file] } });
    fireEvent.change(form.input("licence"), { target: { files: [] } });
    expect(form.buttons()[0]).toBeEnabled(); expect(form.selected).toHaveBeenCalledTimes(1);
    fireEvent.change(form.input("licence"), { target: { files: [file] } });
    expect(form.selected).toHaveBeenCalledTimes(2);
  });
  it("shows invalid format, empty and oversized errors immediately and permits correction", () => {
    const form = harness();
    for (const file of [new File(["x"], "bad.html", { type: "text/html" }), pdf("empty.pdf", 0), pdf("large.pdf", 3500001)]) {
      fireEvent.change(form.input("licence"), { target: { files: [file] } });
      expect(screen.getByRole("alert")).toBeInTheDocument(); expect(form.buttons()[0]).toBeDisabled();
    }
    fireEvent.change(form.input("licence"), { target: { files: [pdf()] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(form.buttons()[0]).toBeEnabled();
  });
  it("prevents repeated clicks during upload and shows explicit progress", () => {
    const form = harness({ busy: "licence" });
    expect(form.input("licence")).toBeDisabled(); expect(form.input("registrationCertificate")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    expect(screen.getByText(/Sending your document to private storage/)).toBeInTheDocument(); expect(form.upload).not.toHaveBeenCalled();
  });
  it("offers a replacement without implying that file selection has uploaded it", () => {
    const form = harness({ document: { scanStatus: "CLEAN", reviewStatus: "REJECTED", note: "Use a current licence." } });
    fireEvent.change(form.input("licence"), { target: { files: [pdf("replacement.pdf")] } });
    expect(screen.getAllByRole("button", { name: "Upload replacement" })[0]).toBeEnabled();
    expect(form.upload).not.toHaveBeenCalled();
  });
});
