import React, { useEffect, useState } from 'react';
import { Activity, Eye, FilePen, History, KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '../design-system/ui.jsx';
import './ActivityLog.css';

// One Activity log for both portals. `load({ category, cursor })` returns { items, nextCursor } from
// GET /api/v1/audit/mine; the server words each entry for the reader and only includes device, location
// and IP on entries the reader made themselves.
const TABS = [
  { id: '', label: 'All' }, { id: 'SIGN_IN', label: 'Sign-ins' }, { id: 'RECORD_ACCESS', label: 'Record access' },
  { id: 'RECORD_CHANGE', label: 'Record changes' }, { id: 'PERMISSION', label: 'Permissions' }, { id: 'ACTIVITY', label: 'Your activity' },
];
const ICONS = { SIGN_IN: LogIn, RECORD_ACCESS: Eye, RECORD_CHANGE: FilePen, PERMISSION: ShieldCheck, ACCOUNT: KeyRound, ACTIVITY: Activity };
const INTRO = {
  patient: 'Your sign-ins, every time a professional opened or changed your health record, the access you have given, and everything you have done on Sabi Health.',
  professional: 'Your sign-ins, every patient record you opened or changed, the access patients have given you, and everything you have done in the portal.',
};

const countryName = (code) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code); } catch { return code; } };
export function placeLabel(location) {
  if (!location) return null;
  return [location.city || location.region, location.country && countryName(location.country)].filter(Boolean).join(', ') || null;
}
const dayLabel = (iso) => {
  const day = new Date(iso); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function ActivityLog({ load, audience = 'patient' }) {
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]), [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setItems([]); setCursor(null);
    load({ category })
      .then((page) => { if (current) { setItems(page.items); setCursor(page.nextCursor); } })
      .catch((e) => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [load, category, attempt]);
  async function loadMore() {
    setLoadingMore(true); setError('');
    try { const page = await load({ category, cursor }); setItems((list) => [...list, ...page.items]); setCursor(page.nextCursor); }
    catch (e) { setError(e.message); }
    finally { setLoadingMore(false); }
  }
  const days = items.reduce((groups, item) => {
    const label = dayLabel(item.at); const last = groups.at(-1);
    if (last?.label === label) last.items.push(item); else groups.push({ label, items: [item] });
    return groups;
  }, []);
  return <>
    <PageHeader eyebrow="Security & privacy" title="Activity log" description={INTRO[audience] || INTRO.patient} />
    <Tabs label="Filter activity" tabs={TABS} value={category} onChange={setCategory} />
    {loading ? <LoadingState label="Loading your activity…" />
      : error && !items.length ? <ErrorState title="We couldn't load your activity" message={error} onRetry={() => setAttempt((n) => n + 1)} />
      : !items.length ? <EmptyState icon={History} title="Nothing here yet">Activity appears here as it happens.</EmptyState>
      : <div className="sx-activity">
        {days.map((day) => <section key={day.label} className="sx-card sx-activity-day" aria-label={day.label}>
          <h2 className="sx-activity-day-title">{day.label}</h2>
          <ul className="sx-activity-list">{day.items.map((item) => {
            const Icon = ICONS[item.category] || Activity;
            const warning = item.action === 'SIGN_IN_FAILED';
            const where = [item.device, placeLabel(item.location), item.ip && `IP ${item.ip}`].filter(Boolean).join(' · ');
            return <li key={item.id} className={`sx-activity-item${warning ? ' is-warning' : ''}`}>
              <span className="sx-activity-icon" aria-hidden="true"><Icon size={17} /></span>
              <div className="sx-activity-body"><p className="sx-activity-text">{item.text}</p>{where && <p className="sx-activity-meta">{where}</p>}</div>
              <time className="sx-activity-time" dateTime={item.at}>{clock(item.at)}</time>
            </li>;
          })}</ul>
        </section>)}
        {error && <p className="sx-activity-error" role="alert">{error}</p>}
        {cursor && <div className="sx-actions sx-activity-more"><button type="button" className="sx-btn sx-btn-secondary" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load older activity'}</button></div>}
      </div>}
    <p className="sx-activity-note">Locations are approximate, based on the network used. Entries are kept for your security and can't be edited or deleted. If you don't recognise a sign-in, change your password and sign out on all devices in Settings.</p>
  </>;
}
