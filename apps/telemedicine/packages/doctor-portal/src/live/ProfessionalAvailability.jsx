import React, { useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import * as api from './doctorApi';
import { EmptyState, LoadingState, Notice, PageHeader, StatusBadge } from '../../../shared-portal/design-system/ui.jsx';

const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const TYPES = [['VIRTUAL', 'Video'], ['IN_PERSON', 'In person']];
const period = (day) => ({ day, start: '09:00', end: '17:00', consultationTypes: ['VIRTUAL'], breaks: [{ start: '12:00', end: '13:00' }] });
const defaults = () => [1, 2, 3, 4, 5].map(period);
const today = () => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const get = (k) => parts.find((p) => p.type === k).value; return `${get('year')}-${get('month')}-${get('day')}`; };
const instant = (day, time, zone) => new Date(`${day}T${time}:00${zone === 'Africa/Lagos' ? '+01:00' : 'Z'}`).toISOString();

/** One working period: hours, consultation types and breaks, laid out on a single line where space allows. */
function PeriodEditor({ rule, label, onChange, onRemove }) {
  const types = rule.consultationTypes;
  const setBreak = (i, key, value) => onChange({ ...rule, breaks: rule.breaks.map((b, n) => n === i ? { ...b, [key]: value } : b) });
  return <div className="av-period">
    <div className="av-times">
      <input className="sx-input" aria-label={`${label} starts at`} type="time" value={rule.start} onChange={(e) => onChange({ ...rule, start: e.target.value })} />
      <span aria-hidden="true">–</span>
      <input className="sx-input" aria-label={`${label} ends at`} type="time" value={rule.end} onChange={(e) => onChange({ ...rule, end: e.target.value })} />
    </div>
    <div className="sx-chips" role="group" aria-label={`${label} consultation types`}>
      {TYPES.map(([type, text]) => { const on = types.includes(type); return <button key={type} type="button" className="sx-chip av-chip" aria-pressed={on} onClick={() => onChange({ ...rule, consultationTypes: on ? types.filter((t) => t !== type) : [...types, type] })}>{text}</button>; })}
    </div>
    <div className="av-breaks">
      {rule.breaks.map((b, i) => <span className="av-break" key={i}>
        <span className="av-break-label">Break</span>
        <input className="sx-input" type="time" aria-label={`${label} break ${i + 1} starts`} value={b.start} onChange={(e) => setBreak(i, 'start', e.target.value)} />
        <span aria-hidden="true">–</span>
        <input className="sx-input" type="time" aria-label={`${label} break ${i + 1} ends`} value={b.end} onChange={(e) => setBreak(i, 'end', e.target.value)} />
        <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm av-icon" aria-label={`Remove ${label} break ${i + 1}`} onClick={() => onChange({ ...rule, breaks: rule.breaks.filter((_, n) => n !== i) })}><X size={15} aria-hidden="true" /></button>
      </span>)}
      <button type="button" disabled={rule.breaks.length >= 5} className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => onChange({ ...rule, breaks: [...rule.breaks, { start: rule.start, end: rule.end }] })}><Plus size={15} aria-hidden="true" /> Add break</button>
      {onRemove && <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={onRemove}><Trash2 size={15} aria-hidden="true" /> Remove period</button>}
    </div>
  </div>;
}

