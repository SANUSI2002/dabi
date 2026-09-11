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
};
