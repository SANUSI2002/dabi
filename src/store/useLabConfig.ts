import { create } from "zustand";
import { LAB_TEST_CONFIGS, defaultConfigFor, type LabTestConfig, type ResultField } from "@/data/labConfig";
import { LAB_TESTS } from "@/data/catalog";
import { audit } from "@/store/useAudit";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type LabConfigState = {
  configs: LabTestConfig[];
  configFor: (testName: string) => LabTestConfig;
  setTurnaround: (testName: string, minutes: number) => void;
  setPhases: (testName: string, phases: string[]) => void;
  setTemplate: (testName: string, fields: ResultField[]) => void;
};

export const useLabConfig = create<LabConfigState>(persisted<LabConfigState>("lab-config", (set, get) => ({
  configs: LAB_TEST_CONFIGS,

  configFor: (testName) => {
    const existing = get().configs.find((c) => c.testName === testName);
    if (existing) return existing;
    const catalogEntry = LAB_TESTS.find((t) => t.name === testName);
    return defaultConfigFor(testName, catalogEntry?.tat ?? 30);
  },

  setTurnaround: (testName, minutes) => {
    audit("updated lab test turnaround", `lab/config/${testName}`);
    set((s) => {
      const has = s.configs.some((c) => c.testName === testName);
      const base = has ? s.configs : [...s.configs, get().configFor(testName)];
      return { configs: base.map((c) => (c.testName === testName ? { ...c, turnaroundMinutes: minutes } : c)) };
    });
  },

  setPhases: (testName, phases) => {
    audit("updated lab test phases", `lab/config/${testName}`);
    set((s) => {
      const has = s.configs.some((c) => c.testName === testName);
      const base = has ? s.configs : [...s.configs, get().configFor(testName)];
      return { configs: base.map((c) => (c.testName === testName ? { ...c, phases } : c)) };
    });
  },

  setTemplate: (testName, fields) => {
    audit("updated lab result template", `lab/config/${testName}`);
    set((s) => {
      const has = s.configs.some((c) => c.testName === testName);
      const base = has ? s.configs : [...s.configs, get().configFor(testName)];
      return { configs: base.map((c) => (c.testName === testName ? { ...c, resultTemplate: fields } : c)) };
    });
  },
})));

export const newResultField = (): ResultField => ({ id: rid(), label: "", type: "text" });
