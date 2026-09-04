// Ward + bed register for Inpatient Care. Previously a hardcoded list of
// ward names with a fixed bed count per ward — now a real, editable
// register so wards/beds can be added, renamed, retired, or marked VIP.

export type Ward = {
  id: string;
  name: string;
  type: string; // General, Maternity, Paediatric, Isolation, etc.
};

export type Bed = {
  id: string;
  wardId: string;
  label: string;
  isVip: boolean;
  active: boolean; // false = taken out of service
};

export const wards: Ward[] = [
  { id: "w1", name: "Children's Ward", type: "Paediatric" },
  { id: "w2", name: "Female Ward", type: "General" },
  { id: "w3", name: "Male Ward", type: "General" },
  { id: "w4", name: "Maternity Ward", type: "Maternity" },
];

function bedsFor(wardId: string, count: number, vipBed?: number): Bed[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${wardId}-b${i + 1}`,
    wardId,
    label: `Bed ${i + 1}`,
    isVip: vipBed === i + 1,
    active: true,
  }));
}

export const beds: Bed[] = [
  ...bedsFor("w1", 6),
  ...bedsFor("w2", 6),
  ...bedsFor("w3", 6),
  ...bedsFor("w4", 6, 1),
];
