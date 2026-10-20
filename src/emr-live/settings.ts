import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { FieldDef } from "@/pages/admin/settingsConfig";
import { liveApiRequest, liveCreateInvitation, liveInvitationRoles } from "@/identity/liveIdentity";
import { emrRequest } from "./client";
import { useLiveEmr } from "./session";

// Settings in live mode: each catalog tab reads and writes the hospital's own records —
//   Drugs → pharmacy formulary · Lab Tests → lab catalog (+ LAB price) · Diagnoses / Patient Categories →
//   hospital catalogs · Service Types & Tariffs → billing price list · Users → staff memberships and
//   invitations (Sabi ID). The national EPI schedule and IDSR disease list are fixed in the EMR and
//   shown read-only, with the reason.

export type LiveRow = Record<string, unknown> & { id: string; active: boolean };
export type LiveCatalog = {
  rows: LiveRow[];
  loading: boolean;
  error: string;
  /** set when the list is fixed (national schedule): edits are refused with this explanation */
  readOnly?: string;
  /** the add form in live mode, when it needs other fields than the demo's */
  addFields?: FieldDef[];
  editFields?: FieldDef[];
  add: (form: Record<string, unknown>) => Promise<void>;
  update: (row: LiveRow, form: Record<string, unknown>) => Promise<void>;
  toggle: (row: LiveRow) => Promise<void>;
};

const naira = (minor: number) => minor / 100;
const minor = (value: unknown) => Math.round(Number(value || 0) * 100);
const str = (value: unknown) => String(value ?? "").trim();
const codeFrom = (text: string, max = 24) => (text.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^[^A-Z]+/, "").replace(/_+$/, "") || "ITEM").slice(0, max);
const title = (code: string) => code.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
const fixed = (message: string) => async () => { throw new Error(message); };

type FormularyItem = { code: string; genericName: string; form: string; strength: string; drugClasses?: string[]; category: string | null; reorderLevel: number; active: boolean; version: number };
type LabTest = { code: string; name: string; section: string; analytes: { code: string; name: string; kind: string; unit?: string; low?: number; high?: number }[]; turnaroundMinutes: number; active: boolean; version: number };
type PriceItem = { id: string; category: string; reference: string; name: string; unitPriceMinor: number; active: boolean; version: number };
type CatalogEntry = { id: string; code: string; name: string; active: boolean; version: number; [key: string]: unknown };
type Membership = { id: string; status: string; user: { id: string; email: string; full_name: string | null }; roles: { roleCode: string }[] };

const ROUTES = ["PO", "SL", "IV", "IM", "SC", "INHALED", "TOPICAL", "PR", "PV", "OPHTHALMIC", "OTIC", "NASAL"];
const PRICE_CATEGORY: Record<string, string> = { Consultation: "CONSULTATION", Administrative: "OTHER", MCH: "CONSULTATION", "Child Health": "CONSULTATION", FP: "CONSULTATION", Lab: "LAB", Laboratory: "LAB", Pharmacy: "MEDICATION", Procedure: "PROCEDURE", Other: "OTHER" };
const PRICE_LABEL: Record<string, string> = { CONSULTATION: "Consultation", LAB: "Laboratory", MEDICATION: "Pharmacy", PROCEDURE: "Procedure", IMAGING: "Imaging", BED_DAY: "Bed day", OTHER: "Other" };
const rangeText = (a?: LabTest["analytes"][number]) => (!a || a.kind !== "NUMERIC" ? "—" : a.low !== undefined && a.high !== undefined ? `${a.low}–${a.high}` : a.low !== undefined ? `≥ ${a.low}` : a.high !== undefined ? `≤ ${a.high}` : "—");
function parseRange(text: string) {
  const value = text.replace(/\s+/g, "");
  const both = /^(-?\d+(?:\.\d+)?)[–-](-?\d+(?:\.\d+)?)$/.exec(value);
  if (both) return { low: Number(both[1]), high: Number(both[2]) };
  if (!value || value === "—") return {};
  throw new Error("Write the reference range as low–high, e.g. 4–11.");
}

type Loader = { load: () => Promise<LiveRow[]> } & Omit<LiveCatalog, "rows" | "loading" | "error">;

