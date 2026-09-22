import { colors } from "design-system";
import { CalendarCheck2, CheckCircle2, Video, CalendarClock } from "lucide-react";

// Placeholder content for the Appointments page.
// Swap these for real API data when wiring the page up.

export const APPOINTMENT_STATS = [
  { icon: CalendarCheck2, value: 3, label: "Upcoming" },
  { icon: CheckCircle2, value: 42, label: "Completed" },
  { icon: Video, value: 12, label: "Missed Out" },
  { icon: CalendarClock, value: 1, label: "Pending" },
];

export const FILTER_TABS = ["Upcoming",  "Completed", "Cancelled", "Request", "Follow-ups"];

// A small static calendar for the demo — October 2023, Monday-first weeks.
// `muted` days belong to the adjacent month; `dot` marks a day with an
// appointment; `id` (when present) is the day that's currently selected.


export const UPCOMING_APPOINTMENTS = [
  {
    id: "apt-sarah-miller",
    doctor: "Dr. Sarah Miller",
    initials: "SM",
    color: colors.primary,
    specialty: "Cardiology Specialist",
    location: "St. Jude Medical Center",
    lat: 6.5244,
    lng: 3.3792,
    date: "Oct 25, 2023",
    time: "10:00 AM",
    status: "active",
    virtual: true,
  },
  {
    id: "apt-james-wilson",
    doctor: "Dr. James Wilson",
    initials: "JW",
    color: colors.warning,
    specialty: "General Practitioner",
    location: "Central Wellness Clinic",
    lat: 6.5355,
    lng: 3.3087,
    date: "Oct 28, 2023",
    time: "02:30 PM",
    virtual: false,
  },
  {
    id: "apt-elena-rodriguez",
    doctor: "Dr. Elena Rodriguez",
    initials: "ER",
    color: colors.danger,
    specialty: "Dermatology",
    location: "Skin & Aesthetic Lab",
    lat: 6.6018,
    lng: 3.3515,
    date: "Nov 02, 2023",
    time: "09:15 AM",
    virtual: false,
  },
];

export const NEARBY_HEALTHCARE = [
  { name: "City General Hospital", distance: "0.8 miles away", tags: ["24/7 ER", "Radiology"], lat: 6.5244, lng: 3.3792 },
  { name: "Wellness Family Care", distance: "1.2 miles away", tags: ["Pediatrics", "Pharmacy"], lat: 6.5355, lng: 3.3087 },
  { name: "Metro Cardiac Institute", distance: "2.5 miles away", tags: ["ICU", "Specialist"], lat: 6.5102, lng: 3.3914 },
  { name: "North View Specialty", distance: "3.1 miles away", tags: ["Dental", "Derm"], lat: 6.5482, lng: 3.3651 },
];

export const RESCHEDULE_SLOTS = [
  "08:00 AM", "09:00 AM", "10:00 AM",
  "11:00 AM", "12:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM",
];

export const BOOKING_DOCTORS = [
  { id: "dr-sarah-miller", name: "Dr. Sarah Miller", specialty: "Cardiology Specialist", location: "St. Jude Medical Center", lat: 6.5244, lng: 3.3792 },
  { id: "dr-james-wilson", name: "Dr. James Wilson", specialty: "General Practitioner", location: "Central Wellness Clinic", lat: 6.5355, lng: 3.3087 },
  { id: "dr-elena-rodriguez", name: "Dr. Elena Rodriguez", specialty: "Dermatology", location: "Skin & Aesthetic Lab", lat: 6.6018, lng: 3.3515 },
  { id: "dr-adaeze-nwosu", name: "Dr. Adaeze Nwosu", specialty: "Internal Medicine", location: "Lagos Teaching Hospital", lat: 6.5244, lng: 3.3792 },
];
