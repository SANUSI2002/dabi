import type { useEmr } from "@/store/useEmr";
import type { Asset, MaintenanceJob } from "@/data/assets";

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
  | "pncVisits"
  | "cmamScreenings"
  | "outreachActivities"
  | "surveillanceCases"
  | "ncdClients"
  | "patientById"
> & {
  assets: Asset[];
  maintenanceJobs: MaintenanceJob[];
};
