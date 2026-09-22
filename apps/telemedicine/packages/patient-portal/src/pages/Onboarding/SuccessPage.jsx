import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, PartyPopper, Sparkles, UserCheck, ArrowRight } from "lucide-react";

export default function SabiHealthSuccess() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const target = 30;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const id = setTimeout(() => setProgress(target), 200);
    return () => clearTimeout(id);
  }, []);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-emerald-50/60 flex items-center justify-center px-4 py-8 sm:py-10">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 rounded-full bg-teal-100/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-72 h-72 rounded-full bg-emerald-100/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        {/* Success badge */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-emerald-300/40 to-teal-200/20 blur-2xl animate-pulse" />
          <PartyPopper className="absolute -top-3 -right-8 w-7 h-7 text-emerald-500 rotate-12" />
          <Sparkles className="absolute -bottom-2 -left-8 w-6 h-6 text-teal-400" />

          <div className="relative w-28 h-28 rounded-full bg-white shadow-xl shadow-emerald-900/10 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
            <div className="w-18 h-18 rounded-full border-2 border-emerald-100 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <Check className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          You&apos;re all set!
        </h1>
        <p className="mt-3 text-gray-500 text-base max-w-sm">
          Your Sabi Health account has been created successfully.
        </p>

        {/* Profile completion card */}
        <div className="mt-6 w-full bg-white rounded-3xl shadow-xl shadow-emerald-900/[0.06] border border-emerald-50 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 text-left">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 120 120" className="w-24 h-24 -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#ECFDF5"
                strokeWidth="10"
              />
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#065F46" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="url(#ringGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-gray-900">{target}%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">Profile Completion</h2>
            </div>
            <p className="mt-2 text-gray-500 leading-relaxed">
              You can start using Sabi Health now. Complete your profile later to
              unlock personalized healthcare services.
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-6 w-full sm:w-auto px-8 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold text-base shadow-lg shadow-emerald-900/30 hover:shadow-xl hover:shadow-emerald-900/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          Go to Health Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="mt-6 text-gray-400 text-sm">
          Need help getting started?{" "}
          <a href="#" className="text-emerald-700 font-medium hover:underline">
            Contact Support
          </a>
        </p>

        <div className="mt-8 flex items-center gap-1.5 text-emerald-200/70">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2C9 6 6 9 6 13a6 6 0 0 0 12 0c0-4-3-7-6-11z" />
          </svg>
          <span className="text-lg font-semibold tracking-widest">RKLE</span>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
