import { User, Stethoscope, HeartHandshake, Building2 } from "lucide-react";

const ROLES = [
  { key: "patient", label: "Patient", icon: User },
  { key: "doctor", label: "Doctor", icon: Stethoscope },
  { key: "caregiver", label: "Caregiver", icon: HeartHandshake },
  { key: "hospital", label: "Hospital", icon: Building2 },
];

export default function RoleSelector({ value, onChange, label = "Select Account Type" }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map(({ key, label: roleLabel, icon: Icon }) => {
          const active = value === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? "border-teal-700 bg-teal-700 text-white shadow-md shadow-teal-900/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-teal-700"}`} />
              {roleLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
