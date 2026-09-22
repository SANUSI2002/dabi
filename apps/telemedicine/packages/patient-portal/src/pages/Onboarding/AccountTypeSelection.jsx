import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  HeartHandshake,
  Stethoscope,
  Building2,
  ChevronLeft,
  ArrowRight,
  Syringe,
  Baby,
  Brain,
  Activity,
  Pill,
  Salad,
  Eye as EyeIcon,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import { HOSPITAL_ONBOARDING_URL } from "../../ecosystemLinks";

const VIDEO_SRC = "https://assets.mixkit.co/videos/29933/29933-720.mp4";

// Patient and professional identities begin here. Healthcare organizations
// use the shared Sabi hospital onboarding so there is only one application,
// compliance, commercial, and provisioning workflow across the ecosystem.
const CATEGORIES = [
  {
    key: "personal",
    title: "Personal",
    description: "I'm here for my own care, or to help someone I look after.",
    icon: User,
  },
  {
    key: "professional",
    title: "Healthcare Professional",
    description: "I provide clinical or allied health care.",
    icon: Stethoscope,
  },
];

const PERSONAL_TYPES = [
  { slug: "patient", label: "Patient", icon: User },
  { slug: "caregiver", label: "Caregiver", icon: HeartHandshake },
];

const PROFESSIONAL_TYPES = [
  { slug: "doctor", label: "Doctor", icon: Stethoscope },
  { slug: "nurse", label: "Nurse", icon: Syringe },
  { slug: "dentist", label: "Dentist", icon: Sparkles },
  { slug: "dermatologist", label: "Dermatologist", icon: Sparkles },
  { slug: "psychiatrist", label: "Psychiatrist", icon: Brain },
  { slug: "psychologist", label: "Psychologist", icon: Brain },
  { slug: "physiotherapist", label: "Physiotherapist", icon: Activity },
  { slug: "pharmacist", label: "Pharmacist", icon: Pill },
  { slug: "nutritionist", label: "Nutritionist / Dietitian", icon: Salad },
  { slug: "optometrist", label: "Optometrist", icon: EyeIcon },
  { slug: "midwife", label: "Midwife", icon: Baby },
  { slug: "other", label: "Other Healthcare Professional", icon: MoreHorizontal },
];

function TypeGrid({ types, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {types.map(({ slug, label, icon: Icon }) => (
        <button
          key={slug}
          type="button"
          onClick={() => onSelect(slug)}
          className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center transition-all hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium leading-tight text-slate-700">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function AccountTypeSelection() {
  const navigate = useNavigate();
  const [category, setCategory] = useState(null); // null | "personal" | "professional"

  const goToForm = (category_, slug) => {
    if (category_ === "personal") {
      navigate(`/signup/${slug}`);
    } else {
      navigate(`/signup/${category_}/${slug}`);
    }
  };

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
        Your browser does not support the video tag.
      </video>
      <div className="fixed inset-0 bg-gradient-to-br from-teal-950/80 via-teal-950/60 to-slate-950/70 z-[1]" />

      <div className="relative z-10 min-h-screen w-full flex items-center justify-center p-2 sm:p-2.5 md:p-3 lg:p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
          {/* LEFT: copy over video */}
          <div className="flex flex-col justify-center gap-3 py-1 sm:py-2">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl leading-[1.05] font-semibold text-white tracking-tight drop-shadow-sm">
                One platform.
                <br />
                Built for how you use it.
              </h1>
              <p className="mt-2 text-base text-teal-50/90 max-w-md">
                Sabi Health looks different depending on who's using it. Tell us how
                you'll use it, and we'll set up the right account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="self-start text-sm text-teal-100/90 hover:text-white underline underline-offset-4"
            >
              Already have an account? Sign in
            </button>
          </div>

          {/* RIGHT: selector card, glassy over the video */}
          <div className="flex items-center">
            <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border border-white/40 shadow-2xl shadow-black/30 p-4 sm:p-5 md:p-6">
              {category ? (
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : null}

              {!category && (
                <>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
                    What would you like to use Sabi Health as?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the option that best describes you.
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {CATEGORIES.map(({ key, title, description, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-all hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-sm"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{title}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </button>
                    ))}
                    <a
                      href={HOSPITAL_ONBOARDING_URL}
                      className="flex w-full items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3.5 text-left transition-all hover:border-teal-400 hover:bg-teal-50 hover:shadow-sm"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-slate-900">Healthcare Organisation</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Continue to the shared hospital onboarding and compliance application.
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-teal-700" />
                    </a>
                  </div>
                </>
              )}

              {category === "personal" && (
                <>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Personal account</h2>
                  <p className="mt-1 text-sm text-slate-500">Are you the patient, or caring for someone else?</p>
                  <div className="mt-4">
                    <TypeGrid types={PERSONAL_TYPES} onSelect={(slug) => goToForm("personal", slug)} />
                  </div>
                </>
              )}

              {category === "professional" && (
                <>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
                    What type of healthcare professional are you?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Don't see your exact profession? Choose "Other" — you can specify it next.
                  </p>
                  <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
                    <TypeGrid
                      types={PROFESSIONAL_TYPES}
                      onSelect={(slug) => goToForm("professional", slug)}
                    />
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
