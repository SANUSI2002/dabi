import type { useEmr } from "@/store/useEmr";
import type { Asset, MaintenanceJob } from "@/data/assets";
import type { Ward, Bed } from "@/data/wards";

type Emr = ReturnType<typeof useEmr.getState>;

export type EmrSnapshot = Pick<
  Emr,
  | "patients"
  | "queue"
  | "encounters"
  | "labOrders"
  | "admissions"
  | "appointments"
  | "referrals"
  | "transfers"
  | "ancRecords"
  | "fpClients"
  | "childVisits"
  | "deliveries"
  | "birthRegister"
  | "immunizations"
  | "pncVisits"
  | "cmamScreenings"
  | "outreachActivities"
  | "surveillanceCases"
  | "ncdClients"
  | "patientById"
> & {
  assets: Asset[];
  maintenanceJobs: MaintenanceJob[];
  wards: Ward[];
  beds: Bed[];
  /** Live hospitals: the formulary with stock on hand (otherwise the demo drug list). */
  drugs?: { name: string; form: string; stock: number; reorder: number }[];
  /** Live hospitals: the EMR audit trail (otherwise the demo trail). */
  auditEvents?: import("@/data/types").AuditEvent[];
  /** Live hospitals: register totals counted by the server (the snapshot names only the people in its records). */
  registry?: { total: number; consentYes: number; consentNo: number; consentUnknown: number };
};
