import { create } from "zustand";
import { useMasterData, type MasterItem } from "@/platform/useMasterData";
import { useTerminology, type TermKey } from "@/platform/useTerminology";
import { renderTemplate, useLetters } from "@/platform/useLetters";
import { useIdentity } from "@/store/useIdentity";
import { orgConfigRequest } from "@/emr-live/client";
import type { GeneratedLetter, LetterTemplate } from "@/platform/letters";
import { liveChange, uuid } from "./sync";

// Organization configuration in live mode (GET /org-config): master-data lists, terminology and letter
// templates are the organization's own, shared by every product. The server decides who may change each
// list; letters are rendered and logged by the server ("sent" records delivery — nothing is mailed).
// Fields that save as you type (labels, codes, terms) are sent once typing pauses.

type Versioned = { version?: number };
type ApiConfig = {
  data: Record<string, (MasterItem & Versioned)[]>; terms: { overrides: ReturnType<typeof useTerminology.getState>["overrides"]; version: number };
  templates: (LetterTemplate & Versioned)[]; letters: GeneratedLetter[];
};

export const useLiveOrgConfigMeta = create<{ loaded: boolean; termsVersion: number }>(() => ({ loaded: false, termsVersion: 0 }));

export async function loadOrgConfig() {
  const { data } = await orgConfigRequest<{ data: ApiConfig }>("");
  useLiveOrgConfigMeta.setState({ loaded: true, termsVersion: data.terms.version });
  useMasterData.setState({ data: data.data });
  useTerminology.setState({ overrides: data.terms.overrides });
  useLetters.setState({ templates: data.templates, generated: data.letters });
}

const reload = () => loadOrgConfig();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const later = (key: string, run: () => void) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(() => { timers.delete(key); run(); }, 600)); };
const md = () => useMasterData.getState();
const versionOf = (category: string, id: string) => (md().itemById(category, id) as (MasterItem & Versioned) | undefined)?.version ?? 1;
const patchItem = (category: string, id: string, patch: Partial<MasterItem>) =>
  useMasterData.setState((s) => ({ data: { ...s.data, [category]: (s.data[category] ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)) } }));

export function goLiveOrgConfig() {
  // Typed changes to one item are gathered and sent together.
  const pending = new Map<string, Partial<MasterItem>>();
  useMasterData.setState({
    addItem: (category, input) => {
      const id = uuid();
      void liveChange(() => orgConfigRequest(`/master-data/${category}`, { method: "POST", body: { id, label: input.label, ...(input.code ? { code: input.code } : {}), ...(input.meta ? { meta: input.meta } : {}) } }), reload,
        () => useMasterData.setState((s) => ({ data: { ...s.data, [category]: [...(s.data[category] ?? []), { id, label: input.label, code: input.code, active: true, meta: input.meta }] } })));
      return id;
    },
    updateItem: (category, id, patch) => {
      patchItem(category, id, patch);
      const key = `${category}/${id}`;
      pending.set(key, { ...pending.get(key), ...patch });
      later(key, () => {
        const change = pending.get(key) ?? {};
        pending.delete(key);
        if (change.label !== undefined && !change.label.trim()) return void reload(); // an emptied name is not saved
        void liveChange(() => orgConfigRequest(`/master-data/${category}/${id}`, { method: "PATCH", version: versionOf(category, id), body: { ...change, ...(change.code !== undefined ? { code: change.code ?? "" } : {}) } }), reload);
      });
    },
    toggleActive: (category, id) => {
      const active = !md().itemById(category, id)?.active;
      void liveChange(() => orgConfigRequest(`/master-data/${category}/${id}`, { method: "PATCH", version: versionOf(category, id), body: { active } }), reload, () => patchItem(category, id, { active }));
    },
    removeItem: (category, id) => { void liveChange(() => orgConfigRequest(`/master-data/${category}/${id}/remove`, { method: "POST", body: {} }), reload); },
  });

  // The terms as typed when the pause comes — not whatever an earlier change's reload left in the store.
  const saveTerms = () => later("terms", () => {
    const overrides = useTerminology.getState().overrides;
    void liveChange(() => orgConfigRequest("/terminology", { method: "PUT", version: useLiveOrgConfigMeta.getState().termsVersion, body: { overrides } }), reload);
  });
  useTerminology.setState({
    setTerm: (key: TermKey, patch) => {
      useTerminology.setState((s) => ({ overrides: { ...s.overrides, [key]: { ...s.overrides[key], ...patch } } }));
      saveTerms();
    },
    reset: (key?: TermKey) => {
      useTerminology.setState((s) => { if (!key) return { overrides: {} }; const n = { ...s.overrides }; delete n[key]; return { overrides: n }; });
      saveTerms();
    },
  });

  useLetters.setState({
    saveTemplate: (key, patch) => {
      const version = (useLetters.getState().templateByKey(key) as (LetterTemplate & Versioned) | undefined)?.version ?? 1;
      void liveChange(() => orgConfigRequest(`/letter-templates/${key}`, { method: "PATCH", version, body: patch }), reload,
        () => useLetters.setState((s) => ({ templates: s.templates.map((t) => (t.key === key ? { ...t, ...patch } : t)) })));
    },
    addTemplate: (t) => {
      void liveChange(() => orgConfigRequest("/letter-templates", { method: "POST", body: { key: t.key, name: t.name, category: t.category, body: t.body, signatories: t.signatories } }), reload);
    },
    generate: (input) => {
      const t = useLetters.getState().templateByKey(input.templateKey);
      if (!t) return undefined;
      const id = uuid();
      const data = Object.fromEntries(Object.entries(input.data).map(([k, v]) => [k, v === undefined ? "" : String(v)]));
      // Shown at once (the same rendering the server stores), then replaced by the server's copy.
      const letter: GeneratedLetter = { id, templateKey: input.templateKey, title: input.title ?? t.name, subjectStaffId: input.subjectStaffId, reference: input.reference, data, rendered: renderTemplate(t.body, data), generatedBy: useIdentity.getState().user.id, generatedAt: new Date().toISOString() };
      void liveChange(() => orgConfigRequest("/letters", { method: "POST", body: { id, templateKey: input.templateKey, title: letter.title, data, ...(input.subjectStaffId ? { subjectStaffId: input.subjectStaffId } : {}), ...(input.reference ? { reference: input.reference } : {}) } }), reload,
        () => useLetters.setState((s) => ({ generated: [letter, ...s.generated] })));
      return id;
    },
    markSent: (id, to) => { void liveChange(() => orgConfigRequest(`/letters/${id}/sent`, { method: "POST", body: { to } }), reload); },
  });
}

export function clearOrgConfig() {
  useLiveOrgConfigMeta.setState({ loaded: false, termsVersion: 0 });
}
