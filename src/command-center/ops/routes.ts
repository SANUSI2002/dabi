// Where each Command Centre section lives, and how a drill-down from the API becomes a link.
import type { Drill } from './api';

export const CC = '/command-center';
export const R = {
  overview: CC,
  patients: `${CC}/sabi-health/patients`,
  orders: `${CC}/sabi-health/orders`,
  deliveries: `${CC}/sabi-health/deliveries`,
  consultations: `${CC}/sabi-health/consultations`,
  prescriptions: `${CC}/sabi-health/prescriptions`,
  finance: `${CC}/sabi-health/payments`,
  pricing: `${CC}/sabi-health/delivery-pricing`,
  credentials: `${CC}/sabi-health/credentials`,
  doctors: `${CC}/sabi-health/doctors`,
  pharmacies: `${CC}/sabi-health/pharmacies`,
  pharmacyExceptions: `${CC}/sabi-health/pharmacy-exceptions`,
  listings: `${CC}/pharmacy-listings`,
  cases: `${CC}/cases`,
  incidents: `${CC}/incidents`,
  jobs: `${CC}/jobs`,
  notifications: `${CC}/notifications`,
  integrations: `${CC}/integrations`,
  health: `${CC}/health`,
  alerts: `${CC}/alerts`,
  audit: `${CC}/audit`,
} as const;

const SECTION: Record<string, string> = {
  orders: R.orders, finance: R.finance, pricing: R.pricing, deliveries: R.deliveries, consultations: R.consultations, audit: R.audit,
  doctors: R.doctors, pharmacies: R.pharmacies, support: R.cases, incidents: R.incidents, jobs: R.jobs, providers: R.credentials,
  integrations: R.integrations, patients: R.patients,
};

export function drillTo(drill?: Drill): string | null {
  if (!drill) return null;
  if (drill.section === 'pharmacies' && drill.filter?.tab === 'listings') return R.listings;
  if (drill.section === 'patients' && typeof drill.filter?.id === 'string') return `${R.patients}/${drill.filter.id}`;
  const base = SECTION[drill.section];
  if (!base) return null;
  const params = new URLSearchParams(Object.entries(drill.filter ?? {}).filter(([k]) => k !== 'id').map(([k, v]) => [k, String(v)]));
  return params.size ? `${base}?${params}` : base;
}
