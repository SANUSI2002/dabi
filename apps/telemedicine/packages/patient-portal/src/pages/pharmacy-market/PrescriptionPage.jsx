import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, UploadCloud, FileText, ScanLine, CheckCircle2, Pill,
  Stethoscope, CalendarDays, ShieldCheck, Hourglass, RefreshCw,
  ClipboardList, UserRound, MessageCircleQuestion, ArrowRight, ShoppingBag, Trash2,
} from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";
import "../prescriptions/Prescriptions.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { SAMPLE_EXTRACTIONS, PRESCRIPTIONS_ON_FILE } from "./marketFlowsData";
import { addPrescriptionFromExtraction, removeUploadedPrescription } from "../prescriptions/prescriptionStore";

const SCAN_STAGES = [
  "Reading document…",
  "Detecting medication text…",
  "Matching against drug database…",
  "Verifying prescriber & dosage…",
];

const ACTIVE_ON_FILE = PRESCRIPTIONS_ON_FILE.filter((r) => r.status === "Active");

export function PrescriptionPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [onFileChoice, setOnFileChoice] = useState("");
  const [createdDetail, setCreatedDetail] = useState(null);
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  // Demo-only: walks through a sample extraction so the rest of this page
  // (confirm, send to pharmacy) can be tried without a real document.
  // Clearly offered as a "sample," never triggered by a real upload.
  const runSampleScan = () => {
    setScanning(true);
    setScanIndex(0);
    SCAN_STAGES.forEach((_, i) => window.setTimeout(() => setScanIndex(i), i * 500));
    window.setTimeout(() => {
      const pick = SAMPLE_EXTRACTIONS[Math.floor(Math.random() * SAMPLE_EXTRACTIONS.length)];
      setResult(pick);
      setScanning(false);
    }, SCAN_STAGES.length * 500 + 350);
  };

  // A real uploaded file is never read here — there is no OCR/extraction
  // backend connected yet (BACKEND REQUIRED). Rather than fabricate a
  // result from it, this just tells the patient what their real options
  // are: choose a prescription already on file, or request one from
  // their doctor — both further down this same page.
  const handleRealUpload = () => {
    notify("We've received your file. Automatic reading isn't available yet — choose a prescription on file below, or request one from your doctor.");
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) handleRealUpload();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleRealUpload();
  };

  const handleOnFileChange = (e) => {
    const recordId = e.target.value;
    setOnFileChoice(recordId);
    if (!recordId) {
      setResult(null);
      return;
    }
    const record = ACTIVE_ON_FILE.find((r) => r.id === recordId);
    if (record) setResult(SAMPLE_EXTRACTIONS[record.extraction]);
  };

  const requestFromDoctor = () => {
    notify("Digital request sent to your primary care physician — we'll notify you once approved.");
  };

  const confirmAndContinue = () => {
    if (!result) return;
    const detail = addPrescriptionFromExtraction(result);
    setCreatedDetail(detail);
    notify(`${result.drug} added to your prescriptions`);
  };

  const removeCreatedPrescription = () => {
    if (!createdDetail) return;
    removeUploadedPrescription(createdDetail.id);
    setCreatedDetail(null);
    setResult(null);
    setOnFileChoice("");
    notify("Prescription removed");
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main">
        <Topbar placeholder="Search medications..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
          <ArrowLeft size={18} /> Back to Marketplace
        </button>

        <div className="sabi-fam-header" style={{ marginTop: 12 }}>
          <div>
            <h1 style={{ color: "var(--sabi-primary-dark)", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px" }}>
              Prescription
            </h1>
            <p style={{ margin: 0, color: "var(--sabi-text-secondary)", maxWidth: 640 }}>
              Got a prescription from a doctor visit? Choose one already on file or request one from your doctor,
              then send it straight to pharmacies for quotes, the same way any other prescription works here.
            </p>
          </div>
        </div>

        {createdDetail ? (
          <div className="sabi-card" style={{ maxWidth: 640 }}>
            <div className="sabi-upload-result-banner" style={{ marginBottom: 16 }}>
              <CheckCircle2 size={16} /> {createdDetail.name} added to your prescriptions
            </div>
            <p style={{ color: "var(--sabi-text-secondary)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Your prescription is ready. Review it, send it to a pharmacy, or upload another document.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/prescriptions/${createdDetail.id}`)}>
                View Prescription <ArrowRight size={15} />
              </button>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/prescriptions/${createdDetail.id}/select-pharmacy`)}>
                <ShoppingBag size={15} /> Buy Now
              </button>
              <button type="button" className="sabi-btn-outline" onClick={removeCreatedPrescription}>
                <Trash2 size={15} /> Remove
              </button>
              <button type="button" className="sabi-btn-outline" onClick={() => { setCreatedDetail(null); setResult(null); setOnFileChoice(""); }}>
                Upload Another
              </button>
            </div>
          </div>
        ) : (
          <div className="sabi-cart-layout">
            <div>
              <div className="sabi-card" style={{ marginBottom: 16 }}>
                <div className="sabi-fam-dep-section-title"><UploadCloud size={16} /> Upload New Prescription</div>
                <p style={{ margin: "0 0 12px", color: "var(--sabi-text-secondary)", fontSize: "0.86rem" }}>
                  Upload a clear photo or PDF of the prescription your doctor wrote you.
                </p>

                {!scanning && !result && (
                  <label className="sabi-upload-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                    <UploadCloud size={30} />
                    <strong>Drag and drop file here</strong>
                    <span>Supports JPG, PNG, PDF (Max 10MB)</span>
                    <button type="button" onClick={() => inputRef.current?.click()}>Select File</button>
                    <input ref={inputRef} type="file" accept="image/*,.pdf" hidden onChange={handleFileInput} />
                  </label>
                )}

                {scanning && (
                  <div className="sabi-upload-scanning">
                    <div className="sabi-upload-scan-icon"><ScanLine size={30} className="sabi-scan-pulse" /></div>
                    <strong>Scanning your prescription…</strong>
                    <ul className="sabi-upload-stages">
                      {SCAN_STAGES.map((label, i) => (
                        <li key={label} className={i < scanIndex ? "done" : i === scanIndex ? "active" : ""}>
                          {i < scanIndex ? <CheckCircle2 size={14} /> : <span className="sabi-upload-dot" />}
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!scanning && !result && (
                  <button type="button" className="sabi-upload-sample" onClick={runSampleScan}>
                    <FileText size={15} /> Try it with a sample prescription
                  </button>
                )}
              </div>

              <div className="sabi-card" style={{ marginBottom: 16 }}>
                <div className="sabi-fam-dep-section-title"><ClipboardList size={16} /> Choose record from prescription on file</div>
                <p style={{ margin: "0 0 12px", color: "var(--sabi-text-secondary)", fontSize: "0.86rem" }}>
                  Select from prescriptions already on file with Sabi Health. Expired prescriptions aren't shown.
                </p>
                <select
                  className="sabi-fam-field"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--sabi-border)", borderRadius: "var(--sabi-radius-sm)", fontSize: "0.86rem" }}
                  value={onFileChoice}
                  onChange={handleOnFileChange}
                >
                  <option value="">
                    {ACTIVE_ON_FILE.length ? "Select a prescription on file…" : "No active prescriptions on file"}
                  </option>
                  {ACTIVE_ON_FILE.map((rec) => (
                    <option key={rec.id} value={rec.id}>
                      {rec.label} · Dated {rec.dated} · ID {rec.refId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sabi-card">
                <div className="sabi-fam-dep-section-title"><UserRound size={16} /> Request from Doctor</div>
                <p style={{ margin: "0 0 12px", color: "var(--sabi-text-secondary)", fontSize: "0.86rem" }}>
                  We'll send a digital request to your primary care physician for authorization.
                </p>
                <button type="button" className="sabi-btn-primary" onClick={requestFromDoctor}>
                  <Stethoscope size={15} /> Send Digital Request
                </button>
              </div>
            </div>

            <div className="sabi-cart-summary">
              <h3>Detected Medication</h3>
              {result ? (
                <>
                  <div className="sabi-upload-drug-card" style={{ marginBottom: 12 }}>
                    <div className="sabi-upload-drug-icon"><Pill size={20} /></div>
                    <div>
                      <span className="sabi-upload-drug-label">Medication</span>
                      <strong>{result.drug}</strong>
                      <span className="sabi-upload-drug-form">{result.form}</span>
                    </div>
                  </div>
                  <div className="sabi-cart-summary-row"><span><Stethoscope size={13} style={{ verticalAlign: "-2px" }} /> Prescribed by</span><span>{result.prescribedBy}</span></div>
                  <div className="sabi-cart-summary-row"><span><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> Issue date</span><span>{result.issueDate}</span></div>
                  <div className="sabi-cart-summary-row"><span><Hourglass size={13} style={{ verticalAlign: "-2px" }} /> Expires</span><span>{result.expiration}</span></div>
                  <div className="sabi-cart-summary-row total"><span>Est. Price</span><span>{formatNaira(result.price)}</span></div>

                  <button type="button" className="sabi-btn-primary sabi-btn-block" style={{ marginTop: 12 }} onClick={confirmAndContinue}>
                    <CheckCircle2 size={15} /> Confirm &amp; Continue
                  </button>
                  <button type="button" className="sabi-btn-ghost" style={{ display: "block", margin: "10px auto 0" }} onClick={() => { setResult(null); setOnFileChoice(""); }}>
                    <RefreshCw size={13} /> Start Over
                  </button>
                </>
              ) : (
                <p style={{ fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                  Upload a document or choose a prescription on file to see the detected medication here.
                </p>
              )}

              <div className="sabi-fam-info-box" style={{ marginTop: 12 }}>
                <ShieldCheck size={16} />
                <span>Your medical records are encrypted and handled with the highest level of privacy and security.</span>
              </div>

              <div
                className="sabi-fam-coordination-row"
                style={{ marginTop: 12, cursor: "pointer" }}
                onClick={() => notify("Connecting you to a licensed pharmacist…")}
              >
                <div className="who">
                  <MessageCircleQuestion size={18} style={{ color: "var(--sabi-primary-dark)" }} />
                  <div>
                    <strong>Need assistance?</strong>
                    <span>Chat with a Pharmacist</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default PrescriptionPage;
