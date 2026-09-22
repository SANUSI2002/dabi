import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, CircleDot } from "lucide-react";
import { Field, Select, Textarea, Checkbox } from "@/components/ui/form";
import type { ExaminationSystemKey, ExaminationSystemStatus, Laterality, PhysicalExaminationSystem } from "@/data/wardRound";

// Shared between Consultation and Ward Round — one card per body system.
// "Mark System Normal" only ever sets status, never fabricates findings text.

const LATERALITY_SYSTEMS: ExaminationSystemKey[] = ["musculoskeletal", "skin", "peripheralVascular"];
const SENSITIVE_SYSTEMS: ExaminationSystemKey[] = ["abdominal", "genitourinary"];

const STRUCTURED_PROMPTS: Partial<Record<ExaminationSystemKey, string[]>> = {
  general: ["Appearance", "Hydration", "Nutrition", "Distress"],
  cardiovascular: ["Heart sounds", "Murmurs", "Peripheral pulses", "JVP", "Oedema"],
  respiratory: ["Chest movement", "Breath sounds", "Added sounds", "Percussion"],
  abdominal: ["Inspection", "Palpation", "Tenderness", "Bowel sounds", "Organomegaly"],
  neurological: ["Consciousness", "Cranial nerves", "Tone", "Power (0–5)", "Reflexes", "Sensation", "Coordination", "Gait"],
  musculoskeletal: ["Inspection", "Range of movement", "Tenderness", "Power (0–5)", "Deformity"],
  headAndNeck: ["Throat", "Ears", "Nose", "Lymph nodes", "Thyroid"],
  skin: ["Lesion type", "Distribution", "Colour", "Texture"],
  peripheralVascular: ["Pulses", "Capillary refill", "Varicosities", "Ulceration"],
  genitourinary: ["Inspection", "Findings"],
  other: ["Findings"],
};

function StatusButton({
  active,
  tone,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  tone: "brand" | "action" | "mist";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const toneClass = { brand: "bg-brand-600 text-white ring-brand-600", action: "bg-action-600 text-white ring-action-600", mist: "bg-mist-700 text-white ring-mist-700" }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
        active ? toneClass : "bg-white text-mist-600 ring-mist-200 hover:bg-mist-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function PhysicalExaminationCard({
  label,
  entry,
  onChange,
  readOnly,
  defaultOpen = false,
}: {
  label: string;
  entry: PhysicalExaminationSystem;
  onChange: (next: PhysicalExaminationSystem) => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || entry.status !== "Not Examined");
  const showLaterality = LATERALITY_SYSTEMS.includes(entry.system);
  const showSensitive = SENSITIVE_SYSTEMS.includes(entry.system);
  const prompts = STRUCTURED_PROMPTS[entry.system] ?? ["Findings"];

  const statusTone: Record<ExaminationSystemStatus, "brand" | "action" | "mist"> = {
    Normal: "brand",
    Abnormal: "action",
    "Not Examined": "mist",
  };

  return (
    <div className="rounded-2xl border border-mist-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-mist-800">
          {label}
          <span className={`chip ${entry.status === "Normal" ? "bg-brand-50 text-brand-700" : entry.status === "Abnormal" ? "bg-action-50 text-action-700" : "bg-mist-100 text-mist-500"}`}>
            {entry.status}
          </span>
        </span>
        {open ? <ChevronUp size={16} className="text-mist-400" /> : <ChevronDown size={16} className="text-mist-400" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-mist-100 px-4 py-4">
          <div className="flex flex-wrap gap-1.5">
            <StatusButton
              active={entry.status === "Not Examined"}
              tone={statusTone["Not Examined"]}
              icon={<CircleDot size={12} />}
              label="Not Examined"
              onClick={() => !readOnly && onChange({ ...entry, status: "Not Examined" })}
            />
            <StatusButton
              active={entry.status === "Normal"}
              tone={statusTone.Normal}
              icon={<CircleCheck size={12} />}
              label="Mark System Normal"
              onClick={() => !readOnly && onChange({ ...entry, status: "Normal", findings: undefined })}
            />
            <StatusButton
              active={entry.status === "Abnormal"}
              tone={statusTone.Abnormal}
              icon={<CircleX size={12} />}
              label="Abnormal"
              onClick={() => !readOnly && onChange({ ...entry, status: "Abnormal" })}
            />
          </div>

          {entry.status === "Abnormal" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {prompts.map((prompt) => (
                <Field key={prompt} label={prompt}>
                  <input
                    className="input"
                    disabled={readOnly}
                    value={entry.findings?.[prompt] ?? ""}
                    onChange={(e) => onChange({ ...entry, findings: { ...entry.findings, [prompt]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          )}

          {showLaterality && entry.status !== "Not Examined" && (
            <Field label="Laterality">
              <Select
                disabled={readOnly}
                options={["N/A", "Left", "Right", "Bilateral"]}
                value={entry.laterality ?? "N/A"}
                onChange={(e) => onChange({ ...entry, laterality: e.target.value as Laterality })}
              />
            </Field>
          )}

          {entry.status !== "Not Examined" && (
            <Field label="Notes">
              <Textarea
                disabled={readOnly}
                value={entry.notes ?? ""}
                onChange={(e) => onChange({ ...entry, notes: e.target.value })}
                placeholder="Free-text notes (optional)"
              />
            </Field>
          )}

          {showSensitive && entry.status !== "Not Examined" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Checkbox
                label="Consent documented"
                disabled={readOnly}
                checked={Boolean(entry.consentDocumented)}
                onChange={(e) => onChange({ ...entry, consentDocumented: e.target.checked })}
              />
              <Checkbox
                label="Chaperone documented"
                disabled={readOnly}
                checked={Boolean(entry.chaperoneDocumented)}
                onChange={(e) => onChange({ ...entry, chaperoneDocumented: e.target.checked })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