function loaderFor(key: string, organizationId: string): Loader {
  switch (key) {
    case "drugs":
      return {
        load: async () => (await emrRequest<{ data: { items: FormularyItem[] } }>("/pharmacy/formulary?includeInactive=true")).data.items.map((d) => ({
          id: d.code, version: d.version, active: d.active, code: d.code, name: d.genericName, form: d.form, strength: d.strength,
          klass: d.drugClasses?.[0] ? title(d.drugClasses[0]) : d.category ?? "—", reorder: d.reorderLevel,
        })),
        // A formulary entry needs its code, dose and dispense units and route for prescribing (as on the Pharmacy screen).
        addFields: [
          { key: "code", label: "Formulary code", type: "text" }, { key: "name", label: "Generic name", type: "text" },
          { key: "form", label: "Form", type: "text", default: "Tablet" }, { key: "strength", label: "Strength", type: "text" },
          { key: "doseUnit", label: "Dose unit", type: "text", default: "mg" }, { key: "dispenseUnit", label: "Dispense unit", type: "text", default: "tablet" },
          { key: "route", label: "Default route", type: "select", options: ROUTES, default: "PO" }, { key: "klass", label: "Class", type: "text", default: "" },
          { key: "reorder", label: "Reorder level", type: "number", default: 50 },
        ],
        add: async (f) => {
          await emrRequest("/pharmacy/formulary", {
            method: "POST",
            body: {
              code: codeFrom(str(f.code) || str(f.name)), genericName: str(f.name), form: str(f.form), strength: str(f.strength), doseUnit: str(f.doseUnit), dispenseUnit: str(f.dispenseUnit),
              defaultRoute: str(f.route) || "PO", reorderLevel: Number(f.reorder) || 0, ...(str(f.klass) ? { drugClasses: [codeFrom(str(f.klass))] } : {}),
            },
          });
        },
        update: async (row, f) => {
          await emrRequest(`/pharmacy/formulary/${encodeURIComponent(row.id)}`, {
            method: "PATCH", version: row.version as number,
            body: { genericName: str(f.name), form: str(f.form), strength: str(f.strength), reorderLevel: Number(f.reorder) || 0, ...(str(f.klass) && str(f.klass) !== "—" ? { drugClasses: [codeFrom(str(f.klass))] } : {}) },
          });
        },
        toggle: async (row) => { await emrRequest(`/pharmacy/formulary/${encodeURIComponent(row.id)}`, { method: "PATCH", version: row.version as number, body: { active: !row.active } }); },
      };

    case "labTests": {
      let prices: PriceItem[] = [];
      const priceFor = (code: string) => prices.find((p) => p.category === "LAB" && p.reference === code);
      const savePrice = async (code: string, name: string, price: unknown) => {
        const existing = priceFor(code);
        if (existing) await emrRequest(`/billing/prices/${existing.id}`, { method: "PATCH", version: existing.version, body: { unitPriceMinor: minor(price) } });
        else if (Number(price) > 0) await emrRequest("/billing/prices", { method: "POST", body: { category: "LAB", reference: code, name, unitPriceMinor: minor(price) } });
      };
      return {
        load: async () => {
          const [tests, priceList] = await Promise.all([
            emrRequest<{ data: LabTest[] | { items: LabTest[] } }>("/lab/tests?includeInactive=true"),
            emrRequest<{ data: { items: PriceItem[] } | PriceItem[] }>("/billing/prices?category=LAB&includeInactive=true").catch(() => ({ data: [] as PriceItem[] })),
          ]);
          prices = Array.isArray(priceList.data) ? priceList.data : priceList.data.items;
          const list = Array.isArray(tests.data) ? tests.data : tests.data.items;
          return list.map((t) => ({
            id: t.code, version: t.version, active: t.active, analytes: t.analytes, name: t.name, category: t.section,
            unit: t.analytes.length === 1 ? t.analytes[0].unit ?? "—" : `${t.analytes.length} analytes`, ref: t.analytes.length === 1 ? rangeText(t.analytes[0]) : "Per analyte",
            price: priceFor(t.code) ? naira(priceFor(t.code)!.unitPriceMinor) : 0, tat: t.turnaroundMinutes,
          }));
        },
        add: async (f) => {
          const name = str(f.name);
          const code = codeFrom(name);
          const unit = str(f.unit);
          const range = parseRange(str(f.ref));
          // One result field to start with; add more analytes from Lab Test Settings.
          const analyte = unit || range.low !== undefined ? { code: codeFrom(name, 20), name, kind: "NUMERIC", ...(unit ? { unit } : {}), ...range } : { code: codeFrom(name, 20), name, kind: "TEXT" };
          await emrRequest("/lab/tests", { method: "POST", body: { code, name, section: str(f.category) || "General", specimenType: "As collected", analytes: [analyte], turnaroundMinutes: Math.max(5, Number(f.tat) || 30) } });
          await savePrice(code, name, f.price);
        },
        update: async (row, f) => {
          const analytes = row.analytes as LabTest["analytes"];
          const single = analytes.length === 1 && analytes[0].kind === "NUMERIC";
          const nextAnalytes = single ? [{ ...analytes[0], ...(str(f.unit) && str(f.unit) !== "—" ? { unit: str(f.unit) } : {}), ...parseRange(str(f.ref)) }] : undefined;
          await emrRequest(`/lab/tests/${encodeURIComponent(row.id)}`, {
            method: "PATCH", version: row.version as number,
            body: { name: str(f.name), section: str(f.category), turnaroundMinutes: Math.max(5, Number(f.tat) || 30), ...(nextAnalytes ? { analytes: nextAnalytes } : {}) },
          });
          await savePrice(row.id, str(f.name), f.price);
        },
        toggle: async (row) => { await emrRequest(`/lab/tests/${encodeURIComponent(row.id)}`, { method: "PATCH", version: row.version as number, body: { active: !row.active } }); },
      };
    }

    case "diagnoses":
    case "categories": {
      const path = key === "diagnoses" ? "/catalogs/diagnoses" : "/catalogs/categories";
      const fields = (f: Record<string, unknown>) => (key === "diagnoses"
        ? { name: str(f.name), chapter: str(f.chapter) || "General", ncd: Boolean(f.ncd), notifiable: Boolean(f.notifiable) }
        : { name: str(f.name), exempt: Boolean(f.exempt), ...(str(f.reason) && str(f.reason) !== "—" ? { reason: str(f.reason) } : {}) });
      return {
        load: async () => (await emrRequest<{ data: { items: CatalogEntry[] } }>(`${path}?includeInactive=true`)).data.items.map((e) => ({ ...e, reason: e.reason ?? "—" })),
        add: async (f) => { await emrRequest(path, { method: "POST", body: { code: str(f.code), ...fields(f) } }); },
        update: async (row, f) => { await emrRequest(`${path}/${row.id}`, { method: "PATCH", version: row.version as number, body: fields(f) }); },
        toggle: async (row) => { await emrRequest(`${path}/${row.id}`, { method: "PATCH", version: row.version as number, body: { active: !row.active } }); },
      };
    }

    case "vaccines": {
      const message = "The routine immunization schedule is the national (NPHCDA) one, fixed in this EMR; it cannot be edited here.";
      return {
        readOnly: message,
        load: async () => (await emrRequest<{ data: { items: { code: string; name: string; ageWeeks: number }[] } }>("/catalogs/vaccines")).data.items.map((v) => ({
          id: v.code, active: true, code: v.code, name: v.name,
          ageLabel: v.ageWeeks === 0 ? "Birth" : v.ageWeeks < 39 ? `${v.ageWeeks} weeks` : `${Math.round(v.ageWeeks / 4.345)} months`,
          dose: Number(/Dose (\d)/.exec(v.name)?.[1] ?? /(\d)$/.exec(v.code)?.[1] ?? 1), route: "—", site: "—",
        })),
        add: fixed(message), update: fixed(message), toggle: fixed(message),
      };
    }

    case "notifiable": {
      const message = "Notifiable diseases are Nigeria's IDSR priority list, fixed in this EMR; it cannot be edited here.";
      return {
        readOnly: message,
        load: async () => (await emrRequest<{ data: { items: { code: string; name: string; class: string; immediate: boolean }[] } }>("/catalogs/diseases")).data.items.map((d) => ({
          id: d.code, active: true, code: d.code, name: d.name, class: d.class, priority: d.immediate ? "Critical" : "Routine", window: d.immediate ? "Within 24 hours" : d.class.replace("IDSR ", ""),
        })),
        add: fixed(message), update: fixed(message), toggle: fixed(message),
      };
    }

    case "services":
      return {
        load: async () => {
          const result = await emrRequest<{ data: { items: PriceItem[] } | PriceItem[] }>("/billing/prices?includeInactive=true");
          const items = Array.isArray(result.data) ? result.data : result.data.items;
          return items.map((p) => ({ id: p.id, version: p.version, active: p.active, code: p.reference, name: p.name, category: PRICE_LABEL[p.category] ?? p.category, price: naira(p.unitPriceMinor), billable: true }));
        },
        add: async (f) => {
          await emrRequest("/billing/prices", { method: "POST", body: { category: PRICE_CATEGORY[str(f.category)] ?? "OTHER", reference: str(f.code).toUpperCase(), name: str(f.name), unitPriceMinor: minor(f.price) } });
        },
        update: async (row, f) => { await emrRequest(`/billing/prices/${row.id}`, { method: "PATCH", version: row.version as number, body: { name: str(f.name), unitPriceMinor: minor(f.price) } }); },
        toggle: async (row) => { await emrRequest(`/billing/prices/${row.id}`, { method: "PATCH", version: row.version as number, body: { active: !row.active } }); },
      };

    case "users": {
      const base = `/api/v1/auth/organizations/${encodeURIComponent(organizationId)}`;
      return {
        load: async () => (await liveApiRequest<{ data: { items: Membership[] } }>(`${base}/memberships`)).data.items.map((m) => ({
          id: m.id, active: m.status === "ACTIVE", status: m.status === "ACTIVE" ? "Active" : m.status === "REVOKED" ? "Inactive" : title(m.status),
          name: m.user.full_name ?? m.user.email, username: m.user.email, role: m.roles.map((r) => title(r.roleCode)).join(", ") || "—",
        })),
        // Staff join by invitation: Sabi ID emails them a link to set up their account with this role.
        addFields: [{ key: "email", label: "Email address", type: "text" }, { key: "role", label: "Role", type: "select", options: [] }],
        add: async (f) => { await liveCreateInvitation(str(f.email), str(f.role), organizationId); },
        update: fixed("A member's role is changed by inviting them with the new role and revoking the old membership (Sabi ID → Members)."),
        toggle: async (row) => {
          if (!row.active) throw new Error("A revoked member rejoins by invitation — use Add User with their email.");
          await liveApiRequest(`${base}/memberships/${row.id}/revoke`, { method: "POST", body: "{}" });
        },
      };
    }
    default:
      return { load: async () => [], add: fixed("Not available."), update: fixed("Not available."), toggle: fixed("Not available.") };
  }
}

