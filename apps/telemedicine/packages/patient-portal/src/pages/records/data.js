import { Folder, Hospital, Stethoscope, FlaskConical, ScanLine, Syringe, Pill } from "lucide-react";

// Folder icons are stored by name on the server; these are the names it accepts.
export const CATEGORY_ICON_MAP = {
  folder: Folder,
  stethoscope: Stethoscope,
  flask: FlaskConical,
  scan: ScanLine,
  syringe: Syringe,
  pill: Pill,
  hospital: Hospital,
};

export const CATEGORY_ICON_CHOICES = Object.keys(CATEGORY_ICON_MAP);

export const categoryIcon = (name) => CATEGORY_ICON_MAP[name] || Folder;
