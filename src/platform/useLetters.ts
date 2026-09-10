import { create } from "zustand";
import { persisted } from "./persist";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { LETTER_TEMPLATES, type LetterTemplate, type GeneratedLetter } from "./letters";

const rid = () => Math.random().toString(36).slice(2, 9);

/** replace {{tokens}} from `data`; unknown tokens become "________" */
export function renderTemplate(body: string, data: Record<string, string | number | undefined>): string {
  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    const v = data[k];
    return v === undefined || v === "" ? "________" : String(v);
  });
}

/** list the {{tokens}} a template uses */
export function templateTokens(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]))];
}

type LettersState = {
  templates: LetterTemplate[];
  generated: GeneratedLetter[];

  templateByKey: (key: string) => LetterTemplate | undefined;
  saveTemplate: (key: string, patch: Partial<Pick<LetterTemplate, "name" | "body" | "signatories" | "active" | "category">>) => void;
  addTemplate: (t: Omit<LetterTemplate, "system">) => void;

  /** render without logging (previews) */
  preview: (templateKey: string, data: Record<string, string | number | undefined>) => { title: string; body: string; signatories: string[] } | undefined;
  /** render + log a generated letter */
  generate: (input: { templateKey: string; title?: string; data: Record<string, string | number | undefined>; subjectStaffId?: string; reference?: string }) => string | undefined;
  markSent: (id: string, to: string) => void;
  lettersFor: (reference: string) => GeneratedLetter[];
  letterById: (id: string) => GeneratedLetter | undefined;
};

export const useLetters = create<LettersState>(
  persisted<LettersState>(
    "letters",
    (set, get) => ({
      templates: LETTER_TEMPLATES,
      generated: [],

      templateByKey: (key) => get().templates.find((t) => t.key === key),
      saveTemplate: (key, patch) => {
        set((s) => ({ templates: s.templates.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
        audit(`edited letter template "${get().templateByKey(key)?.name ?? key}"`, `platform/letters/${key}`);
      },
      addTemplate: (t) => {
        set((s) => ({ templates: [...s.templates, { ...t, active: true }] }));
        audit(`created letter template "${t.name}"`, `platform/letters/${t.key}`);
      },

      preview: (templateKey, data) => {
        const t = get().templateByKey(templateKey);
        if (!t) return undefined;
        return { title: renderTemplate(t.name, data as never), body: renderTemplate(t.body, data), signatories: t.signatories.map((sig) => renderTemplate(sig, data)) };
      },

      generate: (input) => {
        const t = get().templateByKey(input.templateKey);
        if (!t) return undefined;
        const data = Object.fromEntries(Object.entries(input.data).map(([k, v]) => [k, v === undefined ? "" : String(v)]));
        const id = `ltr-${rid()}`;
        const letter: GeneratedLetter = {
          id,
          templateKey: input.templateKey,
          title: input.title ?? t.name,
          subjectStaffId: input.subjectStaffId,
          reference: input.reference,
          data,
          rendered: renderTemplate(t.body, data),
          generatedBy: useIdentity.getState().user.id,
          generatedAt: new Date().toISOString(),
        };
        set((s) => ({ generated: [letter, ...s.generated] }));
        audit(`generated "${letter.title}"`, `platform/letters/generated/${id}`);
        return id;
      },

      markSent: (id, to) => {
        set((s) => ({ generated: s.generated.map((l) => (l.id === id ? { ...l, sentAt: new Date().toISOString(), sentTo: to } : l)) }));
        audit(`sent letter to ${to}`, `platform/letters/generated/${id}`);
      },
      lettersFor: (reference) => get().generated.filter((l) => l.reference === reference),
      letterById: (id) => get().generated.find((l) => l.id === id),
    }),
    { pick: (s) => ({ templates: s.templates, generated: s.generated.slice(0, 200) }) },
  ),
);