// Rows per loader (one per tab and hospital): the screen shows a tab's rows once its loader has fetched them.
const useSettingsRows = create<{ loader: Loader | null; rows: LiveRow[]; error: string; roles: string[]; load: (loader: Loader) => Promise<void>; loadRoles: (organizationId: string) => Promise<void> }>((set) => ({
  loader: null, rows: [], error: "", roles: [],
  load: async (loader) => {
    try { set({ loader, rows: await loader.load(), error: "" }); }
    catch (cause) { set({ loader, rows: [], error: cause instanceof Error ? cause.message : "This catalog could not be loaded." }); }
  },
  loadRoles: async (organizationId) => {
    try { set({ roles: (await liveInvitationRoles(organizationId)).data.roles }); }
    catch { set({ roles: [] }); }
  },
}));

/** The live catalog for one Settings tab (rows plus actions), reloading after every change. */
export function useLiveSettingsCatalog(enabled: boolean, key: string): LiveCatalog {
  const organizationId = useLiveEmr((s) => s.access?.organizationId ?? "");
  const loader = useMemo(() => (enabled && organizationId ? loaderFor(key, organizationId) : null), [enabled, key, organizationId]);
  const state = useSettingsRows();
  const mine = state.loader === loader && loader !== null;

  useEffect(() => {
    if (!loader) return;
    void useSettingsRows.getState().load(loader);
    if (key === "users") void useSettingsRows.getState().loadRoles(organizationId);
  }, [loader, key, organizationId]);

  const after = (work: (l: Loader) => Promise<void>) => async () => {
    if (!loader) return;
    await work(loader);
    await useSettingsRows.getState().load(loader);
  };
  const addFields = loader?.addFields?.map((f) => (key === "users" && f.key === "role" ? { ...f, options: state.roles, default: state.roles[0] ?? "" } : f));
  return {
    rows: mine ? state.rows : [], loading: Boolean(loader) && !mine, error: mine ? state.error : "", readOnly: loader?.readOnly, addFields, editFields: loader?.editFields,
    add: (form) => after((l) => l.add(form))(),
    update: (row, form) => after((l) => l.update(row, form))(),
    toggle: (row) => after((l) => l.toggle(row))(),
  };
}
