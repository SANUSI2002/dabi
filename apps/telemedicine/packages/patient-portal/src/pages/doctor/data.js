import { HeartPulse, Leaf, Smile, Stethoscope } from "lucide-react";

export const SPECIALTIES = [
  { label: "General Practice", count: "120+", icon: Stethoscope },
  { label: "Cardiology", count: "45+", icon: HeartPulse },
  { label: "Pediatrics", count: "80+", icon: Smile },
  { label: "Neurology", count: "32+", icon: Leaf },
];

const SLOT_TEMPLATE = ["09:00 AM", "10:30 AM", "01:15 PM", "03:45 PM"];

export const DOCTORS = [
  {
    id: "sarah-miller", name: "Dr. Sarah Miller", specialty: "Cardiology", experience: 12,
    clinic: "St. Jude Medical Center", clinicLat: 6.5244, clinicLng: 3.3792, distance: 4, nextAvailable: "Tomorrow, 10:00 AM",
    fee: 12000, rating: "4.9 (120)",
    photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&q=80",
    title: "Senior Cardiologist & Heart Surgeon",
    patients: "8,000+", procedures: "2,500+", awards: "15 Regional",
    about: "Believes in a holistic approach to cardiovascular health, combining minimally invasive procedures with personalized lifestyle interventions for faster recovery and long-term heart health.",
    education: "Johns Hopkins School of Medicine, Cardiology Residency",
    certifications: "Board Certified in Cardiovascular Disease & Internal Medicine",
    expertise: ["Interventional Cardiology", "Heart Failure Management", "Atrial Fibrillation", "Cardiac Imaging"],
    affiliations: [{ name: "St. Jude Medical Center", role: "Senior Surgeon · 2018 – Present" }, { name: "City Health Clinic", role: "Consultant · 2014 – 2018" }],
    slots: SLOT_TEMPLATE,
  },
  {
    id: "james-wilson", name: "Dr. James Wilson", specialty: "General Practice", experience: 15,
    clinic: "City Health Clinic", clinicLat: 6.5355, clinicLng: 3.3087, distance: 2, nextAvailable: "Today, 04:30 PM",
    fee: 8500, rating: "4.8 (245)",
    photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&q=80",
    title: "Lead General Practitioner",
    patients: "12,000+", procedures: "3,100+", awards: "8 National",
    about: "Focuses on preventive, whole-family care — from routine check-ups to chronic condition management — with an emphasis on clear communication and long-term relationships with patients.",
    education: "University of Lagos College of Medicine",
    certifications: "Board Certified in Family Medicine",
    expertise: ["Preventive Care", "Chronic Disease Management", "Vaccinations", "Minor Procedures"],
    affiliations: [{ name: "City Health Clinic", role: "Lead Physician · 2015 – Present" }],
    slots: SLOT_TEMPLATE,
  },
  {
    id: "elena-rodriguez", name: "Dr. Elena Rodriguez", specialty: "Neurology", experience: 10,
    clinic: "Metropolitan Neuro Institute", clinicLat: 6.5102, clinicLng: 3.3914, distance: 7, nextAvailable: "Monday, 09:00 AM",
    fee: 18000, rating: "5.0 (56)",
    photo: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600&q=80",
    title: "Consultant Neurologist",
    patients: "4,200+", procedures: "900+", awards: "5 International",
    about: "Specializes in diagnosing and treating complex neurological conditions, pairing advanced imaging diagnostics with individualized long-term care plans.",
    education: "Harvard Medical School, Neurology Residency",
    certifications: "Board Certified in Neurology",
    expertise: ["Epilepsy", "Movement Disorders", "Neuro-Imaging", "Stroke Recovery"],
    affiliations: [{ name: "Metropolitan Neuro Institute", role: "Consultant · 2019 – Present" }],
    slots: SLOT_TEMPLATE,
  },
];
