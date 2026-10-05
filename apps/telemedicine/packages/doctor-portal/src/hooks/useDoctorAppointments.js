import { useSyncExternalStore } from "react";
import { getDoctorAppointments, subscribeToDoctorAppointments } from "../store/doctorAppointmentStore";

export function useDoctorAppointments() {
  return useSyncExternalStore(subscribeToDoctorAppointments, getDoctorAppointments, getDoctorAppointments);
}
