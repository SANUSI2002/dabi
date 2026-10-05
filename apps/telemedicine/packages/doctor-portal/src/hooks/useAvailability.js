import { useSyncExternalStore } from "react";
import { getAvailability, subscribeToAvailability } from "../store/doctorAvailabilityStore";

export function useAvailability() {
  return useSyncExternalStore(subscribeToAvailability, getAvailability, getAvailability);
}