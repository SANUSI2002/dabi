import { useEffect, useState } from "react";
import type { Patient } from "@/data/types";
import { rankDuplicates, type DuplicateCandidate, type DuplicateMatch } from "@/lib/duplicates";
import { emrRequest } from "./client";
import { patientFromApi, registrationToApi, type ApiPatient, type RegistrationForm } from "./mappers";

// The hospital's live patient registry: server-side search, the patient count, likely-duplicate
// checks while a registration form is typed, and the registry-wide duplicate review.

const PAGE_SIZE = 100;
const SEARCH_DELAY_MS = 300;
const MAX_QUERY = 50; // the API's search limit

type PatientList = { data: { items: ApiPatient[]; total: number } };

/** Registry rows for the search box, newest first (up to 100), and how many patients are on file. */
export function useLivePatients(query: string, enabled: boolean, refreshKey: number) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [matching, setMatching] = useState(0);
  const [onFile, setOnFile] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const q = query.trim().slice(0, MAX_QUERY);
    const timer = window.setTimeout(() => {
      emrRequest<PatientList>(`/patients?limit=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((result) => {
          if (!active) return;
          setPatients(result.data.items.map(patientFromApi));
          setMatching(result.data.total);
          if (!q) setOnFile(result.data.total);
          setError("");
        })
        .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Patients could not be loaded."); })
        .finally(() => { if (active) setLoaded(true); });
    }, q ? SEARCH_DELAY_MS : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, enabled, refreshKey]);

  return { patients, matching, onFile, loaded, error };
}

/** Quick patient lookup for pickers and the top search bar. */
export function useLivePatientSearch(query: string, enabled: boolean, limit: number) {
  const [results, setResults] = useState<Patient[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query.trim().slice(0, MAX_QUERY);
    let active = true;
    const timer = window.setTimeout(() => {
      emrRequest<PatientList>(`/patients?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((result) => { if (active) setResults(result.data.items.map(patientFromApi)); })
        .catch(() => { if (active) setResults([]); });
    }, SEARCH_DELAY_MS);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, enabled, limit]);
  return enabled ? results : [];
}

const PHONE = /^\+?[0-9][0-9 -]{6,19}$/;
const plausibleBirthDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1850-01-01" && value <= new Date().toISOString().slice(0, 10);

/** Existing patients who may be the person being registered, scored like the demo registry. */
export function useLiveDuplicateMatches(candidate: DuplicateCandidate | null, enabled: boolean) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const firstName = candidate?.firstName.trim() ?? "";
  const lastName = candidate?.lastName.trim() ?? "";
  const dob = candidate?.dob ?? "";
  const phone = candidate?.phone?.trim() ?? "";
  const nin = candidate?.nin?.replace(/\s/g, "") ?? "";

  const ready = enabled && Boolean(firstName && lastName);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    // Only send what the API will accept, so a half-typed phone number never fails the whole check.
    const params = new URLSearchParams({ givenName: firstName, familyName: lastName });
    if (plausibleBirthDate(dob)) params.set("dateOfBirth", dob);
    if (PHONE.test(phone)) params.set("phone", phone);
    if (/^\d{11}$/.test(nin)) params.set("nationalId", nin);
    const timer = window.setTimeout(() => {
      emrRequest<{ data: { items: ApiPatient[] } }>(`/patients/duplicates?${params}`)
        .then((result) => {
          if (active) setMatches(rankDuplicates({ firstName, lastName, dob, phone, nin }, result.data.items.map(patientFromApi)));
        })
        .catch(() => { if (active) setMatches([]); });
    }, SEARCH_DELAY_MS);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, firstName, lastName, dob, phone, nin]);

  return ready ? matches : [];
}

export type DuplicatePair = { left: Patient; right: Patient; reasons: string[] };
const PAIR_REASONS: Record<string, string> = { SAME_PHONE: "Same phone number", SAME_NAME_AND_DATE_OF_BIRTH: "Same name and date of birth" };
type ApiPair = { left: ApiPatient; right: ApiPatient; reasons: string[] };

/** Registry-wide review of records that share an identifier (never merged automatically). */
export function useLiveDuplicatePairs(enabled: boolean, refreshKey: number) {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    emrRequest<{ data: { items: ApiPair[] } }>("/patients/duplicate-pairs")
      .then((result) => {
        if (!active) return;
        setPairs(result.data.items.map((pair) => ({
          left: patientFromApi(pair.left),
          right: patientFromApi(pair.right),
          reasons: pair.reasons.map((reason) => PAIR_REASONS[reason] ?? reason),
        })));
      })
      .catch(() => { if (active) setPairs([]); });
    return () => { active = false; };
  }, [enabled, refreshKey]);
  return enabled ? pairs : [];
}

/**
 * Registers a patient. The same idempotency key is reused until the registration succeeds, so a
 * retried or double-clicked submit never creates two records.
 */
export async function registerLivePatient(form: RegistrationForm, idempotencyKey: string) {
  const result = await emrRequest<{ data: ApiPatient }>("/patients", { method: "POST", body: registrationToApi(form), idempotencyKey });
  return patientFromApi(result.data);
}
