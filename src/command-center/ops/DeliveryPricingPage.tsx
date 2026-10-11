// Delivery pricing, set centrally: the rule set in force, a draft editor (rate per km, base fee,
// minimum and cap, distance limits, bands, zones, surcharges, free delivery, rounding, quote
// lifetime, straight-line or road distance), a simulator running the exact checkout calculation on
// the draft, and every version with who changed it, why and when it took effect. Versions are never
// edited; a change is a new version, now or scheduled. Orders keep the quote they were priced with.
import { useMemo, useState } from 'react';
import { CalendarClock, Calculator, Plus, Save, Trash2 } from 'lucide-react';
import type { LiveApiError } from '@/identity/liveIdentity';
import { cn } from '@/lib/cn';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { cancelPricingVersion, createPricingVersion, getDeliveryPricing, simulateDelivery, type Band, type DeliveryQuote, type PricingRules, type PricingVersion, type Surcharge, type Zone } from './api';
import { ActionDialog, Empty, ErrorBox, Field, Gate, Loading, naira, Note, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { QuoteBreakdown } from './OrdersPage';

const RULE_KEYS: (keyof PricingRules)[] = ['currency', 'platformFeeMinor', 'deliveryRatePerKmMinor', 'baseFeeMinor', 'includedDistanceKm', 'minimumFeeMinor', 'maximumFeeMinor', 'maxDistanceKm', 'distanceMethod', 'roadFallbackToStraightLine', 'distanceRounding', 'feeRoundingMinor', 'bands', 'zones', 'restrictToZones', 'freeDeliveryThresholdMinor', 'smallOrderThresholdMinor', 'smallOrderFeeMinor', 'surcharges', 'quoteTtlMinutes'];
const pickRules = (v: PricingVersion): PricingRules => Object.fromEntries(RULE_KEYS.map((k) => [k, v[k]])) as PricingRules;
/** Order-insensitive comparison (an omitted optional value counts as null). */
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])])) : value === undefined ? null : value;
const sameRules = (a: PricingRules, b: PricingRules) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const toN = (minor: number | null) => (minor === null ? '' : String(minor / 100));
const toMinor = (naira: string) => Math.round(Number(naira) * 100);
const optMinor = (naira: string) => (naira.trim() === '' ? null : toMinor(naira));
const ROUNDING = [{ value: 'EXACT', label: 'Exact distance' }, { value: 'UP_0_1_KM', label: 'Round up to 0.1 km' }, { value: 'UP_1_KM', label: 'Round up to whole km' }, { value: 'NEAREST_0_1_KM', label: 'Nearest 0.1 km' }];
const ORDER = ['Check the address can be served: pharmacy tier radius, maximum distance, zones (paused zones and "zones only").', 'Billable distance = measured distance − included distance, then rounded as set.', 'Rate per km: the zone’s rate, else the distance band’s rate, else the base rate.', 'Distance charge = billable km × rate.', 'Add the base fee and any zone surcharge.', 'Apply the minimum fee, then the fee cap.', 'Add the small-order fee (below its threshold) and named surcharges.', 'Waive everything when the medicines subtotal reaches the free-delivery threshold.', 'Round the final fee to the set multiple.'];

