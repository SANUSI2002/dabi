import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CreditCard,
  BadgeCheck,
  UploadCloud,
  Camera,
  Check,
  ChevronRight,
  X,
  FileText,
  RotateCcw,
  AlertCircle,
  IdCard,
  UserCheck,
} from "lucide-react";
import VitalRecordsModal from "./VitalRecordsModal";

const steps = [
  { id: 1, title: "Government ID", desc: "Passport or Driver's License" },
  { id: 2, title: "Biometric Selfie", desc: "Face match verification" },
  { id: 3, title: "Review & Submit", desc: "Finalizing your account" },
];

const docTypes = [
  { id: "passport", label: "Passport", icon: "abc" },
  { id: "license", label: "Driver's License", icon: CreditCard },
  { id: "nin", label: "NIN", icon: BadgeCheck },
];

// ---------------------------------------------------------------------------
// Selfie / face-match verification API
// ---------------------------------------------------------------------------
// Plug your identity-verification provider in here (e.g. Onfido, Smile ID,
// Veriff, AWS Rekognition, a custom backend, etc). This function is the only
// place that needs to change to go from mock to live — everything below
// (handleVerify) just calls it and reacts to { verified, score, reason }.

const SELFIE_VERIFY_ENDPOINT =
  import.meta?.env?.VITE_SELFIE_VERIFY_ENDPOINT || "/api/verify/selfie";

/**
 * Sends the captured/uploaded selfie and the government ID document to the
 * verification API and resolves with the match result.
 *
 * @param {Object} params
 * @param {string} params.selfieDataUrl - base64 data URL from the canvas capture or file upload
 * @param {{ name: string, previewUrl: string|null, isImage: boolean }} params.documentFile
 * @param {string} params.documentType - one of docTypes ids ("passport" | "license" | "nin")
 * @returns {Promise<{ verified: boolean, score: number, reason?: string }>}
 */
