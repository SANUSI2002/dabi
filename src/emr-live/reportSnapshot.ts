import { useEffect, useMemo } from "react";
import type { Patient } from "@/data/types";
import type { EmrSnapshot } from "@/pages/admin/reports/types";
import { emrRequest } from "./client";
import { useLiveAntenatal } from "./antenatal";
import { useLiveAppointments } from "./appointments";
import { useLiveDeliveries } from "./deliveries";
import { useLiveEquipment } from "./equipment";
import { useLiveFamilyPlanning } from "./familyPlanning";
import { doseFromApi, type LiveDose } from "./immunizations";
import { useLiveWards } from "./inpatient";
import { useLiveNutrition } from "./nutrition";
import { useLiveOutreach } from "./outreach";
import { useLivePharmacy } from "./pharmacy";
import { useLivePostnatal } from "./postnatal";
import { useLiveProgrammes } from "./programmes";
import { useLiveQueue } from "./queue";
import { useLiveReferrals } from "./referrals";
import { useLiveReports } from "./reports";
import { useLiveEmr } from "./session";
import { useLiveSurveillance } from "./surveillance";
import { useLiveTransfers } from "./transfers";
import { create } from "zustand";

// The Reports page's snapshot for a live hospital, assembled only from its own EMR: the period's
// visits, lab orders and immunizations, every module register, the formulary stock and the audit
// trail, and the equipment register with its maintenance jobs.

const usePeriodDoses = create<{ doses: LiveDose[]; load: (from: string, to: string) => Promise<void> }>((set) => ({
  doses: [],
  load: async (from, to) => {
    try {
      const result = await emrRequest<{ data: { items: Parameters<typeof doseFromApi>[0][] } }>(`/immunizations?from=${from}&to=${to}&limit=2000`);
      set({ doses: result.data.items.filter((d) => d.status === "ACTIVE").map(doseFromApi) });
    } catch {
      set({ doses: [] });
    }
  },
}));

/** Loads every source the reports read, once per period (each module keeps its own error state). */
export function useLiveReportSnapshotLoad(enabled: boolean, from: string, to: string) {
  const hospital = useLiveEmr((state) => state.access?.organizationName ?? "");
  useEffect(() => {
    if (!enabled) return;
    void useLiveReports.getState().loadSource(from, to);
    void usePeriodDoses.getState().load(from, to);
  }, [enabled, from, to]);
  useEffect(() => {
    if (!enabled) return;
    const quiet = (work: Promise<unknown>) => void work.catch(() => undefined);
    quiet(useLiveReferrals.getState().load());
    quiet(useLiveTransfers.getState().load());
    quiet(useLiveAntenatal.getState().load());
    quiet(useLiveFamilyPlanning.getState().load());
    quiet(useLiveNutrition.getState().load());
    quiet(useLiveDeliveries.getState().load(hospital));
    quiet(useLivePostnatal.getState().load());
    quiet(useLiveOutreach.getState().load());
    quiet(useLiveSurveillance.getState().load());
    quiet(useLiveProgrammes.getState().loadNcd());
    quiet(useLiveWards.getState().load());
    quiet(useLiveAppointments.getState().load());
    quiet(useLiveQueue.getState().load());
    quiet(useLivePharmacy.getState().load());
    quiet(useLiveEquipment.getState().load());
    quiet(useLiveReports.getState().loadAudit());
  }, [enabled, hospital]);
}

export function useLiveReportSnapshot(): EmrSnapshot & { truncated: boolean; ready: boolean } {
  const source = useLiveReports((s) => s.source);
  const audit = useLiveReports((s) => s.audit);
  const doses = usePeriodDoses((s) => s.doses);
  const referrals = useLiveReferrals((s) => s.referrals);
  const transfers = useLiveTransfers((s) => s.transfers);
  const ancRecords = useLiveAntenatal((s) => s.records);
  const fpClients = useLiveFamilyPlanning((s) => s.clients);
  const childVisits = useLiveNutrition((s) => s.visits);
  const cmamScreenings = useLiveNutrition((s) => s.screenings);
  const deliveries = useLiveDeliveries((s) => s.deliveries);
  const birthRegister = useLiveDeliveries((s) => s.register);
  const pncVisits = useLivePostnatal((s) => s.visits);
  const outreachActivities = useLiveOutreach((s) => s.activities);
  const surveillanceCases = useLiveSurveillance((s) => s.cases);
  const ncdClients = useLiveProgrammes((s) => s.ncd);
  const admitted = useLiveWards((s) => s.admissions);
  const discharged = useLiveWards((s) => s.discharged);
  const wards = useLiveWards((s) => s.wards);
  const beds = useLiveWards((s) => s.beds);
  const appointments = useLiveAppointments((s) => s.items);
  const queue = useLiveQueue((s) => s.entries);
  const formulary = useLivePharmacy((s) => s.drugs);
  const equipment = useLiveEquipment((s) => s.assets);
  const maintenance = useLiveEquipment((s) => s.jobs);

  return useMemo(() => {
    // People named anywhere in the snapshot, so rows can show who they are.
    const people = new Map<string, Patient>();
    const add = (p?: Patient) => { if (p && !people.has(p.id)) people.set(p.id, p); };
    for (const p of source?.patients ?? []) add(p);
    for (const list of [doses, referrals, transfers, ancRecords, fpClients, childVisits, cmamScreenings, deliveries, pncVisits, surveillanceCases, ncdClients, admitted, discharged, appointments] as { patient?: Patient }[][]) {
      for (const item of list) add(item.patient);
    }
    const admissions = [...admitted, ...discharged.filter((d) => !admitted.some((a) => a.id === d.id))];
    return {
      patients: [...people.values()], queue, encounters: source?.encounters ?? [], labOrders: source?.labOrders ?? [], admissions, appointments,
      referrals, transfers, ancRecords, fpClients, childVisits, deliveries, birthRegister, immunizations: doses, pncVisits, cmamScreenings,
      outreachActivities, surveillanceCases, ncdClients, patientById: (id: string) => people.get(id),
      assets: equipment, maintenanceJobs: maintenance, wards, beds,
      drugs: formulary.filter((d) => d.active).map((d) => ({ name: d.name, form: d.form, stock: d.onHand, reorder: d.reorderLevel })),
      auditEvents: audit, registry: source?.registry,
      truncated: source?.truncated ?? false, ready: source !== null,
    } as EmrSnapshot & { truncated: boolean; ready: boolean };
  }, [source, audit, doses, referrals, transfers, ancRecords, fpClients, childVisits, cmamScreenings, deliveries, birthRegister, pncVisits, outreachActivities, surveillanceCases, ncdClients, admitted, discharged, wards, beds, appointments, queue, formulary, equipment, maintenance]);
}