type Draft = {
  rate: string; base: string; included: string; min: string; max: string; maxKm: string; platform: string; method: PricingRules['distanceMethod']; fallback: boolean; rounding: PricingRules['distanceRounding']; feeRounding: string; ttl: string;
  freeOver: string; smallUnder: string; smallFee: string; restrict: boolean; bands: { fromKm: string; toKm: string; rate: string }[]; zones: (Omit<Zone, 'ratePerKmMinor' | 'surchargeMinor' | 'centre' | 'radiusKm'> & { lat: string; lng: string; radiusKm: string; rate: string; surcharge: string })[]; surcharges: { code: string; label: string; amount: string }[];
};
const draftFrom = (r: PricingRules): Draft => ({
  rate: toN(r.deliveryRatePerKmMinor), base: toN(r.baseFeeMinor), included: String(r.includedDistanceKm), min: toN(r.minimumFeeMinor), max: toN(r.maximumFeeMinor), maxKm: r.maxDistanceKm === null ? '' : String(r.maxDistanceKm), platform: toN(r.platformFeeMinor),
  method: r.distanceMethod, fallback: r.roadFallbackToStraightLine, rounding: r.distanceRounding, feeRounding: toN(r.feeRoundingMinor), ttl: String(r.quoteTtlMinutes),
  freeOver: toN(r.freeDeliveryThresholdMinor), smallUnder: toN(r.smallOrderThresholdMinor), smallFee: toN(r.smallOrderFeeMinor), restrict: r.restrictToZones,
  bands: r.bands.map((b) => ({ fromKm: String(b.fromKm), toKm: b.toKm === null ? '' : String(b.toKm), rate: toN(b.ratePerKmMinor) })),
  zones: r.zones.map((z) => ({ id: z.id, name: z.name, serviceable: z.serviceable !== false, lat: String(z.centre.latitude), lng: String(z.centre.longitude), radiusKm: String(z.radiusKm), rate: toN(z.ratePerKmMinor ?? null), surcharge: toN(z.surchargeMinor ?? null) })),
  surcharges: r.surcharges.map((s) => ({ code: s.code, label: s.label, amount: toN(s.amountMinor) })),
});
function rulesFrom(d: Draft): PricingRules {
  return {
    currency: 'NGN', deliveryRatePerKmMinor: toMinor(d.rate), baseFeeMinor: toMinor(d.base || '0'), includedDistanceKm: Number(d.included || 0), minimumFeeMinor: toMinor(d.min || '0'), maximumFeeMinor: optMinor(d.max),
    maxDistanceKm: d.maxKm.trim() === '' ? null : Number(d.maxKm), platformFeeMinor: toMinor(d.platform || '0'), distanceMethod: d.method, roadFallbackToStraightLine: d.fallback, distanceRounding: d.rounding,
    feeRoundingMinor: Math.max(1, toMinor(d.feeRounding || '0.01')), quoteTtlMinutes: Number(d.ttl || 15), freeDeliveryThresholdMinor: optMinor(d.freeOver), smallOrderThresholdMinor: optMinor(d.smallUnder), smallOrderFeeMinor: toMinor(d.smallFee || '0'),
    restrictToZones: d.restrict,
    bands: d.bands.map((b): Band => ({ fromKm: Number(b.fromKm), toKm: b.toKm.trim() === '' ? null : Number(b.toKm), ratePerKmMinor: toMinor(b.rate) })),
    zones: d.zones.map((z): Zone => ({ id: z.id, name: z.name, serviceable: z.serviceable, centre: { latitude: Number(z.lat), longitude: Number(z.lng) }, radiusKm: Number(z.radiusKm), ratePerKmMinor: optMinor(z.rate), surchargeMinor: optMinor(z.surcharge) })),
    surcharges: d.surcharges.map((s): Surcharge => ({ code: s.code.toUpperCase(), label: s.label, amountMinor: toMinor(s.amount) })),
  };
}
const problems = (d: Draft) => [
  !(Number(d.rate) >= 0 && d.rate.trim() !== '') && 'Set the rate per km.',
  d.bands.some((b) => b.fromKm === '' || b.rate === '') && 'Each band needs a start and a rate.',
  d.zones.some((z) => !/^[a-z0-9-]{2,40}$/.test(z.id) || z.name.trim().length < 2 || z.lat === '' || z.lng === '' || !(Number(z.radiusKm) > 0)) && 'Each zone needs an id (lowercase, digits, hyphens), a name, a centre and a radius.',
  d.surcharges.some((s) => !/^[A-Za-z][A-Za-z0-9_]{1,23}$/.test(s.code) || s.label.trim().length < 2 || !(Number(s.amount) > 0)) && 'Each surcharge needs a code, a label and an amount.',
  d.max !== '' && d.min !== '' && Number(d.max) < Number(d.min) && 'The fee cap is below the minimum fee.',
].filter(Boolean) as string[];

const Num = (props: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) => {
  const { prefix, suffix, className, ...rest } = props;
  return <span className={cn('flex h-9 items-center rounded-lg border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15', className)}>{prefix && <span className="pl-2.5 text-sm text-slate-400">{prefix}</span>}<input type="number" inputMode="decimal" step="any" min="0" {...rest} className="h-full w-full min-w-0 bg-transparent px-2 text-sm font-normal text-slate-800 outline-none" />{suffix && <span className="pr-2.5 text-xs text-slate-400">{suffix}</span>}</span>;
};

