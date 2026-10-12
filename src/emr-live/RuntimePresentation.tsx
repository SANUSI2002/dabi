import { useEffect, useState } from 'react';
import { emrRequest } from './client';
import { useLiveEmr } from './session';

type Presentation = { displayName: string; tagline: string; accentColor: string; version: number };
let current: Presentation | null = null;
const listeners = new Set<(p: Presentation | null) => void>();
const publish = (value: Presentation | null) => { current = value; listeners.forEach((fn) => fn(value)); };
export function useTenantPresentation() { const [value, setValue] = useState(current); useEffect(() => { listeners.add(setValue); return () => { listeners.delete(setValue); }; }, []); return value; }
export default function RuntimePresentation() {
  const organizationId = useLiveEmr((s) => s.access?.organizationId);
  useEffect(() => {
    let active = true; publish(null);
    if (organizationId) void emrRequest<{ data: { presentation: Presentation | null } }>('/runtime/presentation').then((r) => { if (active) publish(r.data.presentation); }).catch(() => { /* Presentation failure never blocks clinical care. */ });
    return () => { active = false; publish(null); };
  }, [organizationId]);
  const value = useTenantPresentation();
  if (!value) return null;
  return <div style={{ backgroundColor: value.accentColor }} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-white lg:px-8" aria-label="Hospital workspace identity"><span className="text-sm font-semibold">{value.displayName}</span>{value.tagline && <span className="text-xs">{value.tagline}</span>}</div>;
}
