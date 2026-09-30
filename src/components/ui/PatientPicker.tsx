import { useState } from "react";
import { Search } from "lucide-react";
import { useChosenPatient, usePatientLookup } from "@/emr-live/sources";
import { ageFromDob } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Patient } from "@/data/types";

export function PatientPicker({
  value,
  onChange,
  filter,
  placeholder = "Search by name, MRN, phone…",
}: {
  value?: string | null;
  onChange: (id: string) => void;
  filter?: (p: Patient) => boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = usePatientLookup(q, 8, filter);
  // Remember the chosen patient: a live search result is not kept anywhere else.
  const [picked, setPicked] = useState<Patient | null>(null);
  const selected = useChosenPatient(value, picked);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
        <input
          className="input pl-9"
          placeholder={placeholder}
          value={open ? q : selected ? `${selected.firstName} ${selected.lastName} · ${selected.mrn}` : q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white p-1 shadow-pop ring-1 ring-mist-200">
          {list.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => {
                setPicked(p);
                onChange(p.id);
                setOpen(false);
                setQ("");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50",
                p.id === value && "bg-brand-50",
              )}
            >
              <span className="font-medium text-mist-800">
                {p.firstName} {p.lastName}
              </span>
              <span className="text-[11px] text-mist-400">
                {p.sex} · {ageFromDob(p.dob)} · {p.mrn.slice(-6)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
