import { useRef, useState } from "react";
import { useCatalog } from "@/store/useCatalog";
import { cn } from "@/lib/cn";
import { useIsLiveEmr } from "@/emr-live/session";
import { referenceLabel, resolveReference, useLiveDrugSearch, type DrugSource, type ReferenceProduct } from "@/emr-live/drugSearch";
import { inDrugCategory, useDrugCategories } from "@/lib/drugCategories";

/**
 * Drug autocomplete for prescribing. The prescriber searches the pharmacy (what the hospital stocks, with
 * stock on hand) or EMDEX (the national drug index), by name and/or drug category — the categories are the
 * pharmacy's own list. A live hospital searches its formulary and EMDEX on the server; picking a live
 * product also reports its code and dose unit (an EMDEX product is first resolved to the hospital's
 * formulary code); typing clears them. The demo searches its sample catalogue (EMDEX needs a live hospital).
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
  const categories = useDrugCategories();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<DrugSource>("formulary");
  const [category, setCategory] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const search = useLiveDrugSearch(open ? q : value, live && open, { source, category });
  const text = (open ? q : value).toLowerCase();

  const matches = live
    ? search.formulary.map((p) => ({ id: p.code, name: p.genericName, strength: p.strength, stock: p.inStock, reorder: 0, product: { code: p.code, doseUnit: p.doseUnit } }))
    : source === "emdex"
      ? []
      : drugs
        .filter((d) => inDrugCategory(d.klass, category) && `${d.name} ${d.strength}`.toLowerCase().includes(text))
        .slice(0, category ? 12 : 6)
        .map((d) => ({ ...d, product: undefined }));
  const reference = live ? search.reference : [];
  const categoryName = categories.find((c) => c.value === category)?.label;

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
  // choosing where to search, or a category, opens the list straight away
  const refocus = () => { setQ(value); setOpen(true); input.current?.focus(); };

  return (
    <div className={cn("relative", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Search drugs in">
        {(["formulary", "emdex"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={source === s}
            disabled={s === "emdex" && !live}
            title={s === "emdex" && !live ? "EMDEX search needs a live hospital" : undefined}
            onClick={() => { setSource(s); refocus(); }}
            className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50",
              source === s ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-mist-600 ring-mist-200 hover:bg-mist-50")}
          >
            {s === "formulary" ? "Pharmacy" : "EMDEX"}
          </button>
        ))}
        <select
          aria-label="Drug category"
          value={category}
          onChange={(e) => { setCategory(e.target.value); refocus(); }}
          className="h-6 rounded-md border-0 bg-white py-0 pl-2 pr-7 text-[11px] text-mist-700 ring-1 ring-mist-200 focus:ring-brand-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <input
        ref={input}
        className="input"
        placeholder={source === "emdex" ? "Search EMDEX by drug or brand name" : categoryName ? `Drug — ${categoryName}` : "Drug"}
        value={open ? q : value}
        disabled={resolving}
        onFocus={() => { setOpen(true); setQ(value); }}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); setError(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {resolving && <p className="mt-1 text-[11px] text-mist-500">Adding to the formulary from EMDEX…</p>}
      {error && <p className="mt-1 text-[11px] text-action-600">{error}</p>}
      {open && (matches.length > 0 || reference.length > 0 || (live && search.referenceStatus !== "ok") || (category && matches.length === 0 && source === "formulary")) && (
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
          {category && source === "formulary" && matches.length === 0 && <p className="px-3 py-1.5 text-[11px] text-mist-400">The pharmacy has no {categoryName ?? "drugs in this category"}{q ? ` matching “${q}”` : ""}.</p>}
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
                {p.categoryChecked === false && <span className="block text-[11px] text-amber-600">EMDEX gives no class to confirm the category</span>}
              </span>
              <span className="text-[11px] font-semibold text-mist-500">not stocked</span>
            </button>
          ))}
          {live && search.referenceStatus === "needs_name" && <p className="px-3 py-1.5 text-[11px] text-mist-400">Type a drug or brand name to search EMDEX{categoryName ? ` within ${categoryName}` : ""}.</p>}
          {live && search.referenceStatus === "not_configured" && <p className="px-3 py-1.5 text-[11px] text-mist-400">EMDEX search isn't set up for this hospital yet{source === "emdex" ? " — choose Pharmacy to search the formulary" : " — showing the formulary only"}.</p>}
          {live && search.referenceStatus === "unavailable" && <p className="px-3 py-1.5 text-[11px] text-mist-400">EMDEX is not reachable right now{source === "emdex" ? " — choose Pharmacy to search the formulary" : " — showing the formulary only"}.</p>}
        </div>
      )}
    </div>
  );
}
