import { DOCTOR_PROFILE } from "../data/doctorProfile.js";
import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
export const PROFILE_SEED = {
  identity: { name: DOCTOR_PROFILE.name, photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=360&q=85", professionalTitle: DOCTOR_PROFILE.specialty, languages: "English, Yoruba, French", verified: true },
  visibility: true,
  bio: "Dedicated Consultant Pediatrician with over 12 years of experience providing comprehensive medical care for infants, children, and adolescents. Specializing in preventive care, developmental pediatrics, and managing chronic childhood illnesses. Committed to delivering compassionate, patient-centered care while working closely with families to ensure optimal health outcomes.",
  specialties: { primary: ["Pediatrics"], topics: ["Neonatology", "Asthma Management", "Developmental Pediatrics"] },
  statistics: { experience: "12+", rating: "4.9", reviews: 142, patientsTreated: "3,204" },
  fees: [{ id: "virtual", type: "Virtual Visit", duration: "15–30 mins", amount: 15000 }, { id: "in-person", type: "In-Person Visit", duration: "30–45 mins", amount: 25000 }],
  credentials: [{ id: "license", type: "MDCN License", detail: "MDCN/2012/8493", icon: "license", status: "verified" }, { id: "degree", type: "MBBS, Medicine & Surgery", detail: "University of Ibadan, 2012", icon: "degree", status: "verified" }, { id: "fellowship", type: "Fellowship (FMC Paed)", detail: "National Postgraduate Medical College, 2018", icon: "award", status: "verified" }],
  locations: [{ id: "jenkins", name: "Jenkins Pediatrics Clinic (Private Practice)", address: "14 Admiralty Way, Lekki Phase 1, Lagos", days: "Mon–Wed", hours: "9:00 AM – 4:00 PM", type: "clinic" }, { id: "st-jude", name: "St. Jude Medical Center", address: "45 Broad Street, Lagos Island, Lagos", days: "Thu–Fri", hours: "8:00 AM – 2:00 PM", type: "hospital" }],
};

const store = createScopedStore({ key: "sabi-doctor-profile", seed: () => ({ ...PROFILE_SEED, ...(getDoctorId() === PRIMARY_DOCTOR_ID ? {} : { bio: "", credentials: [], locations: [], statistics: { experience: "0", rating: "0", reviews: 0, patientsTreated: "0" } }), identity: { ...PROFILE_SEED.identity, name: getCurrentDoctor().name, professionalTitle: getCurrentDoctor().specialty }, specialties: { primary: [getCurrentDoctor().specialty], topics: [] } }), validate: (v) => !!v?.identity && !!v.specialties && Array.isArray(v.fees) && Array.isArray(v.credentials) && Array.isArray(v.locations), normalize: (v) => ({ ...v, identity: { ...v.identity, name: getCurrentDoctor().name } }) });
export const getProfile = store.get;
export const subscribeToProfile = store.subscribe;
export function updateProfile(patch) { const next = store.write({ ...getProfile(), ...patch }); store.notify(); return next; }
