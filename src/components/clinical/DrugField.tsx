import { useState } from "react";
import { useCatalog } from "@/store/useCatalog";
import { cn } from "@/lib/cn";
import { useIsLiveEmr } from "@/emr-live/session";
import { referenceLabel, resolveReference, useLiveDrugSearch, type ReferenceProduct } from "@/emr-live/drugSearch";

/**
 * Drug autocomplete showing on-hand stock: the demo catalog, or — for a live hospital — its formulary
 * and the EMDEX national drug index. Picking a live product also reports its code and dose unit (an
 * EMDEX product is first resolved to the hospital's formulary code); typing clears them.
 */
export function DrugField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string, product?: { code: string; doseUnit: string }) => void;
  className?: string;
}) {
  const drugs = useCatalog((s) => s.drugs).filter((d) => d.active !== false);
  const live = useIsLiveEmr();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const search = useLiveDrugSearch(open ? q : value, live && open);

  const matches = live
    ? search.formulary.map((p) => ({ id: p.code, name: p.genericName, strength: p.strength, stock: p.inStock, reorder: 0, product: { code: p.code, doseUnit: p.doseUnit } }))
    : drugs
      .filter((d) => `${d.name} ${d.strength}`.toLowerCase().includes((open ? q : value).toLowerCase()))
      .slice(0, 6)
      .map((d) => ({ ...d, product: undefined }));
  const reference = live ? search.reference : [];

  const pickReference = async (p: ReferenceProduct) => {
    setOpen(false);
    setError("");
    setResolving(true);
    try {
      const resolved = await resolveReference(p);
      onChange(referenceLabel(p), { code: resolved.code, doseUnit: resolved.doseUnit });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That EMDEX product could not be added.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        className="input"
        placeholder="Drug"
        value={open ? q : value}
        disabled={resolving}
        onFocus={() => { setOpen(true); setQ(value); }}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); setError(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {resolving && <p className="mt-1 text-[11px] text-mist-500">Adding to the formulary from EMDEX…</p>}
      {error && <p className="mt-1 text-[11px] text-action-600">{error}</p>}
      {open && (matches.length > 0 || reference.length > 0 || (live && search.referenceStatus !== "ok")) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl bg-white p-1 shadow-pop ring-1 ring-mist-200">
          {matches.map((d) => (
            <button
              key={d.id}
              onMouseDown={() => { onChange(`${d.name} ${d.strength}`.trim(), d.product); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="font-medium text-mist-800">{d.name} <span className="text-mist-400">{d.strength}</span></span>
              <span className={cn("text-[11px] font-semibold", d.stock === 0 ? "text-action-600" : d.stock <= d.reorder ? "text-amber-600" : "text-brand-600")}>
                {d.stock === 0 ? "out of stock" : `${d.stock} in stock`}
              </span>
            </button>
          ))}
          {reference.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-mist-400">From EMDEX — not in the formulary yet</p>}
          {reference.map((p) => (
            <button
              key={`${p.kind}-${p.referenceId}`}
              onMouseDown={() => { void pickReference(p); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="font-medium text-mist-800">
                {p.brandName ?? p.genericName} <span className="text-mist-400">{[p.strength, p.form].filter(Boolean).join(" · ")}</span>
                {p.brandName && <span className="block text-[11px] text-mist-400">{p.genericName}{p.manufacturer ? ` · ${p.manufacturer}` : ""}</span>}
              </span>
              <span className="text-[11px] font-semibold text-mist-500">not stocked</span>
            </button>
          ))}
          {live && search.referenceStatus === "not_configured" && <p className="px-3 py-1.5 text-[11px] text-mist-400">EMDEX search isn't set up for this hospital yet — showing the formulary only.</p>}
          {live && search.referenceStatus === "unavailable" && <p className="px-3 py-1.5 text-[11px] text-mist-400">EMDEX is not reachable right now — showing the formulary only.</p>}
        </div>
      )}
    </div>
  );
}
