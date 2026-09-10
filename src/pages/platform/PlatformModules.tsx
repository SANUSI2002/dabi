import { useState } from "react";
import { Boxes, Check, X, Sparkles } from "lucide-react";
import { PageHeader, Button, Badge, Card, StatCard } from "@/components/ui/primitives";
import { useEntitlements } from "@/platform/useEntitlements";
import { PRODUCTS, MODULES, modulesByProduct, type ProductKey } from "@/platform/entitlements";
import { cn } from "@/lib/cn";

const PRESETS: { key: Parameters<ReturnType<typeof useEntitlements.getState>["applyPreset"]>[0]; label: string }[] = [
  { key: "all", label: "All modules" },
  { key: "emr-only", label: "EMR only" },
  { key: "workforce-only", label: "Workforce only" },
  { key: "accounting-only", label: "Accounting only" },
  { key: "emr-workforce", label: "EMR + Workforce" },
  { key: "clinic-lite", label: "Clinic Lite (core EMR)" },
];

export default function PlatformModules() {
  const { org, products, setProduct, isModuleEnabled, setModule, isSubmoduleEnabled, setSubmodule, applyPreset } = useEntitlements();
  const [confirmPreset, setConfirmPreset] = useState<string | null>(null);

  const enabledCount = MODULES.filter((m) => isModuleEnabled(m.key)).length;

  return (
    <div>
      <PageHeader title="Platform & Modules" subtitle={`What ${org.name} has licensed. Disabling a module makes its screens and routes unreachable — not just hidden.`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Products licensed" value={Object.values(products).filter(Boolean).length + " / 3"} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="Modules enabled" value={`${enabledCount} / ${MODULES.length}`} tone="brand" delay={0.05} />
        <StatCard label="Plan" value={org.plan} tone="mist" delay={0.1} />
        <StatCard label="Tenant" value={org.slug} tone="mist" delay={0.15} />
      </div>

      <Card className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-700"><Sparkles size={15} /> Quick presets</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.key} variant="soft" onClick={() => setConfirmPreset(p.key)}>{p.label}</Button>
          ))}
        </div>
        {confirmPreset && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <span>Apply “{PRESETS.find((p) => p.key === confirmPreset)?.label}”? This re-licenses products and re-enables every module.</span>
            <div className="flex gap-2">
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirmPreset(null)}>Cancel</button>
              <button className="btn-primary px-2 py-1 text-xs" onClick={() => { applyPreset(confirmPreset as never); setConfirmPreset(null); }}>Apply</button>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-5">
        {(Object.keys(PRODUCTS) as ProductKey[]).map((pk) => {
          const licensed = products[pk];
          return (
            <Card key={pk} className={cn("p-0", !licensed && "opacity-70")}>
              <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
                <div>
                  <p className="font-display text-base font-bold text-mist-900">{PRODUCTS[pk].label}</p>
                  <p className="text-xs text-mist-400">{PRODUCTS[pk].tagline}</p>
                </div>
                <button
                  onClick={() => setProduct(pk, !licensed)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", licensed ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-mist-100 text-mist-500 ring-1 ring-mist-200")}
                >
                  {licensed ? <><Check size={14} /> Licensed</> : <><X size={14} /> Not licensed</>}
                </button>
              </div>
              <div className="divide-y divide-mist-100">
                {modulesByProduct(pk).map((m) => {
                  const on = isModuleEnabled(m.key);
                  return (
                    <div key={m.key} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-mist-800">{m.label} {m.core && <Badge tone="mist">core</Badge>}</p>
                          <p className="truncate text-xs text-mist-400">{m.description}</p>
                        </div>
                        <label className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition", on ? "bg-brand-500" : "bg-mist-300", (m.core || !licensed) && "cursor-not-allowed opacity-50")}>
                          <input type="checkbox" className="peer sr-only" checked={on} disabled={m.core || !licensed} onChange={(e) => setModule(m.key, e.target.checked)} />
                          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition", on ? "translate-x-4" : "translate-x-0.5")} />
                        </label>
                      </div>
                      {m.submodules && on && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                          {m.submodules.map((s) => {
                            const son = isSubmoduleEnabled(s.key);
                            return (
                              <button key={s.key} onClick={() => setSubmodule(s.key, !son)} className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1", son ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-mist-100 text-mist-400 ring-mist-200 line-through")}>
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-mist-400">
        Entitlements persist locally and are checked on every route by <code>EntitlementBoundary</code> plus the sidebar.
        In a deployed build this same check moves behind the API — the seam is <code>src/platform/</code>.
      </p>
    </div>
  );
}
