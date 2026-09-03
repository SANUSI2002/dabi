import type { useEmr } from "@/store/useEmr";

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
  | "ancRecords"
  | "fpClients"
  | "childVisits"
  | "deliveries"
  | "pncVisits"
  | "cmamScreenings"
  | "outreachActivities"
  | "surveillanceCases"
  | "ncdClients"
  | "patientById"
>;
