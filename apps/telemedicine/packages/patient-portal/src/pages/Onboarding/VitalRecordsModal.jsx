import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, HeartPulse, Sparkles, X } from "lucide-react";

const defaultValues = {
  height: "",
  heightUnit: "cm",
  weight: "",
  weightUnit: "kg",
  systolic: "",
  diastolic: "",
  heartRate: "",
  temperature: "",
  temperatureUnit: "C",
  bloodGroup: "",
  genotype: "",
  bloodSugar: "",
  oxygenSaturation: "",
  allergies: "",
  medicalConditions: "",
};

export default function VitalRecordsModal({ open, onClose, onComplete }) {
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const dialogRef = useRef(null);
  const firstInputRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveElement.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      setErrors({});
      setSubmitError("");
      setIsSaving(false);
    }
  }, [open]);

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSubmitError("");
  };

  const validate = () => {
    const nextErrors = {};

    if (!values.height.trim()) nextErrors.height = "Height is required";
    if (!values.weight.trim()) nextErrors.weight = "Weight is required";
    if (!values.systolic.trim()) nextErrors.systolic = "Systolic is required";
    if (!values.diastolic.trim()) nextErrors.diastolic = "Diastolic is required";
    if (!values.heartRate.trim()) nextErrors.heartRate = "Heart rate is required";
    if (!values.bloodGroup.trim()) nextErrors.bloodGroup = "Blood group is required";
    if (!values.genotype.trim()) nextErrors.genotype = "Genotype is required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    setSubmitError("");

    try {
      const payload = {
        height: `${values.height} ${values.heightUnit}`,
        weight: `${values.weight} ${values.weightUnit}`,
        bloodPressure: `${values.systolic}/${values.diastolic}`,
        heartRate: `${values.heartRate} bpm`,
        temperature: `${values.temperature} ${values.temperatureUnit}`,
        bloodGroup: values.bloodGroup,
        genotype: values.genotype,
        bloodSugar: values.bloodSugar,
        oxygenSaturation: values.oxygenSaturation,
        allergies: values.allergies,
        medicalConditions: values.medicalConditions,
      };

      try {
        const response = await fetch("/api/vital-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Unable to save vital records right now.");
        }
      } catch {
        localStorage.setItem("sabi-vital-records", JSON.stringify(payload));
      }

      onComplete(payload);
    } catch (error) {
      setSubmitError(error.message || "We could not save your vital records. Please try again.");
      setIsSaving(false);
    }
  };

  const title = useMemo(() => "Complete Your Health Profile", []);
  const subtitle = useMemo(
    () => "Please provide your current vital information to personalize your healthcare experience.",
    []
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 px-3 py-4 backdrop-blur-sm">
      <div
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl shadow-slate-950/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vital-records-title"
        ref={dialogRef}
      >
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-sm shadow-emerald-900/20">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="vital-records-title" className="text-xl font-semibold text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-5 py-5 sm:px-6">
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Basic Measurements
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Height</label>
                  <div className="flex gap-2">
                    <input
                      ref={firstInputRef}
                      type="number"
                      min="0"
                      placeholder="160"
                      value={values.height}
                      onChange={updateField("height")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <select
                      value={values.heightUnit}
                      onChange={updateField("heightUnit")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="cm">cm</option>
                      <option value="ft">ft</option>
                    </select>
                  </div>
                  {errors.height ? <p className="mt-1 text-xs text-rose-600">{errors.height}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Weight</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="65"
                      value={values.weight}
                      onChange={updateField("weight")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <select
                      value={values.weightUnit}
                      onChange={updateField("weightUnit")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                  {errors.weight ? <p className="mt-1 text-xs text-rose-600">{errors.weight}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Blood Pressure</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="120"
                      value={values.systolic}
                      onChange={updateField("systolic")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="80"
                      value={values.diastolic}
                      onChange={updateField("diastolic")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div className="mt-1 flex gap-2">
                    {errors.systolic ? <p className="text-xs text-rose-600">{errors.systolic}</p> : null}
                    {errors.diastolic ? <p className="text-xs text-rose-600">{errors.diastolic}</p> : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Heart Rate</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="72"
                      value={values.heartRate}
                      onChange={updateField("heartRate")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <span className="text-sm text-slate-500">bpm</span>
                  </div>
                  {errors.heartRate ? <p className="mt-1 text-xs text-rose-600">{errors.heartRate}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Body Temperature</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="37"
                      value={values.temperature}
                      onChange={updateField("temperature")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <select
                      value={values.temperatureUnit}
                      onChange={updateField("temperatureUnit")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="C">°C</option>
                      <option value="F">°F</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Blood Group</label>
                  <select
                    value={values.bloodGroup}
                    onChange={updateField("bloodGroup")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  {errors.bloodGroup ? <p className="mt-1 text-xs text-rose-600">{errors.bloodGroup}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Genotype</label>
                  <select
                    value={values.genotype}
                    onChange={updateField("genotype")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select</option>
                    <option value="AA">AA</option>
                    <option value="AS">AS</option>
                    <option value="AC">AC</option>
                    <option value="SS">SS</option>
                    <option value="SC">SC</option>
                  </select>
                  {errors.genotype ? <p className="mt-1 text-xs text-rose-600">{errors.genotype}</p> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Optional Details
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Blood Sugar</label>
                  <input
                    type="text"
                    placeholder="e.g. 95 mg/dL"
                    value={values.bloodSugar}
                    onChange={updateField("bloodSugar")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Oxygen Saturation (SpO₂)</label>
                  <input
                    type="text"
                    placeholder="e.g. 98%"
                    value={values.oxygenSaturation}
                    onChange={updateField("oxygenSaturation")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Allergies</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin"
                    value={values.allergies}
                    onChange={updateField("allergies")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Existing Medical Conditions</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Asthma"
                    value={values.medicalConditions}
                    onChange={updateField("medicalConditions")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
              {!isSaving ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
