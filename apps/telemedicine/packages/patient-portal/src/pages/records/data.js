import {
  Folder,
  Hospital,
  Stethoscope,
  FileEdit,
  FlaskConical,
  ScanLine,
  Syringe,
  CloudUpload,
  Video,
} from "lucide-react";
import { isVisit } from "../../api/recordsApi";

// Adapters from the Sabi API onto the fields the Medical Records components read.
// `icon` holds the lucide-react component itself, rendered by consumers as <Icon size={..} />.

export const CATEGORY_ICON_CHOICES = [Folder, Stethoscope, FlaskConical, ScanLine, Syringe, FileEdit, Hospital];
// Folder icons are stored on the server by name, in the same order as the choices above.
const ICON_NAMES = ["folder", "stethoscope", "flask", "scan", "syringe", "pill", "hospital"];
export const iconName = (Icon) => ICON_NAMES[CATEGORY_ICON_CHOICES.indexOf(Icon)] || "folder";
const iconFor = (name) => CATEGORY_ICON_CHOICES[ICON_NAMES.indexOf(name)] || Folder;

const UNITS = { Consultations: "Documents", Prescriptions: "Documents", "Lab Results": "Reports", "Medical Imaging": "Scans / X-Rays", Vaccinations: "Records" };

// The standard folders keep this order; the patient's own folders follow.
const DEFAULT_ORDER = ["Consultations", "Prescriptions", "Lab Results", "Medical Imaging", "Vaccinations"];
const rank = (c) => (c.primary && DEFAULT_ORDER.includes(c.label) ? DEFAULT_ORDER.indexOf(c.label) : DEFAULT_ORDER.length);
export const sortCategories = (categories) => [...categories].sort((a, b) => rank(a) - rank(b));

export const toUiCategory = (c) => ({
  id: c.id,
  label: c.name,
  icon: iconFor(c.icon),
  unit: UNITS[c.name] || "Documents",
  baseCount: 0,
  primary: Boolean(c.isDefault),
});

const TAG_ICONS = { PHYSICAL: Hospital, VIRTUAL: Video, LAB_RESULT: FlaskConical, IMAGING: ScanLine };

// Clinical entries (visits, or anything with a diagnosis/treatment) show as full cards in the timeline.
export const toUiRecord = (r) => ({
  ...r,
  isTimelineEntry: isVisit(r) || Boolean(r.diagnosis || r.treatment),
  tag: r.typeLabel,
  tagIcon: TAG_ICONS[r.recordType] || Folder,
});

/** Most recently dated records, shaped for the Recent Activity card. */
export const recentActivity = (records, count = 3) =>
  [...records]
    .sort((a, b) => new Date(b.dateIso) - new Date(a.dateIso))
    .slice(0, count)
    .map((r) => ({
      icon: CloudUpload,
      title: `${r.recordType === "OTHER" ? "Record" : r.typeLabel} added`,
      sub: [r.title, r.facility].filter(Boolean).join(" · "),
      time: r.date,
    }));