function Editor({ state, onSaved }: { state: { active: PricingVersion; routing: { roadConfigured: boolean } }; onSaved: () => void }) {
  const { can } = useCc();
  const [d, setD] = useState<Draft>(() => draftFrom(pickRules(state.active)));
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const issues = problems(d);
  const editable = can('platform.pricing.manage');
  const changed = !sameRules(rulesFrom(d), pickRules(state.active));
  const save = () => setDialog({
    title: 'Publish a new pricing version', confirm: 'Publish version', tone: 'danger', reasonLabel: 'Why the pricing is changing (recorded)',
    description: <>Checkout uses the new version from the time you choose. <b>Orders already placed keep the price they were quoted.</b> Patients mid-checkout get a fresh quote.</>,
    fields: [{ name: 'when', label: 'Takes effect', type: 'select', required: true, defaultValue: 'now', options: [{ value: 'now', label: 'Immediately' }, { value: 'later', label: 'At a scheduled time' }] }, { name: 'effectiveAt', label: 'Scheduled time (your local time)', type: 'datetime-local', hint: 'Only used when scheduling' }],
    run: (v) => createPricingVersion({ ...rulesFrom(d), reason: v.reason, ...(v.when === 'later' && v.effectiveAt ? { effectiveAt: new Date(v.effectiveAt).toISOString() } : {}) }),
    onClose: () => setDialog(null), onDone: () => { setDialog(null); onSaved(); },
  });
  return <div className="grid gap-4 [&>*]:min-w-0">
    <Panel><PanelHeader title="Distance pricing" description="What a delivery costs. All amounts in naira." />
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Rate per km"><Num prefix="₦" suffix="/km" value={d.rate} onChange={(e) => set('rate', e.target.value)} disabled={!editable} /></Field>
        <Field label="Base fee (every delivery)"><Num prefix="₦" value={d.base} onChange={(e) => set('base', e.target.value)} disabled={!editable} /></Field>
        <Field label="Included distance"><Num suffix="km" value={d.included} onChange={(e) => set('included', e.target.value)} disabled={!editable} /></Field>
        <Field label="Maximum distance"><Num suffix="km" placeholder="No limit" value={d.maxKm} onChange={(e) => set('maxKm', e.target.value)} disabled={!editable} /></Field>
        <Field label="Minimum fee"><Num prefix="₦" value={d.min} onChange={(e) => set('min', e.target.value)} disabled={!editable} /></Field>
        <Field label="Fee cap"><Num prefix="₦" placeholder="No cap" value={d.max} onChange={(e) => set('max', e.target.value)} disabled={!editable} /></Field>
        <Field label="Distance measured"><CommandSelect value={d.method} onChange={(e) => set('method', e.target.value as Draft['method'])} disabled={!editable}><option value="STRAIGHT_LINE">Straight line</option><option value="ROAD">By road (Google Routes)</option></CommandSelect></Field>
        <Field label="If road distance fails"><CommandSelect value={d.fallback ? 'yes' : 'no'} onChange={(e) => set('fallback', e.target.value === 'yes')} disabled={!editable || d.method !== 'ROAD'}><option value="no">Refuse to quote</option><option value="yes">Use straight line instead</option></CommandSelect></Field>
        <Field label="Distance rounding"><CommandSelect value={d.rounding} onChange={(e) => set('rounding', e.target.value as Draft['rounding'])} disabled={!editable}>{ROUNDING.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</CommandSelect></Field>
        <Field label="Round the fee to"><Num prefix="₦" value={d.feeRounding} onChange={(e) => set('feeRounding', e.target.value)} disabled={!editable} /></Field>
        <Field label="Quote valid for"><Num suffix="min" value={d.ttl} onChange={(e) => set('ttl', e.target.value)} disabled={!editable} /></Field>
        <Field label="Platform fee (per order)"><Num prefix="₦" value={d.platform} onChange={(e) => set('platform', e.target.value)} disabled={!editable} /></Field>
      </div>
      {d.method === 'ROAD' && !state.routing.roadConfigured && <div className="px-4 pb-4"><Note tone="warning">Road distance is not configured on the server (no Google Routes key). {d.fallback ? 'Every quote will fall back to straight-line distance and say so.' : 'Publishing will be refused unless you allow the straight-line fallback.'}</Note></div>}
    </Panel>
    <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-2">
      <Panel><PanelHeader title="Distance bands" description="A different rate per km by distance (used when the address is not in a priced zone)." action={editable && <CommandButton variant="secondary" className="h-8" onClick={() => set('bands', [...d.bands, { fromKm: d.bands.at(-1)?.toKm || '0', toKm: '', rate: d.rate }])}><Plus size={13} />Band</CommandButton>} />
        {d.bands.length ? <div className="grid gap-2 p-4">{d.bands.map((b, i) => <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-2"><Field label="From"><Num suffix="km" value={b.fromKm} disabled={!editable} onChange={(e) => set('bands', d.bands.map((x, j) => (j === i ? { ...x, fromKm: e.target.value } : x)))} /></Field><Field label="To"><Num suffix="km" placeholder="and beyond" value={b.toKm} disabled={!editable} onChange={(e) => set('bands', d.bands.map((x, j) => (j === i ? { ...x, toKm: e.target.value } : x)))} /></Field><Field label="Rate"><Num prefix="₦" suffix="/km" value={b.rate} disabled={!editable} onChange={(e) => set('bands', d.bands.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} /></Field>{editable && <CommandButton variant="quiet" aria-label="Remove band" onClick={() => set('bands', d.bands.filter((_, j) => j !== i))}><Trash2 size={14} /></CommandButton>}</div>)}</div> : <Empty title="No bands" hint="Every km is charged at the base rate." />}
      </Panel>
      <Panel><PanelHeader title="Surcharges and discounts" />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Field label="Free delivery when medicines reach"><Num prefix="₦" placeholder="Off" value={d.freeOver} onChange={(e) => set('freeOver', e.target.value)} disabled={!editable} /></Field>
          <Field label="Small-order fee below"><Num prefix="₦" placeholder="Off" value={d.smallUnder} onChange={(e) => set('smallUnder', e.target.value)} disabled={!editable} /></Field>
          <Field label="Small-order fee"><Num prefix="₦" value={d.smallFee} onChange={(e) => set('smallFee', e.target.value)} disabled={!editable} /></Field>
        </div>
        <div className="border-t border-slate-100 p-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-600">Named surcharges (added to every delivery)</p>{editable && <CommandButton variant="secondary" className="h-8" onClick={() => set('surcharges', [...d.surcharges, { code: '', label: '', amount: '' }])}><Plus size={13} />Surcharge</CommandButton>}</div>
          {d.surcharges.map((s, i) => <div key={i} className="mb-2 grid grid-cols-[1fr_1.5fr_1fr_auto] items-end gap-2"><Field label="Code"><CommandInput value={s.code} placeholder="FUEL" disabled={!editable} onChange={(e) => set('surcharges', d.surcharges.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} /></Field><Field label="Label shown to patient"><CommandInput value={s.label} placeholder="Fuel surcharge" disabled={!editable} onChange={(e) => set('surcharges', d.surcharges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></Field><Field label="Amount"><Num prefix="₦" value={s.amount} disabled={!editable} onChange={(e) => set('surcharges', d.surcharges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></Field>{editable && <CommandButton variant="quiet" aria-label="Remove surcharge" onClick={() => set('surcharges', d.surcharges.filter((_, j) => j !== i))}><Trash2 size={14} /></CommandButton>}</div>)}
          {!d.surcharges.length && <p className="text-xs text-slate-500">None.</p>}
        </div>
      </Panel>
    </div>
    <Panel><PanelHeader title="Zones" description="Circular areas with their own rate or surcharge, or paused for delivery." action={editable && <CommandButton variant="secondary" className="h-8" onClick={() => set('zones', [...d.zones, { id: '', name: '', serviceable: true, lat: '6.5244', lng: '3.3792', radiusKm: '5', rate: '', surcharge: '' }])}><Plus size={13} />Zone</CommandButton>} />
      {d.zones.length ? <div className="overflow-x-auto p-4"><div className="grid min-w-[880px] gap-2">{d.zones.map((z, i) => {
        const up = (patch: Partial<Draft['zones'][number]>) => set('zones', d.zones.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return <div key={i} className="grid grid-cols-[1fr_1.3fr_.9fr_.9fr_.8fr_1fr_1fr_.9fr_auto] items-end gap-2"><Field label="Id"><CommandInput value={z.id} placeholder="lekki" disabled={!editable} onChange={(e) => up({ id: e.target.value.toLowerCase() })} /></Field><Field label="Name"><CommandInput value={z.name} placeholder="Lekki Phase 1" disabled={!editable} onChange={(e) => up({ name: e.target.value })} /></Field><Field label="Latitude"><CommandInput value={z.lat} disabled={!editable} onChange={(e) => up({ lat: e.target.value })} /></Field><Field label="Longitude"><CommandInput value={z.lng} disabled={!editable} onChange={(e) => up({ lng: e.target.value })} /></Field><Field label="Radius"><Num suffix="km" value={z.radiusKm} disabled={!editable} onChange={(e) => up({ radiusKm: e.target.value })} /></Field><Field label="Rate (optional)"><Num prefix="₦" suffix="/km" value={z.rate} disabled={!editable} onChange={(e) => up({ rate: e.target.value })} /></Field><Field label="Surcharge"><Num prefix="₦" value={z.surcharge} disabled={!editable} onChange={(e) => up({ surcharge: e.target.value })} /></Field><Field label="Delivery"><CommandSelect value={z.serviceable ? 'on' : 'off'} disabled={!editable} onChange={(e) => up({ serviceable: e.target.value === 'on' })}><option value="on">Serviced</option><option value="off">Paused</option></CommandSelect></Field>{editable && <CommandButton variant="quiet" aria-label="Remove zone" onClick={() => set('zones', d.zones.filter((_, j) => j !== i))}><Trash2 size={14} /></CommandButton>}</div>;
      })}</div><label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={d.restrict} disabled={!editable} onChange={(e) => set('restrict', e.target.checked)} />Deliver only inside serviced zones</label></div> : <Empty title="No zones" hint="Every address within range is priced by distance." />}
    </Panel>
    <Simulator rules={rulesFrom(d)} draftValid={!issues.length} changed={changed} />
    {editable ? <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      {issues.length > 0 ? <p className="mr-auto text-sm text-red-700">{issues[0]}</p> : changed ? <p className="mr-auto text-sm text-slate-600">Unsaved changes to version {state.active.version}.</p> : <p className="mr-auto text-sm text-slate-500">No changes.</p>}
      <CommandButton variant="secondary" disabled={!changed} onClick={() => setD(draftFrom(pickRules(state.active)))}>Discard</CommandButton>
      <CommandButton disabled={!changed || issues.length > 0} onClick={save}><Save size={14} />Publish…</CommandButton>
    </div> : <Note>You can view and simulate pricing. Changing it needs the pricing role.</Note>}
    {dialog && <ActionDialog {...dialog} />}
  </div>;
}

function Simulator({ rules, draftValid, changed }: { rules: PricingRules; draftValid: boolean; changed: boolean }) {
  const [origin, setOrigin] = useState({ lat: '6.5244', lng: '3.3792' });
  const [mode, setMode] = useState<'km' | 'point'>('km');
  const [km, setKm] = useState('5');
  const [dest, setDest] = useState({ lat: '6.6018', lng: '3.3515' });
  const [subtotal, setSubtotal] = useState('3000');
  const [tier, setTier] = useState('');
  const [useDraft, setUseDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LiveApiError | null>(null);
  const [result, setResult] = useState<{ draft: boolean; basedOnVersion: number; quote: DeliveryQuote } | null>(null);
  const destination = useMemo(() => (mode === 'km' ? { latitude: Number(origin.lat) + Number(km) / 111.195, longitude: Number(origin.lng) } : { latitude: Number(dest.lat), longitude: Number(dest.lng) }), [mode, origin, km, dest]);
  async function run() {
    setBusy(true); setError(null);
    try { setResult(await simulateDelivery({ rules: useDraft && changed ? rules : undefined, origin: { latitude: Number(origin.lat), longitude: Number(origin.lng) }, destination, subtotalMinor: toMinor(subtotal || '0'), tierRadiusKm: tier ? Number(tier) : null })); }
    catch (e) { setError(e as LiveApiError); setResult(null); } finally { setBusy(false); }
  }
  return <Panel><PanelHeader title="Simulator" description="Runs the exact checkout calculation. Nothing is saved." />
    <form className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr]" onSubmit={(e) => { e.preventDefault(); void run(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pharmacy latitude"><CommandInput value={origin.lat} onChange={(e) => setOrigin({ ...origin, lat: e.target.value })} /></Field>
        <Field label="Pharmacy longitude"><CommandInput value={origin.lng} onChange={(e) => setOrigin({ ...origin, lng: e.target.value })} /></Field>
        <Field label="Patient address as"><CommandSelect value={mode} onChange={(e) => setMode(e.target.value as 'km' | 'point')}><option value="km">A distance away (straight line)</option><option value="point">Coordinates</option></CommandSelect></Field>
        {mode === 'km' ? <Field label="Distance"><Num suffix="km" value={km} onChange={(e) => setKm(e.target.value)} /></Field> : <div className="grid grid-cols-2 gap-2"><Field label="Latitude"><CommandInput value={dest.lat} onChange={(e) => setDest({ ...dest, lat: e.target.value })} /></Field><Field label="Longitude"><CommandInput value={dest.lng} onChange={(e) => setDest({ ...dest, lng: e.target.value })} /></Field></div>}
        <Field label="Medicines subtotal"><Num prefix="₦" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} /></Field>
        <Field label="Pharmacy tier radius (optional)"><Num suffix="km" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="None" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={useDraft} disabled={!changed} onChange={(e) => setUseDraft(e.target.checked)} />{changed ? 'Use my unsaved draft' : 'Using the version in force (no unsaved changes)'}</label>
        <div className="sm:col-span-2"><CommandButton type="submit" disabled={busy || (useDraft && changed && !draftValid)}><Calculator size={14} />{busy ? 'Calculating…' : 'Calculate'}</CommandButton></div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4" aria-live="polite">
        {error ? <ErrorBox error={error.code === 'NOT_SERVICEABLE' ? Object.assign(new Error(`Not deliverable: ${error.message}`), { status: 422 }) : error} /> : result ? <><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{result.draft ? `Draft (based on version ${result.basedOnVersion})` : `Version ${result.basedOnVersion} in force`}</p><QuoteBreakdown quote={result.quote} /></> : <p className="text-sm text-slate-500">Enter a pharmacy and an address, then calculate. Example: 5 km at ₦200/km with no other rules is ₦1,000.</p>}
      </div>
    </form>
  </Panel>;
}

function Versions({ versions, onChanged }: { versions: PricingVersion[]; onChanged: () => void }) {
  const f = useFormat();
  const { can } = useCc();
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const cancel = (v: PricingVersion) => setDialog({ title: `Cancel scheduled version ${v.version}`, confirm: 'Cancel version', tone: 'danger', description: `It would have taken effect ${f.dateTime(v.effectiveAt)}. The version in force does not change.`, run: (x) => cancelPricingVersion(v.version, x.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); onChanged(); } });
  if (!versions.length) return <Panel><Empty title="No versions yet" hint="The platform default (₦600/km) applies until the first version is published." /></Panel>;
  return <Panel><Table caption="Pricing versions" head={['Version', 'State', 'Takes effect', 'Rate', 'Rules', 'Changed by', 'Why', '']}>{versions.map((v) => <tr key={v.version}>
    <Td className="font-semibold">v{v.version}</Td><Td><StatusPill status={human(v.state)} /></Td><Td className="text-xs">{f.dateTime(v.effectiveAt)}{v.cancelledAt && <span className="block text-red-700">cancelled {f.date(v.cancelledAt)}{v.cancelledByName && ` by ${v.cancelledByName}`}</span>}</Td><Td>{naira(v.deliveryRatePerKmMinor)}/km</Td>
    <Td className="text-xs text-slate-600">{[v.baseFeeMinor && `base ${naira(v.baseFeeMinor)}`, v.minimumFeeMinor && `min ${naira(v.minimumFeeMinor)}`, v.maximumFeeMinor !== null && `cap ${naira(v.maximumFeeMinor)}`, v.maxDistanceKm !== null && `max ${v.maxDistanceKm} km`, v.bands.length && `${v.bands.length} band(s)`, v.zones.length && `${v.zones.length} zone(s)`, v.freeDeliveryThresholdMinor !== null && `free over ${naira(v.freeDeliveryThresholdMinor)}`, v.distanceMethod === 'ROAD' && 'road distance'].filter(Boolean).join(' · ') || 'rate only'}</Td>
    <Td className="text-xs">{v.createdByName ?? '—'}<span className="block text-slate-500">{f.date(v.createdAt)}</span></Td><Td className="max-w-[240px] text-xs">{v.changeReason ?? '—'}</Td>
    <Td>{v.state === 'SCHEDULED' && can('platform.pricing.manage') && <CommandButton className="h-8" variant="quiet" onClick={() => cancel(v)}><CalendarClock size={13} />Cancel</CommandButton>}</Td>
  </tr>)}</Table>{dialog && <ActionDialog {...dialog} />}</Panel>;
}

export default function DeliveryPricingPage() {
  const f = useFormat();
  const [tab, setTab] = useState<'editor' | 'versions' | 'how'>('editor');
  const [key, setKey] = useState(0);
  const { data, error, loading, reload } = useLoad(() => getDeliveryPricing(), []);
  const active = data?.active;
  const scheduled = data?.versions.find((v) => v.state === 'SCHEDULED');
  return <Gate any={['platform.pricing.manage', 'platform.finance.read', 'platform.ops.read']} what="Delivery pricing">
    <CommandPageHeader eyebrow="Sabi Health · Pricing" title="Delivery pricing" description="Set how much delivery costs. The server prices every checkout with the version in force, shows the patient the breakdown, and freezes it on the order." />
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Panel><Loading /></Panel> : active && <>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-emerald-300">In force</p><p className="mt-1 font-display text-xl font-bold">{naira(active.deliveryRatePerKmMinor)}/km</p><p className="text-xs text-slate-400">Version {active.version}{active.effectiveAt && ` since ${f.date(active.effectiveAt)}`}</p></div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">5 km example</p><p className="mt-1 font-display text-xl font-bold">{naira(5 * active.deliveryRatePerKmMinor)}</p><p className="text-xs text-slate-500">distance charge only, before other rules</p></div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">Distance</p><p className="mt-1 font-semibold">{active.distanceMethod === 'ROAD' ? 'By road' : 'Straight line'}</p><p className="text-xs text-slate-500">Road routing {data.routing.roadConfigured ? 'configured' : 'not configured'}</p></div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">Next change</p><p className="mt-1 font-semibold">{scheduled ? `v${scheduled.version}` : 'None scheduled'}</p><p className="text-xs text-slate-500">{scheduled ? f.dateTime(scheduled.effectiveAt) : 'Publish a version to change pricing'}</p></div>
      </div>
      <Tabs label="Delivery pricing" value={tab} onChange={setTab} tabs={[{ value: 'editor', label: 'Rules & simulator' }, { value: 'versions', label: 'Versions', count: data.versions.length }, { value: 'how', label: 'How it is calculated' }]} />
      {tab === 'editor' && <Editor key={`${active.version}-${key}`} state={data} onSaved={() => { reload(); setKey((k) => k + 1); setTab('versions'); }} />}
      {tab === 'versions' && <Versions versions={data.versions} onChanged={reload} />}
      {tab === 'how' && <Panel><PanelHeader title="Calculation order" description="The server applies these steps in this order for every pharmacy in a checkout." /><ol className="list-decimal space-y-2 py-4 pl-9 pr-4 text-sm text-slate-700">{ORDER.map((s) => <li key={s}>{s}</li>)}</ol><div className="grid gap-2 px-4 pb-4"><Note>Money is kept in kobo; nothing is rounded until the steps say so. Each order stores its itemised quote and the version number, so a later change never alters an order already placed.</Note><Note>If the patient’s quote is out of date when they pay (a new version took effect, or the quote expired), checkout shows the new total and asks them to confirm.</Note><Note>Addresses out of range are refused with the reason (beyond the pharmacy radius, beyond the maximum distance, in a paused zone, or outside serviced zones).</Note></div></Panel>}
    </>}
  </Gate>;
}
