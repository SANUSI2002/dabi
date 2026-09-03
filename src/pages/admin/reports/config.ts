import type { EmrSnapshot } from "./types";
import {
  patientFlow, utilization, topDiagnoses, monthlyTargets, staff, auditTrail, drugs,
} from "@/data/mock";
import { OUT_REFERRAL_REASONS, NOTIFIABLE, VACCINES } from "@/data/catalog";
import { shortDate, ageFromDob } from "@/lib/format";

type Tone = "brand" | "action" | "mist" | "amber";
type Stat = { label: string; value: string | number; tone?: Tone };

export type ReportTab =
  | { name: string; kind: "table"; columns: string[]; rows: (s: EmrSnapshot) => (string | number)[][] }
  | { name: string; kind: "bars"; keys: [string, string]; data: (s: EmrSnapshot) => Record<string, string | number>[] }
  | { name: string; kind: "line"; keys: string[]; data: (s: EmrSnapshot) => Record<string, string | number>[] }
  | { name: string; kind: "kv"; rows: (s: EmrSnapshot) => { k: string; v: string | number; target?: string }[] }
  | { name: string; kind: "empty"; hint: string };

export type ReportFamily = {
  name: string;
  stats: (s: EmrSnapshot) => Stat[];
  tabs: ReportTab[];
};

const nm = (p?: { firstName: string; lastName: string }) => (p ? `${p.firstName} ${p.lastName}` : "—");

