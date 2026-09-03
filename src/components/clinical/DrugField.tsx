import { useState } from "react";
import { useCatalog } from "@/store/useCatalog";
import { cn } from "@/lib/cn";

/** Drug autocomplete backed by the live catalog, showing on-hand stock. */
export function DrugField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  const drugs = useCatalog((s) => s.drugs).filter((d) => d.active !== false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const matches = drugs
    .filter((d) => `${d.name} ${d.strength}`.toLowerCase().includes((open ? q : value).toLowerCase()))
    .slice(0, 6);

  return (
    <div className={cn("relative", className)}>
      <input
        className="input"
        placeholder="Drug"
        value={open ? q : value}
        onFocus={() => { setOpen(true); setQ(value); }}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl bg-white p-1 shadow-pop ring-1 ring-mist-200">
          {matches.map((d) => (
            <button
              key={d.id}
              onMouseDown={() => { onChange(`${d.name} ${d.strength}`.trim()); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="font-medium text-mist-800">{d.name} <span className="text-mist-400">{d.strength}</span></span>
              <span className={cn("text-[11px] font-semibold", d.stock === 0 ? "text-action-600" : d.stock <= d.reorder ? "text-amber-600" : "text-brand-600")}>
                {d.stock === 0 ? "out of stock" : `${d.stock} in stock`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
