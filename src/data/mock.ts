import type {
  Patient,
  QueueEntry,
  Encounter,
  LabOrder,
  Admission,
  Appointment,
  DrugStock,
  StaffMember,
  Referral,
  AncRecord,
  FpClient,
  ChildVisit,
  AuditEvent,
} from "./types";

const iso = (daysAgo: number, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const FACILITY = {
  name: "Sabi Health Post",
  code: "PHC-SABI-014",
  lga: "Amuwo-Odofin",
  state: "Lagos",
};

export const CURRENT_USER = {
  name: "Dr. Adaeze Okonjo",
  username: "adaeze.okonjo",
  role: "Medical Officer",
};

export const patients: Patient[] = [
  { id: "p1", mrn: "PHC-SABI-014-26-000034", firstName: "Chizaram", lastName: "Ajakarom", sex: "M", dob: iso(210), phone: "0803 555 0034", address: "27 Kirikiri Road, Lagos", lga: "Amuwo-Odofin", state: "Lagos", ward: "Kirikiri", category: "U5", payer: "Out of Pocket", bloodGroup: "O+", allergies: "NKA", nextOfKin: "Chinasa Ajakarom", nokPhone: "0803 555 0090", registeredAt: iso(6) },
  { id: "p2", mrn: "PHC-SABI-014-26-000033", firstName: "Timothy", lastName: "Amos", sex: "M", dob: iso(730), address: "10 Cardoso Street, Kirikiri, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", bloodGroup: "B+", allergies: "NKA", registeredAt: iso(6) },
  { id: "p3", mrn: "PHC-SABI-014-26-000032", firstName: "Oluchi", lastName: "Dikeocha", sex: "F", dob: iso(30 * 365 + 40), phone: "0901 432 0754", address: "Ewupe Estate, Sango, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "GEN", payer: "NHIS", bloodGroup: "A+", allergies: "Penicillin", registeredAt: iso(7) },
  { id: "p4", mrn: "PHC-SABI-014-26-000031", firstName: "Favour", lastName: "Malomo", sex: "F", dob: iso(9 * 365), address: "45 Ojo Quarters, Kirikiri, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", registeredAt: iso(6) },
  { id: "p5", mrn: "PHC-SABI-014-26-000030", firstName: "Benard", lastName: "Owusu", sex: "M", dob: iso(365 + 20), address: "20 Sholaru Street, Kirikiri", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", allergies: "NKA", registeredAt: iso(6) },
  { id: "p6", mrn: "PHC-SABI-014-26-000029", firstName: "Zoe", lastName: "Amissah", sex: "M", dob: iso(3 * 365), address: "—", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", registeredAt: iso(5) },
  { id: "p7", mrn: "PHC-SABI-014-26-000028", firstName: "Victoria", lastName: "Atayero", sex: "F", dob: iso(3 * 365 + 100), address: "—", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", registeredAt: iso(5) },
  { id: "p8", mrn: "PHC-SABI-014-26-000027", firstName: "Mariam", lastName: "Abdullahi", sex: "F", dob: iso(30), address: "—", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", registeredAt: iso(5) },
  { id: "p9", mrn: "PHC-SABI-014-26-000026", firstName: "Al-amin", lastName: "Isah", sex: "M", dob: iso(3 * 365 + 43), address: "—", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Out of Pocket", registeredAt: iso(5) },
  { id: "p10", mrn: "PHC-SABI-014-26-000025", firstName: "Baby", lastName: "Lawal", sex: "F", dob: iso(180), address: "20 Magbasa Street, Kirikiri", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Government Scheme", registeredAt: iso(5) },
  { id: "p11", mrn: "PHC-SABI-014-26-000020", firstName: "Joy", lastName: "Obi Chinazaepere", sex: "F", dob: iso(210), address: "1 Bram Street, Ajegunle, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Government Scheme", allergies: "NKA", registeredAt: iso(12) },
  { id: "p12", mrn: "PHC-SABI-014-26-000019", firstName: "Chiedozie", lastName: "Ikenna", sex: "M", dob: iso(15 * 30), address: "16 Magbasa Street, Kirikiri, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "U5", payer: "Government Scheme", registeredAt: iso(12) },
  { id: "p13", mrn: "PHC-SABI-014-26-000010", firstName: "Caroline", lastName: "Patrick", sex: "F", dob: iso(45 * 365), phone: "0805 200 4212", address: "2 Iyana School Road, Kirikiri, Lagos", lga: "Amuwo-Odofin", state: "Lagos", category: "ANC", payer: "Out of Pocket", bloodGroup: "O+", allergies: "NKA", registeredAt: iso(40) },
  { id: "p14", mrn: "PHC-SABI-014-26-000009", firstName: "Kelechi", lastName: "Christopher", sex: "F", dob: iso(29 * 365), address: "12 Alaba Road, Ojo, Lagos", lga: "Ojo", state: "Lagos", category: "ANC", payer: "NHIS", bloodGroup: "AB+", registeredAt: iso(41) },
  { id: "p15", mrn: "PHC-SABI-014-26-000007", firstName: "Wadam", lastName: "Moses", sex: "F", dob: iso(33 * 365), address: "5 Trinity Close, Kirikiri", lga: "Amuwo-Odofin", state: "Lagos", category: "GEN", payer: "Out of Pocket", registeredAt: iso(55) },
];

export const queue: QueueEntry[] = [
  { id: "q1", patientId: "p11", station: "Consultation", priority: "Normal", complaint: "Fever for 2 days, poor feeding", status: "In Progress", assignedTo: CURRENT_USER.name, enqueuedAt: iso(0, 8, 40), waitMins: 22 },
  { id: "q2", patientId: "p12", station: "Vital", priority: "Normal", complaint: "Cough, catarrh", status: "Waiting", enqueuedAt: iso(0, 9, 2), waitMins: 8 },
  { id: "q3", patientId: "p3", station: "Lab", priority: "Urgent", complaint: "Recheck FBS", status: "Waiting", enqueuedAt: iso(0, 9, 12), waitMins: 5 },
  { id: "q4", patientId: "p13", station: "ANC", priority: "Normal", complaint: "Routine ANC visit", status: "Waiting", enqueuedAt: iso(0, 9, 15), waitMins: 3 },
];

export const encounters: Encounter[] = [
  {
    id: "e1", patientId: "p13", date: iso(33, 12, 57), provider: CURRENT_USER.name,
    complaint: "Fever, vomiting, cough, generalised body pain", examination: "Ill-looking, febrile (38.6°C), chest clear",
    assessment: "Uncomplicated malaria", plan: "ACT 6 tabs, PCM, ORS. Review in 3 days.",
    diagnoses: [{ code: "1F40", name: "Malaria, uncomplicated" }],
    prescriptions: [
      { id: "rx1", drug: "Artemether/Lumefantrine 20/120mg", dose: "4 tabs", frequency: "BD", duration: "3 days", qty: 24, status: "Dispensed" },
      { id: "rx2", drug: "Paracetamol 500mg", dose: "2 tabs", frequency: "TDS", duration: "3 days", qty: 18, status: "Dispensed" },
    ],
    labs: ["Malaria RDT", "PCV"], station: "Consultation",
  },
  {
    id: "e2", patientId: "p6", date: iso(6, 10, 12), provider: CURRENT_USER.name,
    complaint: "Fever, stooling, vomiting, loss of appetite", examination: "Mildly dehydrated, active",
    assessment: "Acute gastroenteritis with some dehydration", plan: "ORS, zinc, Metronidazole suspension. Safety-net advice.",
    diagnoses: [{ code: "1A00", name: "Acute watery diarrhoea" }],
    prescriptions: [{ id: "rx3", drug: "ORS sachet", dose: "1 sachet", frequency: "PRN", duration: "3 days", qty: 6, status: "Dispensed" }],
    labs: ["Malaria RDT"], station: "Consultation",
  },
];

export const labOrders: LabOrder[] = [
  { id: "l1", patientId: "p13", test: "Malaria RDT", category: "Parasitology", urgency: "Routine", status: "Pending", orderedAt: iso(0, 9, 5), orderedBy: CURRENT_USER.name },
  { id: "l2", patientId: "p13", test: "PCV", category: "Haematology", urgency: "Routine", status: "Pending", orderedAt: iso(0, 9, 5), orderedBy: CURRENT_USER.name },
  { id: "l3", patientId: "p13", test: "Urinalysis", category: "Urinalysis", urgency: "Routine", status: "Pending", orderedAt: iso(0, 9, 5), orderedBy: CURRENT_USER.name },
  { id: "l4", patientId: "p3", test: "Fasting Blood Sugar", category: "Clinical Chemistry", urgency: "Urgent", status: "Sample Collected", orderedAt: iso(1, 8, 30), orderedBy: CURRENT_USER.name },
];

export const admissions: Admission[] = [];

export const appointments: Appointment[] = [
  { id: "a1", patientId: "p13", date: iso(-2), time: "10:00", provider: CURRENT_USER.name, type: "ANC", reason: "Follow-up ANC", status: "Scheduled" },
  { id: "a2", patientId: "p3", date: iso(-4), time: "09:30", provider: CURRENT_USER.name, type: "Follow-up", reason: "Diabetes review", status: "Scheduled" },
  { id: "a3", patientId: "p5", date: iso(-1), time: "11:15", provider: "Nurse Grace Nwangbo", type: "Immunization", reason: "Penta 2", status: "Scheduled" },
];

export const drugs: DrugStock[] = [
  { id: "d1", name: "Artemether/Lumefantrine", form: "Tablet", strength: "20/120mg", klass: "Antimalarial", batches: 3, stock: 240, reorder: 50 },
  { id: "d2", name: "Paracetamol", form: "Tablet", strength: "500mg", klass: "Analgesic", batches: 4, stock: 1200, reorder: 200 },
  { id: "d3", name: "Amoxicillin", form: "Capsule", strength: "500mg", klass: "Antibiotic", batches: 2, stock: 36, reorder: 60 },
  { id: "d4", name: "ORS", form: "Sachet", strength: "—", klass: "Other", batches: 1, stock: 8, reorder: 50 },
  { id: "d5", name: "Amlodipine", form: "Tablet", strength: "5mg", klass: "Antihypertensive", batches: 2, stock: 90, reorder: 30 },
  { id: "d6", name: "Metformin", form: "Tablet", strength: "500mg", klass: "Antidiabetic", batches: 1, stock: 0, reorder: 40 },
  { id: "d7", name: "Ferrous + Folic Acid", form: "Tablet", strength: "200mg", klass: "Vitamin & Supplement", batches: 3, stock: 500, reorder: 100 },
  { id: "d8", name: "DMPA (Depo-Provera)", form: "Injection", strength: "150mg", klass: "Family Planning", batches: 1, stock: 12, reorder: 10 },
  { id: "d9", name: "Zinc Sulphate", form: "Tablet", strength: "20mg", klass: "Vitamin & Supplement", batches: 2, stock: 300, reorder: 80 },
  { id: "d10", name: "Cough Expectorant", form: "Syrup", strength: "100ml", klass: "Respiratory", batches: 0, stock: 0, reorder: 50 },
];

export const staff: StaffMember[] = [
  { id: "s1", name: "Dr. Adaeze Okonjo", role: "Medical Officer", cadre: "MO II", phone: "0803 111 2233", email: "adaeze.okonjo@sabi.health", hireDate: iso(600), license: "MDCN/78421", status: "Active" },
  { id: "s2", name: "Nurse Grace Nwangbo", role: "Nurse", cadre: "Senior Nurse", phone: "0806 220 1188", hireDate: iso(900), license: "NMCN/55231", status: "Active" },
  { id: "s3", name: "Mary Williams", role: "Nurse", cadre: "Nursing Officer", hireDate: iso(410), license: "NMCN/66120", status: "Active" },
  { id: "s4", name: "Ogundele Olajumoke", role: "Health Records Officer", cadre: "HRO", hireDate: iso(300), status: "Active" },
  { id: "s5", name: "Abisola Adedokun", role: "Community Health Worker", cadre: "CHEW", hireDate: iso(220), status: "Active" },
  { id: "s6", name: "Folashade Adeniyi", role: "M&E / HMIS Officer", cadre: "MRO", hireDate: iso(150), status: "Active" },
  { id: "s7", name: "Samuel Etim", role: "Lab Technician", cadre: "MLS", hireDate: iso(500), license: "MLSCN/22981", status: "Active" },
  { id: "s8", name: "Stella Okon", role: "Receptionist", cadre: "—", hireDate: iso(120), status: "Active" },
];

export const referrals: Referral[] = [
  { id: "r1", patientId: "p6", type: "Out", diagnosis: "Suspected surgical abdomen", facility: "General Hospital, Amuwo", reason: "Complicated Cases", urgency: "Urgent", status: "Open", date: iso(6), referredBy: CURRENT_USER.name },
  { id: "r2", patientId: "p3", type: "Out", diagnosis: "Poorly controlled hypertension", facility: "General Hospital, Amuwo", reason: "Specialist Care", urgency: "Routine", status: "Acknowledged", date: iso(12), referredBy: CURRENT_USER.name },
  {
    id: "r3", patientId: "p13", type: "Out", diagnosis: "Severe pre-eclampsia — for obstetric review", facility: "LASUTH, Ikeja", reason: "Complicated Cases", urgency: "Emergency", status: "Completed", date: iso(20), referredBy: CURRENT_USER.name,
    feedback: { outcome: "Treated & discharged", note: "BP controlled on labetalol + nifedipine. Delivered at term. Continue BP monitoring at PHC; review in 1 week.", by: "Dr. Bello (O&G, LASUTH)", at: iso(9), backReferral: true },
  },
];

export const immunizations: import("./types").Immunization[] = [
  { id: "im1", patientId: "p1", vaccineCode: "BCG", vaccineName: "Bacillus Calmette–Guérin (BCG)", givenAt: iso(200), givenBy: "Nurse Grace Nwangbo", batchNo: "BCG-2451", site: "Left deltoid" },
  { id: "im2", patientId: "p1", vaccineCode: "OPV0", vaccineName: "Oral Polio Vaccine (OPV 0)", givenAt: iso(200), givenBy: "Nurse Grace Nwangbo", batchNo: "OPV-8830", site: "Mouth" },
  { id: "im3", patientId: "p1", vaccineCode: "PENTA1", vaccineName: "Pentavalent Vaccine (Dose 1)", givenAt: iso(160), givenBy: "Nurse Grace Nwangbo", batchNo: "PENTA-1120", site: "Left outer thigh",
    aefi: { symptoms: "Mild fever and injection-site swelling for 24h", severity: "Non-serious", onsetHours: 6, action: "Paracetamol, cold compress, advised follow-up", reportedAt: iso(159), reportedBy: "Nurse Grace Nwangbo" } },
  { id: "im4", patientId: "p11", vaccineCode: "BCG", vaccineName: "Bacillus Calmette–Guérin (BCG)", givenAt: iso(205), givenBy: "Mary Williams", batchNo: "BCG-2451", site: "Left deltoid" },
  { id: "im5", patientId: "p10", vaccineCode: "PENTA1", vaccineName: "Pentavalent Vaccine (Dose 1)", givenAt: iso(140), givenBy: "Mary Williams", batchNo: "PENTA-1120", site: "Left outer thigh" },
];

export const transfers: import("./types").PatientTransfer[] = [
  { id: "pt1", direction: "Out", patientId: "p6", patientName: "Zoe Amissah", facility: "PHC Kirikiri", reason: "Relocation", summary: "Hypertensive, on amlodipine 10mg. Full EMR summary attached.", date: iso(5), status: "Pending", recordsSent: false },
  { id: "pt2", direction: "In", patientName: "Ibrahim Sule", facility: "PHC Festac 7", reason: "Catchment reassignment", summary: "Diabetic, last HbA1c 8.1%. Paper records received.", date: iso(11), status: "Completed", completedAt: iso(10), handledBy: "Ogundele Olajumoke", recordsSent: true },
  { id: "pt3", direction: "Out", patientId: "p3", patientName: "Oluchi Dikeocha", facility: "General Hospital, Amuwo", reason: "Higher level of care", summary: "For endocrinology follow-up; continues metformin.", date: iso(2), status: "Pending", recordsSent: true },
];

export const ancRecords: AncRecord[] = [
  {
    id: "anc1", patientId: "p13", lmp: iso(160), edd: iso(-120), gravida: 1, para: 0, bloodGroup: "O+", hb: 10.8, ttDoses: 1,
    status: "Active",
    visits: [
      { date: iso(33), weeks: 19, weight: 89, bp: "138/78", hb: 10.8, fhr: 140, next: iso(-6) },
    ],
  },
  {
    id: "anc2", patientId: "p14", lmp: iso(185), edd: iso(-95), gravida: 3, para: 2, bloodGroup: "AB+", hb: 11.4, ttDoses: 2,
    status: "Active",
    visits: [{ date: iso(33), weeks: 22, weight: 62, bp: "118/78", hb: 11.4, fhr: 148, next: iso(-8) }],
  },
];

export const fpClients: FpClient[] = [
  { id: "fp1", patientId: "p15", method: "Injectable (DMPA-IM)", firstTime: false, startDate: iso(140), nextVisit: iso(6), counselled: true, status: "Active", notes: "Tolerating well.",
    visits: [
      { date: iso(140), type: "New Visit", method: "Injectable (DMPA-IM)", nextVisit: iso(56), notes: "Started DMPA", by: "Nurse Grace Nwangbo" },
      { date: iso(56), type: "Resupply", method: "Injectable (DMPA-IM)", nextVisit: iso(6), notes: "2nd dose, no side effects", by: "Nurse Grace Nwangbo" },
    ] },
  { id: "fp2", patientId: "p15", method: "Oral Pill", firstTime: false, startDate: iso(20), counselled: true, status: "Discontinued", notes: "Menses ceased — switched method.", discontinueReason: "Switched to injectable" },
];

export const deliveries: import("./types").Delivery[] = [
  { id: "dl1", patientId: "p13", date: iso(4), mode: "SVD", gaWeeks: 39, motherStatus: "Alive", bloodLoss: 250, babySex: "F", babyStatus: "Alive", weight: 3.2, apgar1: 8, apgar5: 10, breastfed1h: true, conductedBy: "Nurse Grace Nwangbo" },
  { id: "dl2", patientId: "p15", date: iso(12), mode: "SVD", gaWeeks: 38, motherStatus: "Alive", bloodLoss: 300, babySex: "M", babyStatus: "Alive", weight: 2.9, apgar1: 9, apgar5: 10, breastfed1h: true, conductedBy: "Mary Williams" },
  { id: "dl3", patientId: "p6", date: iso(30), mode: "Assisted (vacuum)", gaWeeks: 40, motherStatus: "Alive", bloodLoss: 400, babySex: "F", babyStatus: "Alive", weight: 3.5, apgar1: 7, apgar5: 9, breastfed1h: false, conductedBy: "Nurse Grace Nwangbo" },
];

export const pncVisits: import("./types").PncVisit[] = [
  { id: "pnc1", patientId: "p15", deliveryId: "dl2", contact: 1, date: iso(11), timing: "PNC 1 — within 24h", daysPP: 1, bp: "118/76", uterus: "Well contracted", lochia: "Normal", breast: "Normal", breastfeeding: "Exclusive", dangerSigns: [], fpCounselled: true },
  { id: "pnc2", patientId: "p15", deliveryId: "dl2", contact: 2, date: iso(9), timing: "PNC 2 — day 3", daysPP: 3, bp: "120/78", uterus: "Well contracted", lochia: "Normal", breast: "Normal", breastfeeding: "Exclusive", dangerSigns: [], fpCounselled: true },
  { id: "pnc3", patientId: "p6", deliveryId: "dl3", contact: 1, date: iso(29), timing: "PNC 1 — within 24h", daysPP: 1, bp: "126/82", uterus: "Well contracted", lochia: "Normal", breast: "Engorged", breastfeeding: "Mixed", dangerSigns: ["Jaundice"], fpCounselled: false, notes: "Neonatal jaundice — reviewed, phototherapy advice, follow-up 48h" },
];

export const childVisits: ChildVisit[] = [
  { id: "cv1", patientId: "p5", date: iso(6), weight: 8.4, height: 74, muac: 13.2, waz: -0.8, status: "Normal", feeding: "Complementary + breast" },
  { id: "cv2", patientId: "p2", date: iso(6), weight: 9.1, height: 78, muac: 12.9, waz: -1.4, status: "MAM", feeding: "Family diet" },
];

export const outreachSeed = [
  {
    id: "o1", chw: "Abisola Adedokun", type: "Household visit", ward: "Kirikiri",
    households: 12, referrals: 2, date: iso(2),
  },
];

export const ncdSeed = [
  {
    id: "n1", patientId: "p3", condition: "Type 2 Diabetes Mellitus", enrolledAt: iso(120),
    bp: "128/82", fbs: 7.8, control: "Uncontrolled" as const, nextVisit: iso(-14),
  },
];

export const invoiceSeed = [
  {
    id: "inv1", number: "INV-26-004011", patientId: "p3", payer: "NHIS" as const, category: "NHIS",
    lines: [{ code: "CONS", name: "General Consultation", qty: 1, unitPrice: 500 }, { code: "FASTBS", name: "Fasting Blood Sugar", qty: 1, unitPrice: 1000 }],
    exempt: true, createdAt: iso(1, 9, 20), status: "Waived" as const, method: "NHIS" as const, paidAt: iso(1, 9, 20),
  },
  {
    id: "inv2", number: "INV-26-004010", patientId: "p15", payer: "Out of Pocket" as const, category: "GEN",
    lines: [{ code: "CONS", name: "General Consultation", qty: 1, unitPrice: 500 }, { code: "INJECT", name: "Injection / IM", qty: 1, unitPrice: 300 }],
    exempt: false, createdAt: iso(2, 10, 5), status: "Paid" as const, method: "Cash" as const, paidAt: iso(2, 10, 12),
  },
  {
    id: "inv3", number: "INV-26-004009", patientId: "p13", payer: "Out of Pocket" as const, category: "ANC",
    lines: [{ code: "ANC", name: "Antenatal Care Visit", qty: 1, unitPrice: 0 }],
    exempt: true, createdAt: iso(33, 12, 0), status: "Waived" as const, method: "Waiver" as const, paidAt: iso(33, 12, 0),
  },
];

export const auditTrail: AuditEvent[] = Array.from({ length: 24 }).map((_, i) => ({
  id: "ev" + i,
  ts: iso(0, 11, 54 - i * 2),
  user: CURRENT_USER.name,
  role: "Medical Officer",
  action: ["VIEWED REPORT", "CREATED ENCOUNTER", "DISPENSED DRUG", "UPDATED PATIENT", "ADDED TO QUEUE", "LOGGED IN"][i % 6],
  resource: ["report/dashboard", "encounter/e1", "pharmacy/rx1", "patient/p13", "queue/q3", "auth/session"][i % 6],
  ip: "102.89.34.1" + (i % 9),
}));

export const monthlyTargets = [
  { label: "OPD Visits", value: 128, target: 500 },
  { label: "ANC Visits", value: 46, target: 120 },
  { label: "Immunizations", value: 92, target: 200 },
  { label: "Lab Tests", value: 71, target: 180 },
  { label: "Deliveries", value: 6, target: 20 },
];

export const patientFlow = [
  { date: "Mon", queued: 14, seen: 12, referred: 1 },
  { date: "Tue", queued: 22, seen: 20, referred: 2 },
  { date: "Wed", queued: 18, seen: 17, referred: 0 },
  { date: "Thu", queued: 11, seen: 11, referred: 1 },
  { date: "Fri", queued: 26, seen: 24, referred: 3 },
  { date: "Sat", queued: 9, seen: 9, referred: 0 },
];

export const utilization = [
  { module: "Immunization", entries: 13 },
  { module: "Consultation", entries: 12 },
  { module: "Pharmacy", entries: 9 },
  { module: "Laboratory", entries: 7 },
  { module: "ANC", entries: 6 },
  { module: "Family Planning", entries: 2 },
];

export const topDiagnoses = [
  { name: "Malaria, uncomplicated", cases: 34 },
  { name: "Upper respiratory infection", cases: 21 },
  { name: "Acute watery diarrhoea", cases: 15 },
  { name: "Hypertension", cases: 9 },
  { name: "Peptic ulcer disease", cases: 7 },
];
