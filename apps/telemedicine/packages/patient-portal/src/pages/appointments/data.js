import { CalendarCheck2, CheckCircle2, Video, CalendarClock } from "lucide-react";

// Stat cards for the Appointments page. Values are counted from live appointments.
export const APPOINTMENT_STATS = [
  { icon: CalendarCheck2, label: "Upcoming" },
  { icon: CheckCircle2, label: "Completed" },
  { icon: Video, label: "Missed Out" },
  { icon: CalendarClock, label: "Pending" },
];

// Each tab maps to a state the live API produces (see byDoctor in api/doctorsApi.js).
export const FILTER_TABS = ["Upcoming", "Awaiting confirmation", "Completed", "Missed", "Cancelled"];
