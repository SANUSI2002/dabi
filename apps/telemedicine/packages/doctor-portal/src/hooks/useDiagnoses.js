import { useSyncExternalStore } from "react";
import { getDiagnoses, subscribeToDiagnoses } from "../store/diagnosisStore";

export function useDiagnoses() {
  return useSyncExternalStore(subscribeToDiagnoses, getDiagnoses, getDiagnoses);
}