export const REPORTS: ReportFamily[] = [
  {
    name: "OPD Reports",
    stats: (s) => [
      { label: "Total Visits", value: s.encounters.length + 118, tone: "brand" },
      { label: "New", value: 88 },
      { label: "Revisit", value: 40 },
      { label: "Referrals", value: s.referrals.length, tone: "action" },
    ],
    tabs: [
      {
        name: "Daily Attendance", kind: "table",
        columns: ["Date", "New", "Revisit", "Total"],
        rows: () => patientFlow.map((d) => [d.date, d.queued - d.seen + 6, d.seen - 4, d.queued]),
      },
      {
        name: "Age & Sex", kind: "table",
        columns: ["Age group", "Male", "Female", "Total"],
        rows: () => [["0–4", 5, 3, 8], ["5–14", 4, 6, 10], ["15–49", 12, 21, 33], ["50+", 7, 9, 16]],
      },
      {
        name: "Top 10 Diagnoses", kind: "table",
        columns: ["Diagnosis", "Cases"],
        rows: () => topDiagnoses.map((d) => [d.name, d.cases]),
      },
      {
        name: "OPD Morbidity", kind: "bars", keys: ["cases", "cases"],
        data: () => topDiagnoses.map((d) => ({ label: d.name.split(",")[0], cases: d.cases })),
      },
      {
        name: "Referrals from OPD", kind: "table",
        columns: ["Patient", "Referred To", "Reason", "Status"],
        rows: (s) => s.referrals.map((r) => [nm(s.patientById(r.patientId)), r.facility, r.reason, r.status]),
      },
      {
        name: "Wait Time Analysis", kind: "table",
        columns: ["Station", "Avg wait (min)", "Max wait (min)", "Entries"],
        rows: () => [["Vital", 6, 22, 24], ["Consultation", 12, 41, 20], ["Lab", 9, 28, 11], ["Pharmacy", 14, 34, 9], ["Exit", 2, 6, 26]],
      },
    ],
  },
  {
    name: "Maternal Health",
    stats: (s) => [
      { label: "ANC Bookings", value: s.ancRecords.length, tone: "brand" },
      { label: "Total ANC Visits", value: s.ancRecords.reduce((n, r) => n + r.visits.length, 0) },
      { label: "High-risk", value: s.ancRecords.filter((r) => (r.hb ?? 12) < 10).length, tone: "action" },
      { label: "Deliveries", value: 6 },
    ],
    tabs: [
      { name: "ANC Registration", kind: "table", columns: ["Patient", "Age", "LMP", "EDD", "G / P", "Status"], rows: (s) => s.ancRecords.map((r) => [nm(s.patientById(r.patientId)), s.patientById(r.patientId) ? ageFromDob(s.patientById(r.patientId)!.dob) : "—", shortDate(r.lmp), shortDate(r.edd), `${r.gravida}/${r.para}`, r.status]) },
      { name: "ANC Visits", kind: "table", columns: ["Patient", "Visit date", "Weeks", "BP", "Hb", "FHR"], rows: (s) => s.ancRecords.flatMap((r) => r.visits.map((v) => [nm(s.patientById(r.patientId)), shortDate(v.date), v.weeks, v.bp, v.hb ?? "—", v.fhr ?? "—"])) },
      { name: "High-Risk", kind: "table", columns: ["Patient", "Risk factor", "Hb", "Action"], rows: (s) => s.ancRecords.filter((r) => (r.hb ?? 12) < 10).map((r) => [nm(s.patientById(r.patientId)), "Anaemia in pregnancy", r.hb ?? "—", "Iron + folate, review 2 weeks"]) },
      { name: "TT Coverage", kind: "table", columns: ["Patient", "TT doses", "Status"], rows: (s) => s.ancRecords.map((r) => [nm(s.patientById(r.patientId)), `${r.ttDoses}/5`, r.ttDoses >= 2 ? "Protected" : "Incomplete"]) },
      { name: "IPT Uptake", kind: "kv", rows: () => [{ k: "IPTp-SP 1st dose", v: 12 }, { k: "IPTp-SP 2nd dose", v: 8 }, { k: "IPTp-SP 3rd dose+", v: 4, target: "≥ 60%" }] },
      { name: "HIV Testing", kind: "kv", rows: () => [{ k: "Total tested", v: 14 }, { k: "Non-reactive", v: 13 }, { k: "Reactive", v: 1 }, { k: "Partner tested", v: 6 }] },
      { name: "Deliveries", kind: "empty", hint: "No deliveries recorded in this period." },
      { name: "Birth Outcomes", kind: "kv", rows: () => [{ k: "Live birth", v: 6 }, { k: "Fresh stillbirth", v: 0 }, { k: "Macerated stillbirth", v: 0 }, { k: "Total", v: 6 }] },
      { name: "PNC Visits", kind: "empty", hint: "No PNC visits recorded in this period." },
      { name: "Birth Certificates", kind: "empty", hint: "No birth certificates issued in this period." },
    ],
  },
  {
    name: "Child Health",
    stats: (s) => [
      { label: "Under-5 Visits", value: s.childVisits.length + 6, tone: "brand" },
      { label: "Growth checks", value: s.childVisits.length },
      { label: "MAM", value: s.childVisits.filter((v) => v.status === "MAM").length, tone: "amber" },
      { label: "SAM", value: s.childVisits.filter((v) => v.status === "SAM").length, tone: "action" },
    ],
    tabs: [
      { name: "Under-5 Attendance", kind: "table", columns: ["Child", "Age", "Visit date", "Weight", "Diagnosis"], rows: (s) => s.childVisits.map((v) => [nm(s.patientById(v.patientId)), s.patientById(v.patientId) ? ageFromDob(s.patientById(v.patientId)!.dob) : "—", shortDate(v.date), `${v.weight} kg`, "Growth monitoring"]) },
      { name: "Growth Monitoring", kind: "table", columns: ["Child", "Weight", "Height", "MUAC", "WAZ", "Status"], rows: (s) => s.childVisits.map((v) => [nm(s.patientById(v.patientId)), v.weight, v.height, v.muac, v.waz ?? "—", v.status]) },
      { name: "Nutrition (MUAC)", kind: "kv", rows: (s) => (["Normal", "MAM", "SAM"] as const).map((k) => ({ k, v: s.childVisits.filter((v) => v.status === k).length })) },
      { name: "Vitamin A", kind: "kv", rows: () => [{ k: "6–11 months", v: 8 }, { k: "12–59 months", v: 34 }, { k: "Total", v: 42, target: "≥ 80%" }] },
      { name: "Deworming", kind: "kv", rows: () => [{ k: "12–23 months", v: 6 }, { k: "24–59 months", v: 21 }] },
      { name: "Child Mortality", kind: "empty", hint: "No under-5 deaths recorded in this period." },
    ],
  },
  {
    name: "Nutrition (CMAM)",
    stats: () => [
      { label: "Screenings", value: 0, tone: "brand" },
      { label: "Active OTP", value: 0, tone: "action" },
      { label: "Active SFP", value: 0, tone: "amber" },
      { label: "Cured %", value: "—" },
    ],
    tabs: [
      { name: "MIYCN by Age × Visit Type", kind: "empty", hint: "No records in this period." },
      { name: "Nutrition Indicators", kind: "kv", rows: () => [{ k: "Growing well (178)", v: "—" }, { k: "MIYCN counselled (180)", v: "—" }, { k: "Screened by MUAC (181)", v: "—" }, { k: "SAM identified (182)", v: "—" }, { k: "MAM identified (183)", v: "—" }, { k: "Oedema cases (184)", v: "—" }] },
      { name: "MAM Treatment", kind: "kv", rows: () => [{ k: "MAM admitted to SFP (185)", v: "—" }, { k: "MAM received RUSF (186)", v: "—" }] },
      { name: "SAM Treatment & Outcomes", kind: "kv", rows: () => [{ k: "SAM admitted to OTP (187)", v: "—" }, { k: "SAM received RUTF (188)", v: "—" }, { k: "Recovered (190)", v: "—", target: "≥ 75%" }, { k: "Defaulted (190)", v: "—", target: "< 15%" }, { k: "Death (190)", v: "—", target: "< 10%" }] },
      { name: "Screening Summary", kind: "empty", hint: "No records in this period." },
      { name: "Caseload", kind: "empty", hint: "No active caseload in this period." },
      { name: "Defaulter List", kind: "empty", hint: "No defaulters in this period." },
    ],
  },
  {
    name: "Immunization",
    stats: () => [
      { label: "Doses Given", value: 92, tone: "brand" },
      { label: "Antigens", value: 12 },
      { label: "Defaulters", value: 14, tone: "action" },
      { label: "AEFI", value: 0 },
    ],
    tabs: [
      { name: "Coverage by Antigen", kind: "bars", keys: ["given", "given"], data: () => VACCINES.slice(0, 10).map((v) => ({ label: v.code, given: Math.max(2, 14 - v.dose * 2 - (v.ageWeeks > 10 ? 3 : 0)) })) },
      { name: "Fully Immunized", kind: "kv", rows: () => [{ k: "Fully immunized (<1 yr)", v: 7, target: "≥ 90%" }, { k: "Fully immunized (12–23 mo)", v: 11 }] },
      { name: "Dropout Rate", kind: "kv", rows: () => [{ k: "Penta 1", v: 18 }, { k: "Penta 3", v: 14 }, { k: "Dropout %", v: "22%", target: "< 10%" }] },
      { name: "Defaulter List", kind: "table", columns: ["Child", "Vaccine due", "Due date", "Days late"], rows: () => [["Ugah Samuel", "OPV 1", "2026-06-30", 65], ["Isah Al-amin", "MR 1", "2026-07-10", 55], ["Atayero Victoria", "Penta 3", "2026-07-04", 61]] },
      { name: "Vaccine Usage", kind: "table", columns: ["Vaccine", "Doses given", "Wasted (5%)", "Assumed wastage"], rows: () => [["Measles/MR", 12, 1, "5%"], ["Yellow Fever", 12, 1, "5%"], ["Men A", 10, 1, "5%"]] },
      { name: "TD Immunization (Women)", kind: "empty", hint: "No TD records for women in this period." },
      { name: "AEFI Report", kind: "empty", hint: "No adverse events following immunization reported." },
      { name: "AEFI Summary", kind: "kv", rows: () => [{ k: "Total AEFI", v: 0 }, { k: "Non-serious", v: 0 }, { k: "Serious", v: 0 }, { k: "Deaths", v: 0 }] },
    ],
  },
  {
    name: "Malaria",
    stats: (s) => [
      { label: "Suspected (fever)", value: s.encounters.length + 4, tone: "brand" },
      { label: "Tested (RDT/Micro)", value: 6 },
      { label: "Confirmed", value: s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).length, tone: "action" },
      { label: "Treated with ACT", value: s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).length },
    ],
    tabs: [
      { name: "Testing & Treatment", kind: "line", keys: ["tested", "positive"], data: () => [{ label: "Wk 1", tested: 22, positive: 14 }, { label: "Wk 2", tested: 31, positive: 19 }, { label: "Wk 3", tested: 27, positive: 16 }, { label: "Wk 4", tested: 35, positive: 24 }] },
      { name: "Confirmed Cases", kind: "table", columns: ["Patient", "Date", "Diagnosis", "Treatment"], rows: (s) => s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).map((e) => [nm(s.patientById(e.patientId)), shortDate(e.date), e.diagnoses.map((d) => d.name).join(", "), e.prescriptions[0]?.drug ?? "—"]) },
      { name: "Severe Malaria", kind: "empty", hint: "No severe malaria cases in this period." },
      { name: "IPTp (pregnant women)", kind: "kv", rows: () => [{ k: "IPTp 1", v: 12 }, { k: "IPTp 2", v: 8 }, { k: "IPTp 3+", v: 4 }] },
    ],
  },
  {
    name: "Laboratory",
    stats: (s) => [
      { label: "Orders", value: s.labOrders.length, tone: "brand" },
      { label: "Completed", value: s.labOrders.filter((l) => l.status === "Resulted").length },
      { label: "Pending", value: s.labOrders.filter((l) => l.status !== "Resulted" && l.status !== "Rejected").length, tone: "amber" },
      { label: "Rejected", value: s.labOrders.filter((l) => l.status === "Rejected").length, tone: "action" },
    ],
    tabs: [
      { name: "Tests by Type", kind: "table", columns: ["Category", "Ordered", "Resulted"], rows: (s) => Object.entries(s.labOrders.reduce<Record<string, number>>((a, l) => ((a[l.category] = (a[l.category] ?? 0) + 1), a), {})).map(([c, n]) => [c, n, s.labOrders.filter((l) => l.category === c && l.status === "Resulted").length]) },
      { name: "Results Summary", kind: "table", columns: ["Patient", "Test", "Result", "Flag"], rows: (s) => s.labOrders.filter((l) => l.status === "Resulted").map((l) => [nm(s.patientById(l.patientId)), l.test, l.result ?? "—", l.flag ?? "—"]) },
      { name: "Turnaround Time", kind: "empty", hint: "No completed tests in this period." },
      { name: "Rejected Samples", kind: "empty", hint: "No rejected samples in this period." },
      { name: "Workload Stats", kind: "kv", rows: (s) => [{ k: "Total orders", v: s.labOrders.length }, { k: "Avg per day", v: Math.max(1, Math.round(s.labOrders.length / 7)) }] },
    ],
  },
  {
    name: "Pharmacy / Drugs",
    stats: (s) => [
      { label: "Dispensed items", value: s.encounters.flatMap((e) => e.prescriptions).filter((r) => r.status === "Dispensed").length, tone: "brand" },
      { label: "Unique drugs", value: drugs.length },
      { label: "Stock-out", value: drugs.filter((d) => d.stock === 0).length, tone: "action" },
      { label: "Low stock", value: drugs.filter((d) => d.stock > 0 && d.stock <= d.reorder).length, tone: "amber" },
    ],
    tabs: [
      { name: "Drug Consumption", kind: "table", columns: ["Drug", "Dispensed", "On hand"], rows: (s) => drugs.map((d) => [d.name, s.encounters.flatMap((e) => e.prescriptions).filter((r) => r.drug.includes(d.name)).reduce((n, r) => n + r.qty, 0), d.stock]) },
      { name: "Stock Balance", kind: "table", columns: ["Drug", "Form", "Stock", "Reorder", "Status"], rows: () => drugs.map((d) => [d.name, d.form, d.stock, d.reorder, d.stock === 0 ? "Out" : d.stock <= d.reorder ? "Low" : "OK"]) },
      { name: "Stock-Out", kind: "table", columns: ["Drug", "Form", "Reorder level"], rows: () => drugs.filter((d) => d.stock === 0).map((d) => [d.name, d.form, d.reorder]) },
      { name: "Expiry Tracking", kind: "empty", hint: "No batches expiring in the next 90 days." },
      { name: "Dispensing Summary", kind: "empty", hint: "No dispensing recorded in this period." },
      { name: "Returns", kind: "empty", hint: "No returns in this period." },
    ],
  },
  {
    name: "NCDs",
    stats: () => [
      { label: "Enrolled", value: 1, tone: "brand" },
      { label: "Hypertension", value: 0 },
      { label: "Diabetes", value: 1 },
      { label: "Uncontrolled", value: 1, tone: "action" },
    ],
    tabs: [
      { name: "Register Summary", kind: "kv", rows: () => [{ k: "Hypertension", v: 0 }, { k: "Diabetes", v: 1 }, { k: "Hypertension + Diabetes", v: 0 }] },
      { name: "New Cases", kind: "empty", hint: "No new NCD cases enrolled in this period." },
      { name: "Control Status", kind: "kv", rows: () => [{ k: "Controlled", v: 0 }, { k: "Uncontrolled", v: 1, target: "< 40%" }] },
      { name: "Due for Review", kind: "table", columns: ["Patient", "Condition", "Next visit"], rows: () => [["Oluchi Dikeocha", "Type 2 Diabetes Mellitus", "in 14 days"]] },
    ],
  },
  {
    name: "Family Planning",
    stats: (s) => [
      { label: "Clients", value: s.fpClients.length, tone: "brand" },
      { label: "New acceptors", value: s.fpClients.filter((c) => c.firstTime).length },
      { label: "Revisits", value: s.fpClients.filter((c) => !c.firstTime).length },
      { label: "Discontinued", value: s.fpClients.filter((c) => c.status === "Discontinued").length, tone: "action" },
    ],
    tabs: [
      { name: "New Acceptors", kind: "table", columns: ["Patient", "Method", "Start", "Type"], rows: (s) => s.fpClients.filter((c) => c.firstTime).map((c) => [nm(s.patientById(c.patientId)), c.method, shortDate(c.startDate), "New"]) },
      { name: "Method Mix", kind: "table", columns: ["Method", "New", "Revisit", "Total"], rows: (s) => [...new Set(s.fpClients.map((c) => c.method))].map((m) => { const cs = s.fpClients.filter((c) => c.method === m); return [m, cs.filter((c) => c.firstTime).length, cs.filter((c) => !c.firstTime).length, cs.length]; }) },
      { name: "Counselling Summary", kind: "kv", rows: (s) => [{ k: "Total counselled", v: s.fpClients.filter((c) => c.counselled).length }, { k: "Postpartum counselled", v: 0 }] },
      { name: "Discontinuation", kind: "table", columns: ["Patient", "Method", "Reason", "Date"], rows: (s) => s.fpClients.filter((c) => c.status === "Discontinued").map((c) => [nm(s.patientById(c.patientId)), c.method, c.notes ?? "—", shortDate(c.startDate)]) },
    ],
  },
  {
    name: "Inpatient",
    stats: (s) => [
      { label: "Active admissions", value: s.admissions.filter((a) => a.status === "Active").length, tone: "brand" },
      { label: "Discharges", value: s.admissions.filter((a) => a.status === "Discharged").length },
      { label: "Beds available", value: 24 - s.admissions.filter((a) => a.status === "Active").length },
      { label: "Bed occupancy", value: `${Math.round((s.admissions.filter((a) => a.status === "Active").length / 24) * 100)}%` },
    ],
    tabs: [
      { name: "Admissions", kind: "table", columns: ["Patient", "Ward", "Bed", "Diagnosis", "Admitted"], rows: (s) => s.admissions.map((a) => [nm(s.patientById(a.patientId)), a.ward, a.bed, a.diagnosis, shortDate(a.admittedAt)]) },
      { name: "Bed Occupancy", kind: "table", columns: ["Ward", "Beds", "Occupied", "Available", "Occupancy %"], rows: (s) => ["Children's Ward", "Female Ward", "Male Ward", "Maternity Ward"].map((w) => { const occ = s.admissions.filter((a) => a.status === "Active" && a.ward === w).length; return [w, 6, occ, 6 - occ, `${Math.round((occ / 6) * 100)}%`]; }) },
      { name: "Daily Occupancy", kind: "empty", hint: "No occupancy recorded in this period." },
      { name: "Length of Stay", kind: "empty", hint: "No discharges in this period." },
      { name: "LOS by Ward", kind: "empty", hint: "No discharges in this period." },
      { name: "Discharge Outcomes", kind: "table", columns: ["Patient", "Ward", "Outcome"], rows: (s) => s.admissions.filter((a) => a.status === "Discharged").map((a) => [nm(s.patientById(a.patientId)), a.ward, a.outcome ?? "—"]) },
      { name: "Medication Usage", kind: "empty", hint: "No inpatient medication recorded in this period." },
      { name: "Ward Rounds & Notes", kind: "empty", hint: "No ward round notes in this period." },
    ],
  },
  {
    name: "Referrals",
    stats: (s) => [
      { label: "Total Referrals", value: s.referrals.length, tone: "brand" },
      { label: "Out", value: s.referrals.filter((r) => r.type === "Out").length, tone: "action" },
      { label: "In", value: s.referrals.filter((r) => r.type === "In").length },
      { label: "Emergency", value: s.referrals.filter((r) => r.urgency === "Emergency").length, tone: "action" },
    ],
    tabs: [
      { name: "All Referrals", kind: "table", columns: ["Patient", "Type", "Diagnosis", "Facility", "Reason", "Status"], rows: (s) => s.referrals.map((r) => [nm(s.patientById(r.patientId)), r.type, r.diagnosis, r.facility, r.reason, r.status]) },
      { name: "NHMIS Out-Referral Reasons", kind: "table", columns: ["Code", "Reason", "Count"], rows: (s) => OUT_REFERRAL_REASONS.map((r) => [r.code, r.reason, s.referrals.filter((x) => x.reason === r.reason).length]) },
      { name: "Internal by Unit", kind: "empty", hint: "No internal referrals in this period." },
      { name: "Top Diagnoses", kind: "table", columns: ["Diagnosis", "Referrals"], rows: (s) => [...new Set(s.referrals.map((r) => r.diagnosis))].map((d) => [d, s.referrals.filter((r) => r.diagnosis === d).length]) },
      { name: "By Reason", kind: "table", columns: ["Reason", "Count"], rows: (s) => [...new Set(s.referrals.map((r) => r.reason))].map((r) => [r, s.referrals.filter((x) => x.reason === r).length]) },
      { name: "Outcomes", kind: "empty", hint: "No referral outcomes recorded in this period." },
      { name: "Emergency", kind: "table", columns: ["Patient", "Reason", "Facility"], rows: (s) => s.referrals.filter((r) => r.urgency === "Emergency").map((r) => [nm(s.patientById(r.patientId)), r.reason, r.facility]) },
    ],
  },
  {
    name: "Community Outreach",
    stats: () => [
      { label: "Activities", value: 1, tone: "brand" },
      { label: "Households", value: 12 },
      { label: "Referrals", value: 2, tone: "action" },
      { label: "Active CHWs", value: 1 },
    ],
    tabs: [
      { name: "Activity Summary", kind: "kv", rows: () => [{ k: "Household visits", v: 1 }, { k: "Health talks", v: 0 }, { k: "Campaigns", v: 0 }] },
      { name: "Households Reached", kind: "kv", rows: () => [{ k: "This week", v: 12 }, { k: "This month", v: 12 }] },
      { name: "Referrals", kind: "kv", rows: () => [{ k: "Community → facility", v: 2 }] },
      { name: "CHW Productivity", kind: "table", columns: ["CHW", "Activities", "Households"], rows: () => [["Abisola Adedokun", 1, 12]] },
    ],
  },
  {
    name: "Surveillance",
    stats: () => [
      { label: "Cases this week", value: 0, tone: "brand" },
      { label: "Immediate-notify", value: 0, tone: "action" },
      { label: "Confirmed", value: 0 },
      { label: "Diseases tracked", value: NOTIFIABLE.length },
    ],
    tabs: [
      { name: "Weekly Line List", kind: "empty", hint: "No cases notified this week." },
      { name: "By Disease", kind: "table", columns: ["Disease", "Class", "Priority", "Cases"], rows: () => NOTIFIABLE.map((d) => [d.name, d.class, d.priority, 0]) },
      { name: "IDSR Timeliness", kind: "kv", rows: () => [{ k: "Reports due", v: 4 }, { k: "Reports submitted on time", v: 4, target: "100%" }] },
      { name: "Alerts", kind: "empty", hint: "No epidemic thresholds crossed." },
    ],
  },
  {
    name: "Service Performance",
    stats: (s) => [
      { label: "Encounters", value: s.encounters.length + 118, tone: "brand" },
      { label: "Queue entries", value: s.queue.length + 96 },
      { label: "Appointments", value: s.appointments.length },
      { label: "No-shows", value: s.appointments.filter((a) => a.status === "No-Show").length, tone: "action" },
    ],
    tabs: [
      { name: "Daily Patient Flow", kind: "line", keys: ["queued", "seen", "referred"], data: () => patientFlow.map((d) => ({ ...d })) },
      { name: "Wait Times", kind: "table", columns: ["Station", "Avg wait (min)", "Max wait (min)", "Entries"], rows: () => [["Exit", 2, 6, 24], ["Immunization", 18, 45, 13], ["Pharmacy", 14, 34, 9], ["Consultation", 12, 41, 12], ["Lab", 9, 28, 8], ["Family Planning", 4, 12, 2]] },
      { name: "Staff Productivity", kind: "table", columns: ["Provider", "Encounters"], rows: () => staff.filter((x) => ["Medical Officer", "Nurse"].includes(x.role)).map((x) => [x.name, x.role === "Medical Officer" ? 42 : 18]) },
      { name: "Service Utilization", kind: "bars", keys: ["entries", "entries"], data: () => utilization.map((u) => ({ label: u.module, entries: u.entries })) },
      { name: "No-Shows", kind: "empty", hint: "No no-shows recorded in this period." },
      { name: "Data Quality", kind: "kv", rows: () => [{ k: "Encounters missing diagnosis", v: 2 }, { k: "Vitals missing weight", v: 1 }, { k: "QC overrides", v: 0 }] },
    ],
  },
  {
    name: "Patient Transfers",
    stats: () => [
      { label: "Transferred in", value: 0, tone: "brand" },
      { label: "Transferred out", value: 0, tone: "action" },
      { label: "Total movements", value: 0 },
      { label: "Net", value: 0 },
    ],
    tabs: [
      { name: "Transferred In", kind: "empty", hint: "No inbound transfers in this period." },
      { name: "Transferred Out", kind: "empty", hint: "No outbound transfers in this period." },
      { name: "All Transfers", kind: "empty", hint: "No transfers recorded in this period." },
    ],
  },
  {
    name: "Patient EMR",
    stats: (s) => [
      { label: "Encounters", value: s.encounters.length, tone: "brand" },
      { label: "Patients seen", value: new Set(s.encounters.map((e) => e.patientId)).size },
      { label: "With diagnosis", value: s.encounters.filter((e) => e.diagnoses.length).length },
      { label: "Departments", value: new Set(s.encounters.map((e) => e.station)).size },
    ],
    tabs: [
      { name: "Recent Encounters", kind: "table", columns: ["Date", "Patient", "Complaint", "Diagnoses", "Plan"], rows: (s) => s.encounters.map((e) => [shortDate(e.date), nm(s.patientById(e.patientId)), e.complaint, e.diagnoses.map((d) => d.name).join(", ") || "—", e.plan ?? "—"]) },
    ],
  },
  {
    name: "Diagnosis Report",
    stats: (s) => [
      { label: "Diagnoses", value: s.encounters.flatMap((e) => e.diagnoses).length, tone: "brand" },
      { label: "Patients seen", value: new Set(s.encounters.map((e) => e.patientId)).size },
      { label: "NCD flagged", value: s.encounters.flatMap((e) => e.diagnoses).filter((d) => ["BA00", "5A11", "CA23"].includes(d.code)).length, tone: "amber" },
      { label: "Notifiable", value: s.encounters.flatMap((e) => e.diagnoses).filter((d) => ["1F40", "1E31", "1B10", "1A00"].includes(d.code)).length, tone: "action" },
    ],
    tabs: [
      { name: "By Patient", kind: "table", columns: ["Patient", "Age", "Sex", "Diagnosis"], rows: (s) => s.encounters.flatMap((e) => e.diagnoses.map((d) => { const p = s.patientById(e.patientId); return [nm(p), p ? ageFromDob(p.dob) : "—", p?.sex ?? "—", `${d.code}  ${d.name}`]; })) },
      { name: "Frequency", kind: "table", columns: ["Diagnosis", "Cases"], rows: () => topDiagnoses.map((d) => [d.name, d.cases]) },
    ],
  },
  {
    name: "Inventory & Assets",
    stats: () => [
      { label: "Assets", value: 3, tone: "brand" },
      { label: "Functional", value: 2 },
      { label: "Needs repair", value: 1, tone: "action" },
      { label: "Drug lines", value: drugs.length },
    ],
    tabs: [
      { name: "Asset Register", kind: "table", columns: ["Name", "Category", "Location", "Status"], rows: () => [["Digital BP Monitor", "Equipment", "Consulting Room 1", "Functional"], ["Vaccine Refrigerator", "Cold Chain", "EPI Room", "Functional"], ["Delivery Bed", "Furniture", "Labour Room", "Under Repair"]] },
      { name: "By Status", kind: "kv", rows: () => [{ k: "Functional", v: 2 }, { k: "Under Repair", v: 1 }, { k: "Faulty", v: 0 }, { k: "Disposed", v: 0 }] },
      { name: "By Location", kind: "kv", rows: () => [{ k: "Consulting Room 1", v: 1 }, { k: "EPI Room", v: 1 }, { k: "Labour Room", v: 1 }] },
      { name: "Maintenance", kind: "table", columns: ["Asset", "Issue", "Status"], rows: () => [["Delivery Bed", "Hydraulics leaking", "In Progress"], ["Vaccine Refrigerator", "Temperature excursions", "Open"]] },
    ],
  },
  {
    name: "DHIS / Statutory",
    stats: () => [
      { label: "Datasets", value: 6, tone: "brand" },
      { label: "Elements mapped", value: 214 },
      { label: "Last submission", value: "6h ago" },
      { label: "Status", value: "Pending", tone: "action" },
    ],
    tabs: [
      { name: "NHMIS Monthly Summary", kind: "kv", rows: () => [{ k: "OPD attendance", v: 128 }, { k: "ANC 1st visits", v: 2 }, { k: "Penta 3", v: 9 }, { k: "FP new acceptors", v: 1 }, { k: "Confirmed malaria", v: 34 }] },
      { name: "Data Element Mapping", kind: "table", columns: ["Local field", "DHIS2 data element", "Category combo"], rows: () => [["OPD new attendance", "NHMIS_OPD_NEW", "Age/Sex"], ["ANC 1st visit", "NHMIS_ANC1", "default"], ["Penta 3 doses", "NHMIS_PENTA3", "<1 / 12-23mo"], ["Confirmed malaria", "NHMIS_MAL_CONF", "Age/Sex"]] },
      { name: "Submission History", kind: "table", columns: ["Period", "Dataset", "Submitted", "Status"], rows: () => [["2026-08", "NHMIS_OPD", "01 Sep 2026", "Accepted"], ["2026-08", "NHMIS_EPI", "01 Sep 2026", "Accepted"], ["2026-09", "NHMIS_OPD", "—", "Pending"]] },
    ],
  },
  {
    name: "Compliance — NDPR",
    stats: (s) => [
      { label: "Events (24h)", value: auditTrail.length, tone: "brand" },
      { label: "Users", value: new Set(auditTrail.map((e) => e.user)).size },
      { label: "Data exports", value: auditTrail.filter((e) => e.action.includes("REPORT")).length, tone: "amber" },
      { label: "Amendments", value: 0 },
    ],
    tabs: [
      { name: "Access Log Summary", kind: "table", columns: ["Action", "Count"], rows: () => [...new Set(auditTrail.map((e) => e.action))].map((a) => [a, auditTrail.filter((e) => e.action === a).length]) },
      { name: "Data Exports", kind: "table", columns: ["User", "Resource", "IP"], rows: () => auditTrail.filter((e) => e.action.includes("REPORT")).slice(0, 8).map((e) => [e.user, e.resource, e.ip]) },
      { name: "Consent Records", kind: "kv", rows: (s) => [{ k: "Patients with consent on file", v: s.patients.length }, { k: "Consent withdrawn", v: 0 }] },
      { name: "Amendment Log", kind: "empty", hint: "No record amendments in this period." },
    ],
  },
];
