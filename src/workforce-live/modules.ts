import { create } from "zustand";
import { useEntitlements } from "@/platform/useEntitlements";
import type { ProductKey } from "@/platform/entitlements";
import { orgConfigRequest } from "@/emr-live/client";
import { liveChange } from "./sync";

// Module switches in live mode (GET /org-config/modules): the organization's approved package decides its
// products — nothing here can license one. Within them, a hospital admin (platform.config) switches modules
// and submodules off and on for everyone; the server refuses a switched-off module's requests and keeps
// its records. Every member reads the switches, so a switched-off screen says so instead of failing.

type ApiModule = { key: string; product: ProductKey; enabled: boolean; submodules: { key: string; enabled: boolean }[] };
type ApiModules = {
  package: { name: string; version: number } | null;
  products: Record<"emr" | "workforce" | "accounting", boolean>;
  modules: ApiModule[]; disabled: string[]; version: number; editable: boolean;
};

export const useLiveModulesMeta = create<{ loaded: boolean; version: number; editable: boolean; packageName: string | null; disabled: string[] }>(
  () => ({ loaded: false, version: 0, editable: false, packageName: null, disabled: [] }),
);

export async function loadModules() {
  const { data } = await orgConfigRequest<{ data: ApiModules }>("/modules");
  useLiveModulesMeta.setState({ loaded: true, version: data.version, editable: data.editable, packageName: data.package ? `${data.package.name} (v${data.package.version})` : null, disabled: data.disabled });
  useEntitlements.setState((s) => ({
    org: { ...s.org, plan: data.package?.name ?? "No approved package" },
    products: { ...data.products, pharmacy: false },
    modules: Object.fromEntries(data.modules.map((m) => [m.key, m.enabled])),
    submodules: Object.fromEntries(data.modules.flatMap((m) => m.submodules.map((x) => [x.key, x.enabled]))),
  }));
}

const reload = () => loadModules();
const save = (disabled: string[]) => {
  const { version } = useLiveModulesMeta.getState();
  void liveChange(() => orgConfigRequest("/modules", { method: "PUT", version, body: { disabled } }), reload, () => useLiveModulesMeta.setState({ disabled }));
};
const toggled = (key: string, on: boolean) => {
  const off = new Set(useLiveModulesMeta.getState().disabled);
  if (on) off.delete(key);
  else off.add(key);
  return [...off];
};

export function goLiveModules() {
  useEntitlements.setState({
    // Products come from the approved package, never from a switch here.
    setProduct: () => {},
    applyPreset: () => {},
    setModule: (key, on) => {
      useEntitlements.setState((s) => ({ modules: { ...s.modules, [key]: on } }));
      save(toggled(key, on));
    },
    setSubmodule: (key, on) => {
      useEntitlements.setState((s) => ({ submodules: { ...s.submodules, [key]: on } }));
      save(toggled(key, on));
    },
  });
}

export function clearModules() {
  // Until the organization's own switches arrive, screens are not judged by them.
  useLiveModulesMeta.setState({ loaded: false, version: 0, editable: false, packageName: null, disabled: [] });
}
