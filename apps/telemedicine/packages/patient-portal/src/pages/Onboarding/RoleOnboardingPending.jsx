import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const VIDEO_SRC = "https://assets.mixkit.co/videos/29933/29933-720.mp4";

function humanize(slug) {
  if (!slug) return "";
  if (slug === "other") return "Other";
  return slug
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Every account type from the onboarding spec is selectable today —
// their signup forms are being built one at a time. This keeps every
// route real (no dead-end navigation) while that work is in progress.
export default function RoleOnboardingPending() {
  const navigate = useNavigate();
  const { category, type } = useParams();
  const roleLabel = humanize(type || category);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <video
        className="fixed inset-0 w-full h-full object-cover z-0"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-br from-teal-950/80 via-teal-950/60 to-slate-950/70 z-[1]" />

      <div className="relative z-10 min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-white/40 shadow-2xl shadow-black/30 p-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 text-lg font-semibold mb-3">
            {roleLabel[0] || "?"}
          </span>
          <h2 className="text-xl font-semibold text-slate-900">
            {roleLabel} registration is on its way
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            We're setting up the {roleLabel.toLowerCase()} signup experience. In the meantime,
            you can explore another account type or come back shortly.
          </p>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Choose a different account type
          </button>
        </div>
      </div>
    </div>
  );
}