export default function ProfessionalAvailability() {
  const [settings, setSettings] = useState({ timezone: 'Africa/Lagos', durationMinutes: 30, bufferMinutes: 5, weeklyHours: defaults() });
  const [blocks, setBlocks] = useState([]), [slots, setSlots] = useState([]);
  const [range, setRange] = useState({ from: today(), to: today() }), [block, setBlock] = useState({ day: today(), start: '12:00', end: '13:00', reason: '' });
  const [exception, setException] = useState({ date: today(), hours: [period(new Date(`${today()}T00:00:00Z`).getUTCDay())] });
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function reload(initial = false) { if (initial) setLoading(true); try { const [s, a] = await Promise.all([api.loadSchedule(), api.loadSlots()]); setSettings({ ...s.settings, weeklyHours: initial && !s.settings.weeklyHours.length ? defaults() : s.settings.weeklyHours }); setBlocks(s.blocks); setSlots(a.items.filter((v) => v.state !== 'CANCELLED')); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { reload(true); }, []);
  async function act(work) { if (busy) return; setBusy(true); setError(''); setNotice(''); try { setNotice(await work()); await reload(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  function inputSettings() { const rules = settings.weeklyHours; if (!rules.length) throw new Error('Enable at least one working day.'); if (rules.some((d) => !d.consultationTypes.length || d.end <= d.start || d.breaks.some((b) => b.end <= b.start || b.start < d.start || b.end > d.end))) throw new Error('Working hours and breaks must have a valid start/end, with breaks inside working hours and a consultation type selected.'); return settings; }
  const changeRule = (index, rule) => setSettings((s) => ({ ...s, weeklyHours: s.weeklyHours.map((v, n) => n === index ? rule : v) }));
  const display = (v) => new Date(v).toLocaleString('en-NG', { timeZone: settings.timezone, dateStyle: 'medium', timeStyle: 'short' });
  const clock = (v) => new Date(v).toLocaleTimeString('en-NG', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit' });
  const dayKey = (v) => new Date(v).toLocaleDateString('en-CA', { timeZone: settings.timezone });
  const slotDays = [...slots.reduce((map, s) => map.set(dayKey(s.startsAt), [...(map.get(dayKey(s.startsAt)) || []), s]), new Map())];
  const openCount = slots.filter((s) => s.state === 'OPEN').length;

  return <div className="dl-page sx-page care-workspace">
    <PageHeader eyebrow="Schedule" title="Manage availability" description={`Set your weekly hours once, publish the dates you want to offer, and block time off. Times use ${settings.timezone}.`}
      actions={<button type="button" className="sx-btn sx-btn-secondary" disabled={busy || loading} onClick={() => reload()}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>} />
    {error && <Notice tone="danger">{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
    {loading ? <LoadingState label="Loading your saved schedule…" /> : <div className="sx-split">
      <form className="sx-card" aria-labelledby="weekly-heading" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.saveSchedule(inputSettings()); return 'Weekly hours saved. Publish your dates to make them bookable.'; }); }}>
        <div className="sx-card-header"><div><h2 id="weekly-heading" className="sx-card-title">Standing weekly hours</h2><p className="sx-card-subtitle">Saving changes the pattern only — existing slots and booked appointments stay as they are.</p></div></div>
        <div className="av-settings">
          <div className="sx-field"><label htmlFor="av-duration">Consultation duration (minutes)</label><div className="av-unit"><input id="av-duration" className="sx-input" type="number" min="5" max="240" step="1" required value={settings.durationMinutes} onChange={(e) => setSettings((s) => ({ ...s, durationMinutes: Number(e.target.value) }))} /></div></div>
          <div className="sx-field"><label htmlFor="av-buffer">Buffer between consultations (minutes)</label><div className="av-unit"><input id="av-buffer" className="sx-input" type="number" min="0" max="120" step="1" required value={settings.bufferMinutes} onChange={(e) => setSettings((s) => ({ ...s, bufferMinutes: Number(e.target.value) }))} /></div></div>
          <div className="sx-field"><label htmlFor="av-zone">Schedule timezone</label><select id="av-zone" className="sx-select" value={settings.timezone} onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}><option>Africa/Lagos</option><option>UTC</option></select></div>
        </div>
        <fieldset disabled={busy} className="av-week"><legend className="sx-sr-only">Working days</legend>
          {WEEK.map((day) => {
            const rules = settings.weeklyHours.map((r, index) => ({ ...r, index })).filter((r) => r.day === day);
            const on = !!rules.length;
            return <div className={`av-day${on ? ' is-on' : ''}`} key={day}>
              <label className="av-day-toggle"><input type="checkbox" checked={on} onChange={(e) => setSettings((s) => ({ ...s, weeklyHours: e.target.checked ? [...s.weeklyHours, period(day)] : s.weeklyHours.filter((r) => r.day !== day) }))} /><span>{names[day]}</span></label>
              <div className="av-day-body">
                {on ? rules.map(({ index, ...rule }, n) => <PeriodEditor key={index} label={n === 0 ? names[day] : `${names[day]} period ${n + 1}`} rule={rule} onChange={(v) => changeRule(index, v)} onRemove={rules.length > 1 ? () => setSettings((s) => ({ ...s, weeklyHours: s.weeklyHours.filter((_, i) => i !== index) })) : null} />) : <span className="av-off">Not working</span>}
                {on && <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" disabled={settings.weeklyHours.length >= 14} onClick={() => setSettings((s) => ({ ...s, weeklyHours: [...s.weeklyHours, { day, start: '18:00', end: '20:00', breaks: [], consultationTypes: ['VIRTUAL'] }] }))}><Plus size={15} aria-hidden="true" /> Add another period</button>}
              </div>
            </div>;
          })}
        </fieldset>
        <div className="sx-actions av-save"><button disabled={busy} className="sx-btn sx-btn-primary" aria-busy={busy}>Save weekly hours</button></div>
      </form>

      <div className="sx-grid">
        <section className="sx-card" aria-labelledby="publish-heading">
          <div className="sx-card-header"><div><h2 id="publish-heading" className="sx-card-title">Publish your schedule</h2><p className="sx-card-subtitle">Turns your weekly hours into bookable slots. Breaks and blocks are skipped; bookings are kept.</p></div></div>
          <form className="sx-grid" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.saveSchedule(inputSettings()); const r = await api.publishSchedule(range); return `${r.created} new slots published; ${r.existing} existing slots kept. Patients can book the open slots.`; }); }}>
            <div className="sx-grid sx-grid-2"><div className="sx-field"><label htmlFor="pub-from">From</label><input id="pub-from" className="sx-input" type="date" required min={today()} value={range.from} onChange={(e) => setRange((v) => ({ ...v, from: e.target.value }))} /></div><div className="sx-field"><label htmlFor="pub-to">Through</label><input id="pub-to" className="sx-input" type="date" required min={range.from} value={range.to} onChange={(e) => setRange((v) => ({ ...v, to: e.target.value }))} /></div></div>
            <span className="sx-hint">Up to 31 days at a time. This also saves your weekly hours.</span>
            <button disabled={busy} className="sx-btn sx-btn-primary sx-btn-block" aria-busy={busy}><CalendarPlus size={16} aria-hidden="true" /> Publish availability</button>
          </form>
        </section>

        <section className="sx-card" aria-labelledby="blocks-heading">
          <div className="sx-card-header"><div><h2 id="blocks-heading" className="sx-card-title">One-off time blocks</h2><p className="sx-card-subtitle">Leave, conferences or anything else. Blocks that overlap a booked appointment are refused.</p></div></div>
          <form className="sx-grid" onSubmit={(e) => { e.preventDefault(); act(async () => { if (block.end <= block.start) throw new Error('Block end must follow start.'); await api.addTimeBlock({ startsAt: instant(block.day, block.start, settings.timezone), endsAt: instant(block.day, block.end, settings.timezone), reason: block.reason }); setBlock((v) => ({ ...v, reason: '' })); return 'Time blocked. Overlapping unbooked slots are no longer offered to patients.'; }); }}>
            <div className="sx-field"><label htmlFor="blk-day">Date</label><input id="blk-day" className="sx-input" required type="date" min={today()} value={block.day} onChange={(e) => setBlock((v) => ({ ...v, day: e.target.value }))} /></div>
            <div className="sx-grid sx-grid-2"><div className="sx-field"><label htmlFor="blk-start">Block starts</label><input id="blk-start" className="sx-input" type="time" required value={block.start} onChange={(e) => setBlock((v) => ({ ...v, start: e.target.value }))} /></div><div className="sx-field"><label htmlFor="blk-end">Block ends</label><input id="blk-end" className="sx-input" type="time" required value={block.end} onChange={(e) => setBlock((v) => ({ ...v, end: e.target.value }))} /></div></div>
            <div className="sx-field"><label htmlFor="blk-reason">Reason (private)</label><input id="blk-reason" className="sx-input" required minLength={2} maxLength={200} value={block.reason} onChange={(e) => setBlock((v) => ({ ...v, reason: e.target.value }))} /><span className="sx-hint">Private — patients never see it.</span></div>
            <button disabled={busy} className="sx-btn sx-btn-secondary sx-btn-block">Add time block</button>
          </form>
          {!!blocks.length && <div className="sx-list av-blocks">{blocks.map((b) => <div className="sx-row" key={b.id}><span className="sx-avatar av-block-icon" aria-hidden="true"><CalendarClock size={18} /></span><div className="sx-row-main"><p className="sx-row-title">{b.reason}</p><p className="sx-row-meta">{display(b.startsAt)} – {clock(b.endsAt)}</p></div><button type="button" disabled={busy} className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => act(async () => { await api.removeTimeBlock(b.id); return 'Block removed. Publish your schedule again to restore available slots.'; })}>Remove block</button></div>)}</div>}
        </section>

        <details className="sx-card av-extra" open>
          <summary><span className="sx-card-title">Date-specific extra hours</span><span className="sx-card-subtitle">Add a special working period without changing your weekly pattern.</span></summary>
          <form className="sx-grid" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.saveSchedule(inputSettings()); const r = await api.publishException(exception); return `${r.created} date-specific slots published; ${r.existing} existing slots kept.`; }); }}>
            <div className="sx-field"><label htmlFor="ex-date">Exception date</label><input id="ex-date" className="sx-input" type="date" required min={today()} value={exception.date} onChange={(e) => { const value = e.target.value; if (value) setException((v) => ({ ...v, date: value, hours: v.hours.map((h) => ({ ...h, day: new Date(`${value}T00:00:00Z`).getUTCDay() })) })); }} /></div>
            <fieldset disabled={busy} className="av-week"><legend className="sx-sr-only">Extra hours</legend><PeriodEditor rule={exception.hours[0]} label="Extra hours" onChange={(rule) => setException((v) => ({ ...v, hours: [rule] }))} /></fieldset>
            <span className="sx-hint">Uses your saved length, buffer and timezone. Remove overlapping unbooked slots first; booked conflicts are refused.</span>
            <button className="sx-btn sx-btn-secondary sx-btn-block" disabled={busy}>Publish extra hours</button>
          </form>
        </details>
      </div>

      <section className="sx-card av-published" aria-labelledby="slots-heading">
        <div className="sx-card-header"><div><h2 id="slots-heading" className="sx-card-title">Published slots · next 30 days</h2><p className="sx-card-subtitle">{openCount} open for booking</p></div></div>
        {!slots.length ? <EmptyState icon={CalendarPlus} title="Nothing published yet">Save your weekly hours, then publish dates to let patients book.</EmptyState>
          : <div className="av-days">{slotDays.map(([day, items]) => <div className="av-slot-day" key={day}>
            <h3>{new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
            <ul className="av-slot-list">{items.map((s) => <li key={s.id} className="av-slot">
              <span className="av-slot-time">{clock(s.startsAt)}<small>{s.consultationTypes?.map((t) => t === 'VIRTUAL' ? 'Video' : 'In person').join(' · ')}</small></span>
              <StatusBadge status={s.state} />
              {s.state === 'OPEN' && <button type="button" disabled={busy} className="sx-btn sx-btn-ghost sx-btn-sm av-icon" aria-label={`Remove slot ${clock(s.startsAt)} on ${day}`} title="Remove slot" onClick={() => act(async () => { await api.cancelSlot(s.id); return 'Slot removed.'; })}><X size={15} aria-hidden="true" /></button>}
            </li>)}</ul>
          </div>)}</div>}
      </section>
    </div>}
  </div>;
}