async function verifySelfieWithAPI({ selfieDataUrl, documentFile, documentType }) {
  // Convert the selfie data URL into a Blob so it can be sent as multipart
  // form data (swap this out if your API expects raw base64 JSON instead).
  const selfieBlob = await (await fetch(selfieDataUrl)).blob();

  const formData = new FormData();
  formData.append("selfie", selfieBlob, "selfie.png");
  formData.append("documentType", documentType);
  if (documentFile?.previewUrl) {
    const docBlob = await (await fetch(documentFile.previewUrl)).blob();
    formData.append("document", docBlob, documentFile.name || "document");
  }

  const response = await fetch(SELFIE_VERIFY_ENDPOINT, {
    method: "POST",
    // headers: { Authorization: `Bearer ${YOUR_API_KEY}` }, // add auth as needed
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Verification API returned ${response.status}`);
  }

  const data = await response.json();
  // Expected shape, adjust to match your provider's real response:
  // { verified: boolean, score: number (0-100), reason?: string }
  return {
    verified: Boolean(data.verified),
    score: Number(data.score ?? 0),
    reason: data.reason,
  };
}

// Small helper: wraps a click handler so the button only shows its
// checkmark ("tick") AFTER the underlying task has actually finished
// successfully — never before, and never if it fails.
//
// `action` may be sync or async, and should return one of:
//   - undefined              -> treated as success (fire-and-forget actions)
//   - true / false           -> explicit success/failure
//   - { success: boolean }   -> explicit success/failure
// Throwing (or an async rejection) counts as failure.
function useTick() {
  const [ticked, setTicked] = useState({});
  const [pending, setPending] = useState({});

  const fire = useCallback(async (id, action, holdMs = 900) => {
    setPending((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await action?.();
      const succeeded =
        result === undefined
          ? true
          : typeof result === "object" && result !== null
          ? Boolean(result.success)
          : Boolean(result);

      if (succeeded) {
        setTicked((prev) => ({ ...prev, [id]: true }));
        window.setTimeout(() => {
          setTicked((prev) => ({ ...prev, [id]: false }));
        }, holdMs);
      }
    } finally {
      setPending((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  return { ticked, pending, fire };
}

export default function SabiHealthIdentityVerification() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [selectedDoc, setSelectedDoc] = useState("license");

  const [file, setFile] = useState(null); // { name, size, previewUrl }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [selfie, setSelfie] = useState(null); // dataURL
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraUnstable, setCameraUnstable] = useState(false);
  const [positioningScore, setPositioningScore] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const selfieFileInputRef = useRef(null);

  // motion-stability tracking refs
  const stabilityCanvasRef = useRef(null);
  const prevFrameRef = useRef(null);
  const unstableStreakRef = useRef(0);
  const stabilityIntervalRef = useRef(null);
  const scoreIntervalRef = useRef(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [validationMsg, setValidationMsg] = useState("");
  const [showVitalModal, setShowVitalModal] = useState(false);

  const uploadSectionRef = useRef(null);
  const selfieSectionRef = useRef(null);
  const reviewSectionRef = useRef(null);

  const { ticked, pending, fire } = useTick();

  const selectedDocLabel =
    docTypes.find((d) => d.id === selectedDoc)?.label || selectedDoc;

  // --- Document upload handlers ---
  const handleFiles = (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    setFile({
      name: f.name,
      size: f.size,
      previewUrl: isImage ? URL.createObjectURL(f) : null,
      isImage,
    });
    setValidationMsg("");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = () => {
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    setFile(null);
  };

  // --- Camera stability detection ---
  // Samples the live video onto a tiny offscreen canvas at a steady
  // interval and compares the average pixel difference against the
  // previous sample. A sustained high difference means the camera /
  // the person's face is moving too much to get a clean capture.
  const clearStabilityWatch = () => {
    if (stabilityIntervalRef.current) {
      clearInterval(stabilityIntervalRef.current);
      stabilityIntervalRef.current = null;
    }
    prevFrameRef.current = null;
    unstableStreakRef.current = 0;
    setCameraUnstable(false);
  };

  const startStabilityWatch = () => {
    if (!stabilityCanvasRef.current) {
      stabilityCanvasRef.current = document.createElement("canvas");
      stabilityCanvasRef.current.width = 32;
      stabilityCanvasRef.current.height = 24;
    }
    const canvas = stabilityCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    stabilityIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      if (prevFrameRef.current) {
        let diffSum = 0;
        for (let i = 0; i < frame.length; i += 4) {
          diffSum += Math.abs(frame[i] - prevFrameRef.current[i]);
        }
        const avgDiff = diffSum / (frame.length / 4);

        if (avgDiff > 18) {
          unstableStreakRef.current += 1;
        } else {
          unstableStreakRef.current = Math.max(0, unstableStreakRef.current - 1);
        }

        if (unstableStreakRef.current >= 3) {
          setCameraUnstable(true);
        } else if (unstableStreakRef.current === 0) {
          setCameraUnstable(false);
        }
      }
      prevFrameRef.current = frame;
    }, 350);
  };

  // --- Selfie / camera handlers ---
  // Returns true only if the camera actually started streaming; false on
  // any permission/hardware failure. Callers use this to decide whether
  // the action truly succeeded (e.g. before showing a tick).
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // slight delay so the video element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        startStabilityWatch();
      }, 50);
      // simulate a positioning score climbing while camera is live
      let score = 40;
      scoreIntervalRef.current = setInterval(() => {
        // stalls the score while the camera is judged unstable
        if (unstableStreakRef.current >= 3) return;
        score = Math.min(96, score + Math.floor(Math.random() * 10));
        setPositioningScore(score);
        if (score >= 96) clearInterval(scoreIntervalRef.current);
      }, 400);
      return true;
    } catch (err) {
      setCameraError(
        "Camera access wasn't available. You can upload a selfie photo instead."
      );
      setCameraOn(false);
      return false;
    }
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    clearStabilityWatch();
    if (scoreIntervalRef.current) {
      clearInterval(scoreIntervalRef.current);
      scoreIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Returns true only if a frame was actually captured and saved as the
  // selfie; false if there was nothing to capture or the camera was
  // judged too unstable to trust the shot.
  const capturePhoto = () => {
    if (!videoRef.current) return false;
    if (cameraUnstable) return false; // guard: don't allow capture while unstable
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 300;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setSelfie(dataUrl);
    stopCamera();
    setValidationMsg("");
    return true;
  };

  // Retaking only "succeeds" once the camera is actually back on and
  // streaming again — if permission is denied this time, no tick.
  const retakePhoto = async () => {
    setSelfie(null);
    setPositioningScore(0);
    const started = await startCamera();
    return started;
  };

  const handleSelfieUpload = (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelfie(reader.result);
      setPositioningScore(88);
      setValidationMsg("");
    };
    reader.readAsDataURL(f);
  };

  // --- Actions ---
  const goPrevious = () => {
    navigate("/signup");
  };

  const goToStep = (id) => {
    setActiveStep(id);
    const refMap = {
      1: uploadSectionRef,
      2: selfieSectionRef,
      3: reviewSectionRef,
    };
    refMap[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Returns true only when the API actually confirms a match. Returns
  // false for missing inputs, a mismatch, or an API/network error — in
  // every one of those cases no tick should ever appear.
  const handleVerify = async () => {
    if (!file) {
      setValidationMsg("Please upload your government ID before continuing.");
      return false;
    }
    if (!selfie) {
      setValidationMsg("Please take or upload a selfie before continuing.");
      return false;
    }
    setValidationMsg("");
    setVerifying(true);

    try {
      const result = await verifySelfieWithAPI({
        selfieDataUrl: selfie,
        documentFile: file,
        documentType: selectedDoc,
      });

      setVerifying(false);

      if (result.verified) {
        setVerified(true);
        setActiveStep(3);
        setShowVitalModal(true);
        return true;
      }

      setValidationMsg(
        result.reason ||
          "We couldn't match your selfie to your ID. Please retake your selfie and try again."
      );
      return false;
    } catch (err) {
      // Endpoint not wired up yet, offline, or the API errored.
      console.error("Selfie verification API error:", err);
      setVerifying(false);
      setValidationMsg(
        "We couldn't reach the verification service. Please try again in a moment."
      );
      return false;
    }
  };

  const confirmCancel = () => {
    removeFile();
    setSelfie(null);
    setPositioningScore(0);
    stopCamera();
    setSelectedDoc("license");
    setActiveStep(1);
    setVerified(false);
    setShowCancelConfirm(false);
    navigate("/signup");
  };

  // Step 3 becomes reachable once both document & selfie are present,
  // and its checklist reflects live progress as the person completes 1 & 2.
  useEffect(() => {
    if (file && selfie && activeStep < 3) {
      setActiveStep(3);
    }
  }, [file, selfie]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen w-full relative px-3 sm:px-6 py-6"
      style={{
        background:
          "linear-gradient(180deg, #f4faf7 0%, #eef6f1 45%, #e8f3ec 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[300px_1fr] gap-6 relative z-0">
        {/* Left sidebar */}
        <div
          className="rounded-3xl p-4 h-fit lg:sticky lg:top-6"
          style={{
            backgroundColor: "#fbfcfd",
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.06), 0 16px 32px rgba(15,23,42,0.12)",
          }}
        >
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-900 to-emerald-600 bg-clip-text text-transparent">
            Identity Verification
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            To protect your health records and comply with regulations, we need
            to verify your identity.
          </p>

          <div className="mt-6 space-y-2">
            {steps.map((step) => {
              const isActive = step.id === activeStep;
              const isDone = step.id < activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`w-full text-left relative flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? "border-l-4 border-emerald-700 shadow-sm"
                      : "border-l-4 border-transparent hover:bg-gray-50"
                  }`}
                  style={
                    isActive
                      ? {
                          background:
                            "linear-gradient(to right, #ecfdf5, rgba(236,253,245,0.4))",
                        }
                      : undefined
                  }
                >
                  <div
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      isActive
                        ? "bg-gradient-to-br from-emerald-700 to-emerald-900 text-white shadow-md shadow-emerald-900/30"
                        : isDone
                        ? "bg-emerald-600 text-white"
                        : "border-2 border-gray-300 text-gray-400"
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <div>
                    <div
                      className={`font-semibold ${
                        isActive ? "text-emerald-900" : "text-gray-700"
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-sm text-gray-400">{step.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="mt-6 rounded-2xl border border-emerald-100 p-4"
            style={{ backgroundColor: "rgba(236,253,245,0.9)" }}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-700 mb-3" />
            <p className="text-sm text-gray-600 leading-relaxed">
              Your data is encrypted end-to-end and stored in HIPAA-compliant
              secure servers. SabiHealth never sells your personal
              information.
            </p>
          </div>
        </div>

        {/* Right content */}
        <div className="space-y-6">
          {verified ? (
            <div
              className="rounded-3xl p-6 flex flex-col items-center text-center"
              style={{
                backgroundColor: "#fbfcfd",
                border: "1px solid rgba(15,23,42,0.06)",
                boxShadow:
                  "0 1px 2px rgba(15,23,42,0.06), 0 20px 40px rgba(15,23,42,0.14)",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-4">
                <Check className="w-7 h-7 text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Identity submitted for review</h2>
              <p className="text-gray-500 mt-2 max-w-sm">
                We're verifying your documents and selfie now. This usually takes
                a few minutes — we'll notify you once it's complete.
              </p>
            </div>
          ) : (
            <>
              {/* Upload document card */}
              <div
                ref={uploadSectionRef}
                className="rounded-3xl p-6 sm:p-8"
                style={{
                  backgroundColor: "#fbfcfd",
                  border: "1px solid rgba(15,23,42,0.06)",
                  boxShadow:
                    "0 1px 2px rgba(15,23,42,0.05), 0 16px 32px rgba(15,23,42,0.1)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Upload Document</h2>
                  <span className="text-xs font-medium text-gray-400">
                    Required Document
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {docTypes.map((doc) => {
                    const isSelected = selectedDoc === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedDoc(doc.id)}
                        className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300 shadow-sm"
                            : "border-dashed border-gray-300 hover:border-emerald-200 hover:bg-emerald-50/30"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                        {doc.icon === "abc" ? (
                          <span className="text-xl tracking-widest text-gray-400 font-bold">
                            ***
                          </span>
                        ) : (
                          <doc.icon
                            className={`w-7 h-7 ${
                              isSelected ? "text-emerald-700" : "text-gray-400"
                            }`}
                          />
                        )}
                        <span
                          className={`font-medium ${
                            isSelected ? "text-emerald-900" : "text-gray-600"
                          }`}
                        >
                          {doc.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {!file ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition-colors ${
                      isDragging
                        ? "border-emerald-500"
                        : "border-emerald-200 hover:border-emerald-300"
                    }`}
                    style={
                      isDragging ? { backgroundColor: "rgba(209,250,229,0.6)" } : undefined
                    }
                  >
                    <img
                      src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&q=60"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 0.12 }}
                    />
                    <div className="relative flex flex-col items-center justify-center gap-3 py-10">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/20">
                        <UploadCloud className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-gray-700 font-medium">
                        Drag and drop or{" "}
                        <span className="text-emerald-700 font-semibold underline underline-offset-2">
                          browse files
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 tracking-wide">
                        JPG, PNG, OR PDF (MAX 10MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border-2 border-emerald-200 p-4 flex items-center gap-3"
                    style={{ backgroundColor: "rgba(209,250,229,0.5)" }}
                  >
                    {file.isImage ? (
                      <img
                        src={file.previewUrl}
                        alt="Document preview"
                        className="w-14 h-14 rounded-xl object-cover border border-emerald-200"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-emerald-700" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(0)} KB · Uploaded
                      </p>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Selfie verification card */}
              <div
                ref={selfieSectionRef}
                className="rounded-3xl p-6 sm:p-8"
                style={{
                  backgroundColor: "#fbfcfd",
                  border: "1px solid rgba(15,23,42,0.06)",
                  boxShadow:
                    "0 1px 2px rgba(15,23,42,0.05), 0 16px 32px rgba(15,23,42,0.1)",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Selfie Verification</h2>
                  <span className="text-[11px] font-semibold tracking-wide uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                    Live Biometrics
                  </span>
                </div>

                <div className="grid sm:grid-cols-[1.1fr_1fr] gap-5 items-center">
                  <div
                    className="relative rounded-2xl overflow-hidden bg-gray-900"
                    style={{ aspectRatio: "4 / 3", minHeight: "240px" }}
                  >
                    {selfie ? (
                      <img
                        src={selfie}
                        alt="Captured selfie"
                        className="w-full h-full object-cover"
                      />
                    ) : cameraOn ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                        >
                          <Camera className="w-6 h-6 text-emerald-300" />
                        </div>
                        <p className="text-sm" style={{ color: "rgba(209,250,229,0.85)" }}>
                          Start your camera to take a live selfie
                        </p>
                      </div>
                    )}

                    {/* Face scan overlay, only while camera live and no selfie yet */}
                    {cameraOn && !selfie && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 400 300"
                        fill="none"
                      >
                        <ellipse
                          cx="200"
                          cy="150"
                          rx="80"
                          ry="100"
                          stroke={cameraUnstable ? "#f59e0b" : "#6EE7B7"}
                          strokeWidth="2"
                          strokeDasharray="6 6"
                          opacity="0.8"
                        />
                        <circle cx="150" cy="60" r="4" fill={cameraUnstable ? "#f59e0b" : "#6EE7B7"} />
                        <circle cx="280" cy="120" r="4" fill={cameraUnstable ? "#f59e0b" : "#6EE7B7"} />
                        <circle cx="260" cy="220" r="4" fill={cameraUnstable ? "#f59e0b" : "#6EE7B7"} />
                        <line x1="150" y1="60" x2="280" y2="120" stroke={cameraUnstable ? "#f59e0b" : "#6EE7B7"} strokeWidth="1" opacity="0.6" />
                        <line x1="280" y1="120" x2="260" y2="220" stroke={cameraUnstable ? "#f59e0b" : "#6EE7B7"} strokeWidth="1" opacity="0.6" />
                      </svg>
                    )}

                    {/* Instability warning banner */}
                    {cameraOn && !selfie && cameraUnstable && (
                      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 bg-amber-500/95 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Camera isn't steady — hold still so we can get a clear shot
                      </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />

                    {/* Camera controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                      {!cameraOn && !selfie && (
                        <button
                          type="button"
                          onClick={() => fire("startCamera", startCamera)}
                          disabled={pending.startCamera}
                          className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
                          style={{ backgroundColor: "#ffffff" }}
                          aria-label="Start camera"
                        >
                          {ticked.startCamera ? (
                            <Check className="w-5 h-5 text-emerald-700" strokeWidth={3} />
                          ) : (
                            <Camera className="w-5 h-5 text-emerald-800" />
                          )}
                        </button>
                      )}
                      {cameraOn && !selfie && (
                        <button
                          type="button"
                          onClick={() => !cameraUnstable && fire("capture", capturePhoto)}
                          disabled={cameraUnstable || pending.capture}
                          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          style={{
                            backgroundColor: "#ffffff",
                            boxShadow: "0 0 0 4px rgba(255,255,255,0.4)",
                          }}
                          aria-label="Capture photo"
                        >
                          {ticked.capture ? (
                            <Check className="w-6 h-6 text-emerald-700" strokeWidth={3} />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-700" />
                          )}
                        </button>
                      )}
                      {selfie && (
                        <button
                          type="button"
                          onClick={() => fire("retake", retakePhoto)}
                          disabled={pending.retake}
                          className="flex items-center gap-2 px-4 py-2 rounded-full text-emerald-800 text-sm font-medium shadow-lg hover:bg-white transition-colors disabled:opacity-60"
                          style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
                        >
                          {ticked.retake ? (
                            <Check className="w-4 h-4" strokeWidth={3} />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Retake
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold tracking-wide uppercase text-gray-500 mb-3">
                      How to take a photo:
                    </h3>
                    <ul className="space-y-2.5">
                      {[
                        "Ensure your face is well-lit and clearly visible",
                        "Remove glasses, hats, or masks",
                        "Look directly at the camera lens",
                        "Hold your device steady while the camera is live",
                      ].map((tip) => (
                        <li key={tip} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-600 leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>

                    {cameraError && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                        {cameraError}
                      </p>
                    )}

                    <input
                      ref={selfieFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleSelfieUpload(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => selfieFileInputRef.current?.click()}
                      className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      Or upload a selfie photo instead
                    </button>

                    <div className="mt-6">
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                            cameraUnstable
                              ? "from-amber-500 to-amber-400"
                              : "from-emerald-600 to-teal-500"
                          }`}
                          style={{ width: `${selfie ? 100 : positioningScore}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-500 font-medium">
                          Positioning Score: {selfie ? 100 : positioningScore}%
                        </span>
                        <span className={cameraUnstable ? "text-amber-600 font-medium" : "text-gray-400"}>
                          {selfie
                            ? "Captured"
                            : cameraUnstable
                            ? "Unstable"
                            : cameraOn
                            ? "Keep Still"
                            : "Camera off"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review & Submit card */}
              <div
                ref={reviewSectionRef}
                className="rounded-3xl p-6 sm:p-8"
                style={{
                  backgroundColor: "#fbfcfd",
                  border: "1px solid rgba(15,23,42,0.06)",
                  boxShadow:
                    "0 1px 2px rgba(15,23,42,0.05), 0 16px 32px rgba(15,23,42,0.1)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Review & Submit</h2>
                  <span className="text-xs font-medium text-gray-400">
                    Double-check before you submit
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Document summary */}
                  <div
                    className="rounded-2xl border p-5 flex items-start gap-4"
                    style={{
                      borderColor: file ? "rgba(16,185,129,0.25)" : "rgba(15,23,42,0.08)",
                      backgroundColor: file ? "rgba(209,250,229,0.35)" : "rgba(15,23,42,0.02)",
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-emerald-100">
                      <IdCard className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        Government ID
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Type: {selectedDocLabel}
                      </p>
                      {file ? (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {file.name} · {(file.size / 1024).toFixed(0)} KB
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mt-0.5">Not uploaded yet</p>
                      )}
                    </div>
                    {file ? (
                      file.isImage ? (
                        <img
                          src={file.previewUrl}
                          alt="Document preview"
                          className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Selfie summary */}
                  <div
                    className="rounded-2xl border p-5 flex items-start gap-4"
                    style={{
                      borderColor: selfie ? "rgba(16,185,129,0.25)" : "rgba(15,23,42,0.08)",
                      backgroundColor: selfie ? "rgba(209,250,229,0.35)" : "rgba(15,23,42,0.02)",
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-emerald-100">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        Biometric Selfie
                      </p>
                      {selfie ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Positioning score: {positioningScore || 88}%
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mt-0.5">Not captured yet</p>
                      )}
                    </div>
                    {selfie ? (
                      <img
                        src={selfie}
                        alt="Selfie preview"
                        className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="mt-3 rounded-2xl border border-dashed p-3 flex items-center gap-2"
                  style={{ borderColor: "rgba(15,23,42,0.12)" }}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-gray-500 leading-relaxed">
                    By submitting, you confirm this document and selfie belong to
                    you and are accurate. Our review team may follow up if
                    anything needs a second look.
                  </p>
                </div>
              </div>

              {validationMsg && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {validationMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-emerald-800 font-medium hover:text-emerald-950 hover:underline"
                >
                  Cancel Registration
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fire("previous", goPrevious)}
                    disabled={pending.previous}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-100 text-emerald-900 font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-60"
                  >
                    {ticked.previous && <Check className="w-4 h-4" strokeWidth={3} />}
                    Previous Step
                  </button>
                  <button
                    type="button"
                    onClick={() => fire("verify", handleVerify, 300)}
                    disabled={verifying || pending.verify}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold shadow-lg shadow-emerald-900/30 hover:shadow-xl hover:shadow-emerald-900/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    {verifying
                      ? "Verifying..."
                      : ticked.verify
                      ? "Submitting..."
                      : "Verify Identity"}
                    {!verifying &&
                      (ticked.verify ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      ))}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <VitalRecordsModal
        open={showVitalModal}
        onClose={() => {
          setShowVitalModal(false);
          navigate("/dashboard");
        }}
        onComplete={() => {
          setShowVitalModal(false);
          navigate("/dashboard");
        }}
      />

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
          <div
            className="rounded-3xl max-w-sm w-full p-7 text-center pointer-events-auto"
            style={{ backgroundColor: "#ffffff", boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Cancel registration?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will clear your uploaded document and selfie. You can start
              verification again anytime.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Keep Going
              </button>
              <button
                type="button"
                onClick={() => fire("confirmCancel", confirmCancel, 350)}
                disabled={pending.confirmCancel}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {ticked.confirmCancel && <Check className="w-4 h-4" strokeWidth={3} />}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}