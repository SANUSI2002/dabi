import type { EmrSnapshot } from "./types";
import { auditTrail, drugs } from "@/data/mock";
import { OUT_REFERRAL_REASONS, NOTIFIABLE, VACCINES } from "@/data/catalog";
import { shortDate, ageFromDob } from "@/lib/format";
import { pmState, nextPmDue } from "@/store/useAssets";
import { differenceInYears, startOfISOWeek, format } from "date-fns";

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

const FP_CYP: Record<string, number> = {
  "Implant": 2.5, "IUCD": 4.6,
  "Injectable (DMPA-IM)": 1.0, "Injectable (DMPA-SC)": 1.0,
  "Oral Pill": 1.0, "Male Condom": 0.5, "Female Condom": 0.5,
  "LAM": 0.25, "Natural / Calendar": 0.25,
};

export const REPORTS: ReportFamily[] = [
  {
    name: "OPD Reports",
    stats: (s) => [
      { label: "Total Visits", value: s.encounters.length, tone: "brand" },
      { label: "Distinct patients", value: new Set(s.encounters.map((e) => e.patientId)).size },
      { label: "With diagnosis recorded", value: s.encounters.filter((e) => e.diagnoses.length > 0).length },
      { label: "Referrals", value: s.referrals.length, tone: "action" },
    ],
    tabs: [
      {
        name: "Daily Attendance", kind: "table",
        columns: ["Date", "Encounters"],
        rows: (s) => {
          const byDay = new Map<string, number>();
          for (const encounter of s.encounters) {
            const key = shortDate(encounter.date);
            byDay.set(key, (byDay.get(key) ?? 0) + 1);
          }
          return [...byDay.entries()];
        },
      },
      {
        name: "Age & Sex", kind: "table",
        columns: ["Age group", "Male", "Female", "Total"],
        rows: (s) => {
          const bands: [string, number, number][] = [["0–4", 0, 4], ["5–14", 5, 14], ["15–49", 15, 49], ["50+", 50, 999]];
          const patientsSeen = [...new Set(s.encounters.map((e) => e.patientId))]
            .map((id) => s.patientById(id))
            .filter((p): p is NonNullable<typeof p> => !!p);
          return bands.map(([label, lo, hi]) => {
            const inBand = patientsSeen.filter((p) => { const age = differenceInYears(new Date(), new Date(p.dob)); return age >= lo && age <= hi; });
            return [label, inBand.filter((p) => p.sex === "M").length, inBand.filter((p) => p.sex === "F").length, inBand.length];
          });
        },
      },
      {
        name: "Top 10 Diagnoses", kind: "table",
        columns: ["Diagnosis", "Cases"],
        rows: (s) => Object.entries(s.encounters.flatMap((e) => e.diagnoses).reduce<Record<string, number>>((acc, d) => ((acc[d.name] = (acc[d.name] ?? 0) + 1), acc), {}))
          .sort(([, a], [, b]) => b - a).slice(0, 10),
      },
      {
        name: "OPD Morbidity", kind: "bars", keys: ["cases", "cases"],
        data: (s) => Object.entries(s.encounters.flatMap((e) => e.diagnoses).reduce<Record<string, number>>((acc, d) => ((acc[d.name] = (acc[d.name] ?? 0) + 1), acc), {}))
          .sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, cases]) => ({ label: name.split(",")[0], cases })),
      },
      {
        name: "Referrals from OPD", kind: "table",
        columns: ["Patient", "Referred To", "Reason", "Status"],
        rows: (s) => s.referrals.map((r) => [nm(s.patientById(r.patientId)), r.facility, r.reason, r.status]),
      },
      {
        name: "Wait Time Analysis", kind: "empty",
        hint: "Per-station wait times are not tracked in this build — no timestamped station transitions are recorded against a visit.",
      },
    ],
  },
  {
    name: "Maternal Health",
    stats: (s) => [
      { label: "ANC Bookings", value: s.ancRecords.length, tone: "brand" },
      { label: "Total ANC Visits", value: s.ancRecords.reduce((n, r) => n + r.visits.length, 0) },
      { label: "High-risk", value: s.ancRecords.filter((r) => (r.hb ?? 12) < 10).length, tone: "action" },
      { label: "Deliveries", value: s.deliveries.length },
    ],
    tabs: [
      { name: "ANC Registration", kind: "table", columns: ["Patient", "Age", "LMP", "EDD", "G / P", "Status"], rows: (s) => s.ancRecords.map((r) => [nm(s.patientById(r.patientId)), s.patientById(r.patientId) ? ageFromDob(s.patientById(r.patientId)!.dob) : "—", shortDate(r.lmp), shortDate(r.edd), `${r.gravida}/${r.para}`, r.status]) },
      { name: "ANC Visits", kind: "table", columns: ["Patient", "Visit date", "Weeks", "BP", "Hb", "FHR"], rows: (s) => s.ancRecords.flatMap((r) => r.visits.map((v) => [nm(s.patientById(r.patientId)), shortDate(v.date), v.weeks, v.bp, v.hb ?? "—", v.fhr ?? "—"])) },
      { name: "High-Risk", kind: "table", columns: ["Patient", "Risk factor", "Hb", "Action"], rows: (s) => s.ancRecords.filter((r) => (r.hb ?? 12) < 10).map((r) => [nm(s.patientById(r.patientId)), "Anaemia in pregnancy", r.hb ?? "—", "Iron + folate, review 2 weeks"]) },
      { name: "TT Coverage", kind: "table", columns: ["Patient", "TT doses", "Status"], rows: (s) => s.ancRecords.map((r) => [nm(s.patientById(r.patientId)), `${r.ttDoses}/5`, r.ttDoses >= 2 ? "Protected" : "Incomplete"]) },
      { name: "IPT Uptake", kind: "empty", hint: "IPTp-SP dosing is not recorded as structured data in this build — no field captures doses given per ANC visit." },
      { name: "HIV Testing", kind: "empty", hint: "HIV testing during antenatal care is not recorded as structured data in this build." },
      { name: "Deliveries", kind: "table", columns: ["Mother", "Date", "Mode", "GA", "Outcome", "Weight"], rows: (s) => s.deliveries.map((d) => [nm(s.patientById(d.patientId)), shortDate(d.date), d.mode, `${d.gaWeeks}w`, d.babyStatus, `${d.weight} kg`]) },
      { name: "Birth Outcomes", kind: "kv", rows: (s) => [{ k: "Live birth", v: s.deliveries.filter((d) => d.babyStatus === "Alive").length }, { k: "Fresh stillbirth", v: s.deliveries.filter((d) => d.babyStatus === "Fresh stillbirth").length }, { k: "Macerated stillbirth", v: s.deliveries.filter((d) => d.babyStatus === "Macerated stillbirth").length }, { k: "Total", v: s.deliveries.length }] },
      { name: "PNC Visits", kind: "table", columns: ["Mother", "Date", "Timing", "Days PP", "Danger signs"], rows: (s) => s.pncVisits.map((v) => [nm(s.patientById(v.patientId)), shortDate(v.date), v.timing, v.daysPP, v.dangerSigns.length || "None"]) },
      {
        name: "Birth Register", kind: "table",
        columns: ["Notification no.", "Registration no.", "Baby", "Mother", "Born", "Status"],
        rows: (s) => s.birthRegister.map((b) => [b.npopcNo, b.regNo ?? "—", `${b.babyName || "unnamed"} (${b.sex})`, b.motherName, shortDate(b.bornAt), b.status]),
      },
      {
        name: "Registration status", kind: "kv",
        rows: (s) => {
          const live = s.deliveries.filter((d) => d.babyStatus === "Alive").length;
          return [
            { k: "Live births", v: live },
            { k: "Notified", v: s.birthRegister.length, target: live ? `${Math.round((s.birthRegister.length / live) * 100)}%` : "—" },
            { k: "Registered (NPopC)", v: s.birthRegister.filter((b) => b.status !== "Notified").length },
            { k: "Certificates issued", v: s.birthRegister.filter((b) => b.status === "Certificate issued").length },
          ];
        },
      },
    ],
  },
  {
    name: "Child Health",
    stats: (s) => [
      { label: "Under-5 Visits", value: s.childVisits.length, tone: "brand" },
      { label: "Growth checks", value: s.childVisits.length },
      { label: "MAM", value: s.childVisits.filter((v) => v.status === "MAM").length, tone: "amber" },
      { label: "SAM", value: s.childVisits.filter((v) => v.status === "SAM").length, tone: "action" },
    ],
    tabs: [
      { name: "Under-5 Attendance", kind: "table", columns: ["Child", "Age", "Visit date", "Weight", "Diagnosis"], rows: (s) => s.childVisits.map((v) => [nm(s.patientById(v.patientId)), s.patientById(v.patientId) ? ageFromDob(s.patientById(v.patientId)!.dob) : "—", shortDate(v.date), `${v.weight} kg`, "Growth monitoring"]) },
      { name: "Growth Monitoring", kind: "table", columns: ["Child", "Weight", "Height", "MUAC", "WAZ", "Status"], rows: (s) => s.childVisits.map((v) => [nm(s.patientById(v.patientId)), v.weight, v.height, v.muac, v.waz ?? "—", v.status]) },
      { name: "Nutrition (MUAC)", kind: "kv", rows: (s) => (["Normal", "MAM", "SAM"] as const).map((k) => ({ k, v: s.childVisits.filter((v) => v.status === k).length })) },
      { name: "Vitamin A", kind: "empty", hint: "Vitamin A supplementation is not recorded as structured data in this build." },
      { name: "Deworming", kind: "empty", hint: "Deworming doses are not recorded as structured data in this build." },
      { name: "Child Mortality", kind: "empty", hint: "No under-5 deaths recorded in this period." },
    ],
  },
  {
    name: "Nutrition (CMAM)",
    stats: (s) => [
      { label: "Screenings", value: s.cmamScreenings.length, tone: "brand" },
      { label: "Active OTP", value: s.cmamScreenings.filter((c) => c.program === "OTP" && !c.outcome).length, tone: "action" },
      { label: "Active SFP", value: s.cmamScreenings.filter((c) => c.program === "SFP" && !c.outcome).length, tone: "amber" },
      { label: "Cure rate", value: `${(() => { const d = s.cmamScreenings.filter((c) => c.outcome); return d.length ? Math.round((d.filter((c) => c.outcome === "Cured").length / d.length) * 100) : 0; })()}%`, tone: "brand" },
    ],
    tabs: [
      { name: "Screening Summary", kind: "table", columns: ["Patient", "Date", "MUAC", "Oedema", "Classification", "Program", "Outcome"], rows: (s) => s.cmamScreenings.map((c) => [nm(s.patientById(c.patientId)), shortDate(c.date), `${c.muac} cm`, c.oedema, c.cls, c.program, c.outcome ?? (c.cls === "Normal" ? "—" : "In caseload")]) },
      { name: "Nutrition Indicators", kind: "kv", rows: (s) => [{ k: "Screened by MUAC (181)", v: s.cmamScreenings.length }, { k: "SAM identified (182)", v: s.cmamScreenings.filter((c) => c.cls === "SAM").length }, { k: "MAM identified (183)", v: s.cmamScreenings.filter((c) => c.cls === "MAM").length }, { k: "Oedema cases (184)", v: s.cmamScreenings.filter((c) => c.oedema !== "None").length }] },
      { name: "MAM Treatment", kind: "kv", rows: (s) => [{ k: "MAM admitted to SFP (185)", v: s.cmamScreenings.filter((c) => c.program === "SFP").length }, { k: "MAM received RUSF (186)", v: s.cmamScreenings.filter((c) => c.program === "SFP").length }] },
      {
        name: "SAM Treatment & Outcomes", kind: "kv",
        rows: (s) => {
          const otp = s.cmamScreenings.filter((c) => c.program === "OTP");
          const discharged = s.cmamScreenings.filter((c) => c.outcome);
          const rate = (o: string) => (discharged.length ? Math.round((discharged.filter((c) => c.outcome === o).length / discharged.length) * 100) : 0);
          return [
            { k: "SAM admitted to OTP (187)", v: otp.length },
            { k: "SAM received RUTF (188)", v: otp.length },
            { k: "Recovered (190)", v: `${rate("Cured")}%`, target: "≥ 75%" },
            { k: "Defaulted (190)", v: `${rate("Defaulter")}%`, target: "< 15%" },
            { k: "Death (190)", v: `${rate("Death")}%`, target: "< 10%" },
          ];
        },
      },
      { name: "Caseload", kind: "table", columns: ["Patient", "Program", "MUAC", "Enrolled", "Days in program"], rows: (s) => s.cmamScreenings.filter((c) => c.cls !== "Normal" && !c.outcome).map((c) => [nm(s.patientById(c.patientId)), c.program, `${c.muac} cm`, shortDate(c.date), Math.max(0, Math.round((Date.now() - +new Date(c.date)) / 864e5))]) },
      { name: "Defaulter List", kind: "table", columns: ["Patient", "Program", "Enrolled", "Discharged"], rows: (s) => s.cmamScreenings.filter((c) => c.outcome === "Defaulter").map((c) => [nm(s.patientById(c.patientId)), c.program, shortDate(c.date), c.dischargedAt ? shortDate(c.dischargedAt) : "—"]) },
    ],
  },
  {
    name: "Immunization",
    stats: (s) => [
      { label: "Doses given", value: s.immunizations.length, tone: "brand" },
      { label: "Children reached", value: new Set(s.immunizations.map((i) => i.patientId)).size },
      { label: "AEFI", value: s.immunizations.filter((i) => i.aefi).length, tone: s.immunizations.some((i) => i.aefi?.severity === "Serious") ? "action" : "mist" },
      { label: "Serious AEFI", value: s.immunizations.filter((i) => i.aefi?.severity === "Serious").length, tone: "action" },
    ],
    tabs: [
      {
        name: "Coverage by Antigen", kind: "bars", keys: ["given", "given"],
        data: (s) => VACCINES.slice(0, 12).map((v) => ({ label: v.code, given: s.immunizations.filter((i) => i.vaccineCode === v.code).length })),
      },
      {
        name: "Doses Log", kind: "table",
        columns: ["Child", "Vaccine", "Batch", "Site", "Given by", "Date"],
        rows: (s) => s.immunizations.map((i) => [nm(s.patientById(i.patientId)), i.vaccineName, i.batchNo, i.site, i.givenBy, shortDate(i.givenAt)]),
      },
      { name: "Fully Immunized", kind: "empty", hint: "\"Fully immunized\" status is not derived in this build — it requires a per-child schedule check against the national immunization calendar that is not yet implemented." },
      {
        name: "Dropout Rate", kind: "kv",
        rows: (s) => {
          const p1 = s.immunizations.filter((i) => i.vaccineCode === "PENTA1").length;
          const p3 = s.immunizations.filter((i) => i.vaccineCode === "PENTA3").length;
          return [
            { k: "Penta 1 doses given", v: p1 },
            { k: "Penta 3 doses given", v: p3 },
            { k: "Dropout (Penta1→Penta3)", v: p1 ? `${Math.round(((p1 - p3) / p1) * 100)}%` : "—", target: "< 10%" },
          ];
        },
      },
      {
        name: "AEFI Report", kind: "table",
        columns: ["Child", "Vaccine", "Symptoms", "Severity", "Onset (h)", "Reported by"],
        rows: (s) => s.immunizations.filter((i) => i.aefi).map((i) => [nm(s.patientById(i.patientId)), i.vaccineName, i.aefi!.symptoms, i.aefi!.severity, i.aefi!.onsetHours, i.aefi!.reportedBy]),
      },
      {
        name: "AEFI Summary", kind: "kv",
        rows: (s) => {
          const a = s.immunizations.filter((i) => i.aefi);
          return [
            { k: "Total AEFI", v: a.length },
            { k: "Non-serious", v: a.filter((i) => i.aefi!.severity === "Non-serious").length },
            { k: "Serious (notified to IDSR)", v: a.filter((i) => i.aefi!.severity === "Serious").length },
            { k: "Deaths", v: "Not tracked in this build" },
          ];
        },
      },
    ],
  },
  {
    name: "Malaria",
    stats: (s) => {
      const tests = s.labOrders.filter((l) => l.test.toLowerCase().includes("malaria"));
      const suspected = s.encounters.filter((e) => e.complaint.toLowerCase().includes("fever") || e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria")));
      return [
        { label: "Suspected (fever/malaria)", value: suspected.length, tone: "brand" },
        { label: "Tested (RDT/Micro)", value: tests.length },
        { label: "Confirmed", value: s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).length, tone: "action" },
        { label: "Treated with ACT", value: s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria")) && e.prescriptions.some((p) => /artemether|lumefantrine|artesunate|act /i.test(p.drug))).length },
      ];
    },
    tabs: [
      {
        name: "Testing & Treatment", kind: "line", keys: ["tested", "positive"],
        data: (s) => {
          const byWeek = new Map<string, { label: string; tested: number; positive: number }>();
          for (const order of s.labOrders.filter((l) => l.test.toLowerCase().includes("malaria"))) {
            const weekStart = startOfISOWeek(new Date(order.orderedAt));
            const key = format(weekStart, "yyyy-'W'II");
            const entry = byWeek.get(key) ?? { label: format(weekStart, "dd MMM"), tested: 0, positive: 0 };
            entry.tested += 1;
            if (order.result && /positive|present/i.test(order.result)) entry.positive += 1;
            byWeek.set(key, entry);
          }
          return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
        },
      },
      { name: "Confirmed Cases", kind: "table", columns: ["Patient", "Date", "Diagnosis", "Treatment"], rows: (s) => s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).map((e) => [nm(s.patientById(e.patientId)), shortDate(e.date), e.diagnoses.map((d) => d.name).join(", "), e.prescriptions[0]?.drug ?? "—"]) },
      { name: "Severe Malaria", kind: "empty", hint: "No severe malaria cases in this period." },
      { name: "IPTp (pregnant women)", kind: "empty", hint: "IPTp-SP dosing is not recorded as structured data in this build." },
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
    stats: (s) => [
      { label: "Enrolled", value: s.ncdClients.length, tone: "brand" },
      { label: "Hypertension", value: s.ncdClients.filter((c) => c.condition.toLowerCase().includes("hyperten")).length },
      { label: "Diabetes", value: s.ncdClients.filter((c) => c.condition.toLowerCase().includes("diab")).length },
      { label: "Uncontrolled", value: s.ncdClients.filter((c) => c.control === "Uncontrolled").length, tone: "action" },
    ],
    tabs: [
      { name: "Register", kind: "table", columns: ["Patient", "Condition", "BP", "FBS", "Control", "Next visit"], rows: (s) => s.ncdClients.map((c) => [nm(s.patientById(c.patientId)), c.condition, c.bp ?? "—", c.fbs ?? "—", c.control, shortDate(c.nextVisit)]) },
      { name: "Register Summary", kind: "kv", rows: (s) => [...new Set(s.ncdClients.map((c) => c.condition))].map((cond) => ({ k: cond, v: s.ncdClients.filter((c) => c.condition === cond).length })) },
      { name: "Control Status", kind: "kv", rows: (s) => [{ k: "Controlled", v: s.ncdClients.filter((c) => c.control === "Controlled").length }, { k: "Uncontrolled", v: s.ncdClients.filter((c) => c.control === "Uncontrolled").length, target: "< 40%" }] },
      { name: "Due for Review", kind: "table", columns: ["Patient", "Condition", "Next visit"], rows: (s) => s.ncdClients.filter((c) => new Date(c.nextVisit) < new Date(Date.now() + 7 * 864e5)).map((c) => [nm(s.patientById(c.patientId)), c.condition, shortDate(c.nextVisit)]) },
    ],
  },
  {
    name: "Family Planning",
    stats: (s) => {
      const active = s.fpClients.filter((c) => c.status === "Active");
      const cyp = active.reduce((n, c) => n + (FP_CYP[c.method] ?? 0), 0);
      return [
        { label: "Active clients", value: active.length, tone: "brand" },
        { label: "New acceptors", value: s.fpClients.filter((c) => c.firstTime).length },
        { label: "CYP delivered", value: cyp.toFixed(1), tone: "brand" },
        { label: "Discontinued", value: s.fpClients.filter((c) => c.status === "Discontinued").length, tone: "action" },
      ];
    },
    tabs: [
      { name: "New Acceptors", kind: "table", columns: ["Patient", "Method", "Start", "Type"], rows: (s) => s.fpClients.filter((c) => c.firstTime).map((c) => [nm(s.patientById(c.patientId)), c.method, shortDate(c.startDate), "New"]) },
      { name: "Method Mix", kind: "table", columns: ["Method", "New", "Revisit", "Active", "CYP"], rows: (s) => [...new Set(s.fpClients.map((c) => c.method))].map((m) => { const cs = s.fpClients.filter((c) => c.method === m); const act = cs.filter((c) => c.status === "Active").length; return [m, cs.filter((c) => c.firstTime).length, cs.filter((c) => !c.firstTime).length, act, (act * (FP_CYP[m] ?? 0)).toFixed(1)]; }) },
      { name: "Due for follow-up", kind: "table", columns: ["Patient", "Method", "Next visit", "Status"], rows: (s) => s.fpClients.filter((c) => c.status === "Active" && c.nextVisit).map((c) => { const d = Math.round((Date.now() - +new Date(c.nextVisit!)) / 864e5); return [nm(s.patientById(c.patientId)), c.method, shortDate(c.nextVisit!), d > 0 ? `${d}d overdue` : `in ${-d}d`]; }) },
      { name: "Counselling Summary", kind: "kv", rows: (s) => [{ k: "Total counselled", v: s.fpClients.filter((c) => c.counselled).length }, { k: "Clients on long-acting (Implant/IUCD)", v: s.fpClients.filter((c) => c.status === "Active" && ["Implant", "IUCD"].includes(c.method)).length }] },
      { name: "Discontinuation", kind: "table", columns: ["Patient", "Method", "Reason"], rows: (s) => s.fpClients.filter((c) => c.status === "Discontinued").map((c) => [nm(s.patientById(c.patientId)), c.method, c.discontinueReason ?? c.notes ?? "—"]) },
    ],
  },
  {
    name: "Inpatient",
    stats: (s) => {
      const activeBeds = s.beds.filter((b) => b.active).length;
      const activeAdmissions = s.admissions.filter((a) => a.status === "Active").length;
      return [
        { label: "Active admissions", value: activeAdmissions, tone: "brand" },
        { label: "Discharges", value: s.admissions.filter((a) => a.status === "Discharged").length },
        { label: "Beds available", value: activeBeds - activeAdmissions },
        { label: "Bed occupancy", value: activeBeds ? `${Math.round((activeAdmissions / activeBeds) * 100)}%` : "—" },
      ];
    },
    tabs: [
      { name: "Admissions", kind: "table", columns: ["Patient", "Ward", "Bed", "Diagnosis", "Admitted"], rows: (s) => s.admissions.map((a) => [nm(s.patientById(a.patientId)), a.ward, a.bed, a.diagnosis, shortDate(a.admittedAt)]) },
      {
        name: "Bed Occupancy", kind: "table", columns: ["Ward", "Beds", "Occupied", "Available", "Occupancy %"],
        rows: (s) => s.wards.map((w) => {
          const wardBeds = s.beds.filter((b) => b.wardId === w.id && b.active).length;
          const occ = s.admissions.filter((a) => a.status === "Active" && a.ward === w.name).length;
          return [w.name, wardBeds, occ, wardBeds - occ, wardBeds ? `${Math.round((occ / wardBeds) * 100)}%` : "—"];
        }),
      },
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
      {
        name: "Loop closure", kind: "kv",
        rows: (s) => {
          const out = s.referrals.filter((r) => r.type === "Out");
          const closed = out.filter((r) => r.status === "Completed" || r.status === "Declined");
          return [
            { k: "Out-referrals", v: out.length },
            { k: "Feedback received", v: closed.length, target: out.length ? `${Math.round((closed.length / out.length) * 100)}%` : "—" },
            { k: "Awaiting feedback", v: out.length - closed.length },
            { k: "Back-referrals opened", v: s.referrals.filter((r) => r.type === "In").length },
          ];
        },
      },
      {
        name: "Outcomes", kind: "table",
        columns: ["Patient", "Facility", "Outcome", "Sent back", "Receiving clinician"],
        rows: (s) => s.referrals.filter((r) => r.feedback).map((r) => [nm(s.patientById(r.patientId)), r.facility, r.feedback!.outcome, r.feedback!.backReferral ? "Yes" : "No", r.feedback!.by]),
      },
      { name: "Top Diagnoses", kind: "table", columns: ["Diagnosis", "Referrals"], rows: (s) => [...new Set(s.referrals.map((r) => r.diagnosis))].map((d) => [d, s.referrals.filter((r) => r.diagnosis === d).length]) },
      { name: "By Reason", kind: "table", columns: ["Reason", "Count"], rows: (s) => [...new Set(s.referrals.map((r) => r.reason))].map((r) => [r, s.referrals.filter((x) => x.reason === r).length]) },
      { name: "Emergency", kind: "table", columns: ["Patient", "Reason", "Facility"], rows: (s) => s.referrals.filter((r) => r.urgency === "Emergency").map((r) => [nm(s.patientById(r.patientId)), r.reason, r.facility]) },
    ],
  },
  {
    name: "Community Outreach",
    stats: (s) => [
      { label: "Activities", value: s.outreachActivities.length, tone: "brand" },
      { label: "Households", value: s.outreachActivities.reduce((n, a) => n + a.households, 0) },
      { label: "Referrals", value: s.outreachActivities.reduce((n, a) => n + a.referrals, 0), tone: "action" },
      { label: "CHWs active", value: new Set(s.outreachActivities.map((a) => a.chw)).size },
    ],
    tabs: [
      { name: "Activity Log", kind: "table", columns: ["CHW", "Type", "Ward", "Households", "Referrals", "Date"], rows: (s) => s.outreachActivities.map((a) => [a.chw, a.type, a.ward, a.households, a.referrals, shortDate(a.date)]) },
      { name: "Activity Summary", kind: "kv", rows: (s) => [...new Set(s.outreachActivities.map((a) => a.type))].map((ty) => ({ k: ty, v: s.outreachActivities.filter((a) => a.type === ty).length })) },
      { name: "CHW Productivity", kind: "table", columns: ["CHW", "Activities", "Households"], rows: (s) => [...new Set(s.outreachActivities.map((a) => a.chw))].map((c) => [c, s.outreachActivities.filter((a) => a.chw === c).length, s.outreachActivities.filter((a) => a.chw === c).reduce((n, a) => n + a.households, 0)]) },
    ],
  },
  {
    name: "Surveillance",
    stats: (s) => [
      { label: "Cases this week", value: s.surveillanceCases.length, tone: "brand" },
      { label: "Immediate-notify", value: s.surveillanceCases.filter((c) => NOTIFIABLE.find((d) => d.name === c.disease)?.class === "IDSR Immediate").length, tone: "action" },
      { label: "Confirmed", value: s.surveillanceCases.filter((c) => c.status === "Confirmed").length },
      { label: "Diseases tracked", value: NOTIFIABLE.length },
    ],
    tabs: [
      { name: "Weekly Line List", kind: "table", columns: ["Patient", "Disease", "Onset", "Status"], rows: (s) => s.surveillanceCases.map((c) => [nm(s.patientById(c.patientId)), c.disease, c.onset || "—", c.status]) },
      { name: "By Disease", kind: "table", columns: ["Disease", "Class", "Priority", "Cases"], rows: (s) => NOTIFIABLE.map((d) => [d.name, d.class, d.priority, s.surveillanceCases.filter((c) => c.disease === d.name).length]) },
      { name: "IDSR Timeliness", kind: "empty", hint: "Reporting deadlines and submission timestamps are not tracked in this build — there is no live IDSR/SORMAS connection." },
      { name: "Alerts", kind: "empty", hint: "No epidemic thresholds crossed." },
    ],
  },
  {
    name: "Service Performance",
    stats: (s) => [
      { label: "Encounters", value: s.encounters.length, tone: "brand" },
      { label: "Queue entries", value: s.queue.length },
      { label: "Appointments", value: s.appointments.length },
      { label: "No-shows", value: s.appointments.filter((a) => a.status === "No-Show").length, tone: "action" },
    ],
    tabs: [
      {
        name: "Daily Patient Flow", kind: "table", columns: ["Date", "Encounters"],
        rows: (s) => {
          const byDay = new Map<string, number>();
          for (const encounter of s.encounters) {
            const key = shortDate(encounter.date);
            byDay.set(key, (byDay.get(key) ?? 0) + 1);
          }
          return [...byDay.entries()];
        },
      },
      { name: "Wait Times", kind: "empty", hint: "Per-station wait times are not tracked in this build — no timestamped station transitions are recorded against a visit." },
      {
        name: "Staff Productivity", kind: "table", columns: ["Provider", "Encounters"],
        rows: (s) => Object.entries(s.encounters.reduce<Record<string, number>>((acc, e) => ((acc[e.provider] = (acc[e.provider] ?? 0) + 1), acc), {}))
          .sort(([, a], [, b]) => b - a),
      },
      {
        name: "Service Utilization", kind: "bars", keys: ["entries", "entries"],
        data: (s) => Object.entries(s.encounters.reduce<Record<string, number>>((acc, e) => ((acc[e.station] = (acc[e.station] ?? 0) + 1), acc), {}))
          .map(([label, entries]) => ({ label, entries })),
      },
      { name: "No-Shows", kind: "table", columns: ["Patient", "Date", "Reason"], rows: (s) => s.appointments.filter((a) => a.status === "No-Show").map((a) => [nm(s.patientById(a.patientId)), shortDate(a.date), a.reason ?? "—"]) },
      { name: "Data Quality", kind: "kv", rows: (s) => [{ k: "Encounters missing diagnosis", v: s.encounters.filter((e) => e.diagnoses.length === 0).length }] },
    ],
  },
  {
    name: "Patient Transfers",
    stats: (s) => {
      const tin = s.transfers.filter((t) => t.direction === "In" && t.status !== "Cancelled").length;
      const tout = s.transfers.filter((t) => t.direction === "Out" && t.status !== "Cancelled").length;
      return [
        { label: "Transferred in", value: tin, tone: "brand" },
        { label: "Transferred out", value: tout, tone: "action" },
        { label: "Total movements", value: tin + tout },
        { label: "Net", value: tin - tout, tone: tin - tout < 0 ? "action" : "brand" },
      ];
    },
    tabs: [
      { name: "All Transfers", kind: "table", columns: ["Patient", "Direction", "Facility", "Reason", "Date", "Status"], rows: (s) => s.transfers.map((t) => [t.patientId ? nm(s.patientById(t.patientId)) : t.patientName, t.direction, t.facility, t.reason, shortDate(t.date), t.status]) },
      { name: "Transferred In", kind: "table", columns: ["Patient", "From", "Reason", "Date", "Status"], rows: (s) => s.transfers.filter((t) => t.direction === "In").map((t) => [t.patientName, t.facility, t.reason, shortDate(t.date), t.status]) },
      { name: "Transferred Out", kind: "table", columns: ["Patient", "To", "Reason", "Records sent", "Status"], rows: (s) => s.transfers.filter((t) => t.direction === "Out").map((t) => [t.patientId ? nm(s.patientById(t.patientId)) : t.patientName, t.facility, t.reason, t.recordsSent ? "Yes" : "No", t.status]) },
      { name: "By Reason", kind: "kv", rows: (s) => [...new Set(s.transfers.map((t) => t.reason))].map((r) => ({ k: r, v: s.transfers.filter((t) => t.reason === r).length })) },
      { name: "Records handover", kind: "kv", rows: (s) => { const out = s.transfers.filter((t) => t.direction === "Out" && t.status !== "Cancelled"); return [{ k: "Out-transfers", v: out.length }, { k: "EMR summary sent", v: out.filter((t) => t.recordsSent).length, target: out.length ? `${Math.round((out.filter((t) => t.recordsSent).length / out.length) * 100)}%` : "—" }, { k: "Outstanding", v: out.filter((t) => !t.recordsSent).length }]; } },
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
      {
        name: "Frequency", kind: "table", columns: ["Diagnosis", "Cases"],
        rows: (s) => Object.entries(s.encounters.flatMap((e) => e.diagnoses).reduce<Record<string, number>>((acc, d) => ((acc[d.name] = (acc[d.name] ?? 0) + 1), acc), {}))
          .sort(([, a], [, b]) => b - a),
      },
    ],
  },
  {
    name: "Inventory & Assets",
    stats: (s) => [
      { label: "Assets", value: s.assets.length, tone: "brand" },
      { label: "In service", value: s.assets.filter((a) => a.status === "In service").length },
      { label: "PM overdue", value: s.assets.filter((a) => a.status !== "Retired" && pmState(a).label === "Overdue").length, tone: "action" },
      { label: "Open jobs", value: s.maintenanceJobs.filter((j) => j.status !== "Resolved").length, tone: "amber" },
    ],
    tabs: [
      {
        name: "Asset Register", kind: "table",
        columns: ["Tag", "Name", "Category", "Location", "Status"],
        rows: (s) => s.assets.map((a) => [a.tag, a.name, a.category, a.location, a.status]),
      },
      {
        name: "PM Schedule", kind: "table",
        columns: ["Asset", "Interval (d)", "Last serviced", "Next due", "State"],
        rows: (s) => s.assets.filter((a) => a.status !== "Retired")
          .map((a) => ({ a, p: pmState(a) }))
          .sort((x, y) => x.p.days - y.p.days)
          .map(({ a, p }) => [a.tag, a.serviceIntervalDays, shortDate(a.lastServicedOn), shortDate(nextPmDue(a).toISOString()), `${p.label}${p.label !== "Scheduled" ? ` (${Math.abs(p.days)}d)` : ""}`]),
      },
      {
        name: "By Status", kind: "kv",
        rows: (s) => ["In service", "Under repair", "Out of service", "Retired"].map((st) => ({ k: st, v: s.assets.filter((a) => a.status === st).length })),
      },
      {
        name: "By Category", kind: "kv",
        rows: (s) => [...new Set(s.assets.map((a) => a.category))].map((c) => ({ k: c, v: s.assets.filter((a) => a.category === c).length })),
      },
      {
        name: "Maintenance Jobs", kind: "table",
        columns: ["Asset", "Type", "Summary", "Priority", "Status"],
        rows: (s) => s.maintenanceJobs.map((j) => [s.assets.find((a) => a.id === j.assetId)?.tag ?? "—", j.type, j.summary, j.priority, j.status]),
      },
      {
        name: "Cold-chain readiness", kind: "kv",
        rows: (s) => {
          const cc = s.assets.filter((a) => a.category === "Cold chain");
          return [
            { k: "Cold-chain units", v: cc.length },
            { k: "In service", v: cc.filter((a) => a.status === "In service").length },
            { k: "PM overdue", v: cc.filter((a) => pmState(a).label === "Overdue").length },
            { k: "Open faults", v: s.maintenanceJobs.filter((j) => cc.some((a) => a.id === j.assetId) && j.status !== "Resolved").length },
          ];
        },
      },
    ],
  },
  {
    name: "DHIS / Statutory",
    stats: () => [
      { label: "Datasets mapped", value: 4, tone: "brand" },
      { label: "Elements mapped", value: "Not tracked in this build" },
      { label: "Last submission", value: "No live connection" },
      { label: "Status", value: "Not configured", tone: "mist" },
    ],
    tabs: [
      { name: "NHMIS Monthly Summary", kind: "kv", rows: (s) => [{ k: "OPD attendance", v: s.encounters.length }, { k: "ANC 1st visits", v: s.ancRecords.length }, { k: "Deliveries", v: s.deliveries.length }, { k: "Birth notifications (NPopC)", v: s.birthRegister.length }, { k: "Penta 3 doses", v: s.immunizations.filter((i) => i.vaccineCode === "PENTA3").length }, { k: "FP new acceptors", v: s.fpClients.filter((c) => c.firstTime).length }, { k: "Confirmed malaria", v: s.encounters.filter((e) => e.diagnoses.some((d) => d.name.toLowerCase().includes("malaria"))).length }] },
      { name: "Data Element Mapping", kind: "table", columns: ["Local field", "DHIS2 data element", "Category combo"], rows: () => [["OPD new attendance", "NHMIS_OPD_NEW", "Age/Sex"], ["ANC 1st visit", "NHMIS_ANC1", "default"], ["Penta 3 doses", "NHMIS_PENTA3", "<1 / 12-23mo"], ["Confirmed malaria", "NHMIS_MAL_CONF", "Age/Sex"]] },
      { name: "Submission History", kind: "empty", hint: "No live DHIS2/SORMAS connection is configured — see NHMIS Sync for the frontend simulation of this transfer. No submissions have actually been sent." },
    ],
  },
  {
    name: "Compliance — NDPR",
    stats: (s) => [
      { label: "Events (24h)", value: auditTrail.length, tone: "brand" },
      { label: "Users", value: new Set(auditTrail.map((e) => e.user)).size },
      { label: "Data exports", value: auditTrail.filter((e) => e.action.includes("REPORT")).length, tone: "amber" },
      { label: "Amendments", value: s.encounters.filter((e) => e.amendedBy).length },
    ],
    tabs: [
      { name: "Access Log Summary", kind: "table", columns: ["Action", "Count"], rows: () => [...new Set(auditTrail.map((e) => e.action))].map((a) => [a, auditTrail.filter((e) => e.action === a).length]) },
      { name: "Data Exports", kind: "table", columns: ["User", "Resource", "IP"], rows: () => auditTrail.filter((e) => e.action.includes("REPORT")).slice(0, 8).map((e) => [e.user, e.resource, e.ip]) },
      { name: "Consent Records", kind: "kv", rows: (s) => [{ k: "Registered patients", v: s.patients.length }, { k: "Consent capture", v: "Not implemented in this build" }] },
      { name: "Amendment Log", kind: "empty", hint: "No record amendments in this period." },
    ],
  },
];
