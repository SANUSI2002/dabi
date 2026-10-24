import { create } from "zustand";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { useTax } from "@/store/accounting/useTax";
import { accountingRequest } from "@/emr-live/client";
import type { TaxRate } from "@/data/accounting/tax";
import { adoptLiveIdentity, liveChange } from "@/workforce-live/sync";

// Accounting settings and tax rates in live mode (GET /settings): the organization's company profile,
// numbering, payment terms, reminder ladder, tax registration and tax rates. Edits apply at once and are
// saved together once typing pauses; document numbers themselves are allocated by the server.

type S = ReturnType<typeof useAccountingSettings.getState>;
type ApiSettings = {
  org: S["org"]; sequences: Omit<S["sequences"][number], "example">[]; paymentTerms: S["paymentTerms"]; reminderRules: S["reminderRules"]; taxRegistration: S["taxRegistration"];
  setup: S["setup"]; version: number; taxRates: (TaxRate & { version: number })[];
};

export const useLiveAcctSettingsMeta = create<{ loaded: boolean; version: number }>(() => ({ loaded: false, version: 1 }));
const example = (s: { prefix: string; padding: number; next: number }) => `${s.prefix}${new Date().getUTCFullYear()}-${String(s.next).padStart(s.padding, "0")}`;

export async function loadAcctSettings() {
  const { data } = await accountingRequest<{ data: ApiSettings }>("/settings");
  useLiveAcctSettingsMeta.setState({ loaded: true, version: data.version });
  useAccountingSettings.setState({ org: data.org, sequences: data.sequences.map((s) => ({ ...s, example: example(s) })), paymentTerms: data.paymentTerms, reminderRules: data.reminderRules, taxRegistration: data.taxRegistration, setup: data.setup });
  useTax.setState({ rates: data.taxRates });
  adoptLiveIdentity(null);
}

const reload = () => loadAcctSettings();
// The parts of the settings changed since the last save; sent together after a pause.
const pending = new Set<"org" | "sequences" | "paymentTerms" | "reminderRules" | "taxRegistration" | "setupSteps">();
let timer: ReturnType<typeof setTimeout> | undefined;
function save(part: typeof pending extends Set<infer P> ? P : never) {
  // before the hospital's settings arrive, the screens hold nothing of its own to save
  if (!useLiveAcctSettingsMeta.getState().loaded) return;
  pending.add(part);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const s = useAccountingSettings.getState();
    const body = Object.fromEntries([...pending].map((p) => [p, p === "sequences" ? s.sequences.map(({ example: _e, ...rest }) => rest) : p === "setupSteps" ? s.setup.steps : s[p]]));
    pending.clear();
    void liveChange(() => accountingRequest("/settings", { method: "PATCH", body, version: useLiveAcctSettingsMeta.getState().version }), reload);
  }, 600);
}
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// A live hospital starts from a blank company profile and tax registration, never the preview's sample
// company: nothing shows, and nothing can be saved, before the hospital's own settings have loaded.
const BLANK_ORG: S["org"] = { legalName: "", tradingName: "", tin: "", rcNumber: "", address: "", email: "", phone: "", paymentInstructions: "", reportingCurrency: "NGN", fiscalYearStartMonth: 1 };
const BLANK_TAX_REGISTRATION: S["taxRegistration"] = { vatTin: "", wht: false, payeStateId: "", vatRegistered: false };

export function goLiveAcctSettings() {
  const set = useAccountingSettings.setState;
  if (!useLiveAcctSettingsMeta.getState().loaded) set({ org: BLANK_ORG, taxRegistration: BLANK_TAX_REGISTRATION });
  useAccountingSettings.setState({
    updateOrg: (patch) => { set((s) => ({ org: { ...s.org, ...patch } })); save("org"); },
    updateSequence: (key, patch) => { set((s) => ({ sequences: s.sequences.map((x) => (x.key === key ? { ...x, ...patch, example: example({ ...x, ...patch }) } : x)) })); save("sequences"); },
    addPaymentTerm: (t) => { set((s) => ({ paymentTerms: [...s.paymentTerms, { ...t, id: uid("pt"), active: true }] })); save("paymentTerms"); },
    updatePaymentTerm: (id, patch) => { set((s) => ({ paymentTerms: s.paymentTerms.map((t) => (t.id === id ? { ...t, ...patch } : t)) })); save("paymentTerms"); },
    addReminderRule: (r) => { set((s) => ({ reminderRules: [...s.reminderRules, { ...r, id: uid("rr"), active: true }].sort((a, b) => a.level - b.level) })); save("reminderRules"); },
    updateReminderRule: (id, patch) => { set((s) => ({ reminderRules: s.reminderRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })); save("reminderRules"); },
    removeReminderRule: (id) => { set((s) => ({ reminderRules: s.reminderRules.filter((r) => r.id !== id) })); save("reminderRules"); },
    updateTaxRegistration: (patch) => { set((s) => ({ taxRegistration: { ...s.taxRegistration, ...patch } })); save("taxRegistration"); },
    markSetupStep: (step, done) => { set((s) => ({ setup: { steps: { ...s.setup.steps, [step]: done } } })); save("setupSteps"); },
  });
  useTax.setState({
    addRate: (r) => {
      void liveChange(() => accountingRequest("/settings/tax-rates", { method: "POST", body: Object.fromEntries(Object.entries({ name: r.name, kind: r.kind, rate: r.rate, description: r.description || undefined, accountNumber: r.accountNumber, isCompound: r.isCompound }).filter(([, v]) => v !== undefined)) }), reload);
    },
    updateRate: (id, patch) => {
      const version = (useTax.getState().rates.find((x) => x.id === id) as (TaxRate & { version?: number }) | undefined)?.version ?? 1;
      const body = Object.fromEntries(Object.entries({ name: patch.name, rate: patch.rate, description: patch.description, isActive: patch.isActive }).filter(([, v]) => v !== undefined));
      void liveChange(() => accountingRequest(`/settings/tax-rates/${id}`, { method: "PATCH", body, version }), reload, () => useTax.setState((s) => ({ rates: s.rates.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
    },
  });
}

export function clearAcctSettings() {
  useLiveAcctSettingsMeta.setState({ loaded: false, version: 1 });
}
