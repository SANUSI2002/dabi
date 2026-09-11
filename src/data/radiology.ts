// Frontend-only imaging workflow, modelled Patient -> Study -> Series -> Report
// (a DICOM-compatible mental model). There is no PACS/DICOM viewer integration —
// the UI says so plainly rather than fabricating one.

export type ImagingModality = "X-ray" | "Ultrasound" | "CT" | "MRI" | "Mammography" | "Fluoroscopy";
export type ImagingStatus = "Requested" | "Scheduled" | "Performed" | "Reported" | "Verified" | "Amended" | "Cancelled";

export const IMAGING_MODALITIES: ImagingModality[] = ["X-ray", "Ultrasound", "CT", "MRI", "Mammography", "Fluoroscopy"];
export const IMAGING_STATUS_ORDER: ImagingStatus[] = ["Requested", "Scheduled", "Performed", "Reported", "Verified"];

export type ImagingSeries = {
  id: string;
  seriesNumber: number;
  description: string;
  bodyPart: string;
  imageCount?: number;
};

export type ReportAddendum = { by: string; at: string; note: string };

export type ImagingReport = {
  findings: string;
  impression: string;
  author: string;
  authoredAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  addenda?: ReportAddendum[];
};

export type ImagingStudy = {
  id: string;
  patientId: string;
  accessionNumber: string;
  modality: ImagingModality;
  bodySite: string;
  laterality?: "Left" | "Right" | "Bilateral" | "N/A";
  indication: string;
  priority: "Routine" | "Urgent" | "Emergency";
  preparation?: string;
  requestedBy: string;
  requestedAt: string;
  status: ImagingStatus;
  scheduledFor?: string;
  performedAt?: string;
  series: ImagingSeries[];
  report?: ImagingReport;
  /** id of a prior study of the same body site, for comparison */
  compareToStudyId?: string;
  /** performed at another facility — only referenced here, no local images */
  externalStudy?: boolean;
  cancelledReason?: string;
};

const daysAgo = (n: number, h = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(h, 0, 0, 0);
  return date.toISOString();
};

export const seedImagingStudies: ImagingStudy[] = [
  {
    id: "img-1", patientId: "p3", accessionNumber: "ACC-2026-000041",
    modality: "X-ray", bodySite: "Chest", laterality: "N/A", indication: "Chronic cough, rule out consolidation",
    priority: "Routine", requestedBy: "Dr. Adaeze Okonjo", requestedAt: daysAgo(20),
    status: "Verified", scheduledFor: daysAgo(19), performedAt: daysAgo(19),
    series: [{ id: "ser-1", seriesNumber: 1, description: "PA chest", bodyPart: "Chest", imageCount: 1 }],
    report: {
      findings: "Lung fields clear. No focal consolidation, effusion or pneumothorax. Cardiac silhouette normal size.",
      impression: "No acute cardiopulmonary abnormality.",
      author: "Dr. Adaeze Okonjo", authoredAt: daysAgo(18), verifiedBy: "Dr. Adaeze Okonjo", verifiedAt: daysAgo(18),
    },
  },
  {
    id: "img-2", patientId: "p13", accessionNumber: "ACC-2026-000058",
    modality: "Ultrasound", bodySite: "Obstetric — gravid uterus", laterality: "N/A",
    indication: "Routine second-trimester dating and anomaly scan", priority: "Routine",
    preparation: "Full bladder", requestedBy: "Nurse Grace Nwangbo", requestedAt: daysAgo(2),
    status: "Requested", series: [],
  },
];
