import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Radio, RefreshCw } from 'lucide-react';
import { ActionDialog, type ActionDialogProps, naira } from '@/command-center/ops/kit';
import { getLive, writeLive } from './riderApi';
import { riderDate, type RiderAssignment } from './types';
import { RiderEarningsSkeleton } from './RiderLoading';

type Point = { latitude: number; longitude: number; accuracyMeters: number };
type Availability = { isAvailable: boolean; availableUntil: string | null; availabilityVersion: number };
const locate = (): Promise<Point> => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('Location sharing is not available on this device.'));
  navigator.geolocation.getCurrentPosition((p) => p.coords.accuracy > 1000 ? reject(new Error('Your location is not accurate enough yet. Try again outdoors.')) : resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy }), () => reject(new Error('Allow location access in your browser to receive nearby deliveries.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
});
export function RiderAvailability() {
  const [state, setState] = useState<Availability | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => getLive<Availability>('/api/v1/delivery/availability').then(setState).catch((e) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!state?.isAvailable) return;
    let stopped = false, pending = false;
    const heartbeat = async () => {
      if (stopped || pending || document.hidden) return;
      pending = true;
      try { const point = await locate(); if (!stopped) await writeLive('/api/v1/delivery/presence', point); }
      catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Location could not be updated.'); }
      finally { pending = false; }
    };
    void heartbeat(); const timer = setInterval(heartbeat, 60000);
    const expiry = setTimeout(() => void load(), Math.max(1000, new Date(state.availableUntil || '').getTime() - Date.now()));
    return () => { stopped = true; clearInterval(timer); clearTimeout(expiry); };
  }, [state?.isAvailable, state?.availableUntil, load]);
  const toggle = async () => {
    if (!state || busy) return;
    setBusy(true); setError('');
    try {
      const next = !state.isAvailable, point = next ? await locate() : undefined;
      setState(await writeLive<Availability>('/api/v1/delivery/availability', { available: next, expectedVersion: state.availabilityVersion, durationMinutes: 60, ...(point ? { location: point } : {}) }, 'PUT'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Availability could not be saved.'); await load(); }
    finally { setBusy(false); }
  };
  return <section className="rider-card rider-online-card" aria-label="Rider availability"><div><Radio size={22} aria-hidden="true" /><h2>{state?.isAvailable ? 'You’re online' : 'Ready for your next delivery?'}</h2><p className="rider-muted">{state?.isAvailable ? `Available until ${riderDate(state.availableUntil)}. Keep this page open for current dispatch location.` : 'Go online to receive nearby assignments. Location is shared with dispatch while this page is open.'}</p>{error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}</div><button type="button" className={state?.isAvailable ? 'rider-button-secondary' : 'rider-button'} disabled={busy || !state} onClick={toggle}>{busy ? 'Updating…' : state?.isAvailable ? 'Go offline' : 'Go online'}</button></section>;
}
export function RiderLocationAndIssues({ assignment }: { assignment: RiderAssignment }) {
  const [tracking, setTracking] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const inTransit = assignment.assignmentStatus === 'ACCEPTED' && ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(assignment.fulfilmentStatus);
  const sending = useRef(false), lastSent = useRef(0);
  useEffect(() => {
    if (!tracking || !inTransit || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(async (p) => {
      if (document.hidden || sending.current || Date.now() - lastSent.current < 15000 || p.coords.accuracy > 1000) return;
      sending.current = true; lastSent.current = Date.now();
      try { await writeLive(`/api/v1/delivery/assignments/${assignment.id}/locations`, { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy }); setStatus(`Location shared at ${new Date().toLocaleTimeString('en-NG')}`); setError(''); }
      catch (e) { setError(e instanceof Error ? e.message : 'Location could not be shared.'); setTracking(false); }
      finally { sending.current = false; }
    }, () => { setError('Location permission is unavailable. Handover codes still work.'); setTracking(false); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [tracking, inTransit, assignment.id]);
  const report = () => setDialog({ title: 'Report a delivery issue', confirm: 'Send to operations', reasonLabel: null, description: 'The delivery stays active. Reporting an issue does not mark it delivered or release stock. Do not include patient medical details.', fields: [{ name: 'kind', label: 'Issue', type: 'select', defaultValue: 'RECIPIENT_UNAVAILABLE', required: true, options: ['RECIPIENT_UNAVAILABLE', 'ADDRESS_ISSUE', 'PACKAGE_DAMAGED', 'VEHICLE_BREAKDOWN', 'SAFETY_ISSUE', 'OTHER'].map((value) => ({ value, label: value.replaceAll('_', ' ').toLowerCase() })) }, { name: 'note', label: 'What happened?', type: 'textarea', required: true }], run: (v) => writeLive(`/api/v1/delivery/assignments/${assignment.id}/exceptions`, { kind: v.kind, note: v.note }), onClose: () => setDialog(null), onDone: () => { setDialog(null); setStatus('Issue received. Sabi operations can now review it.'); } });
  if (assignment.assignmentStatus !== 'ACCEPTED') return null;
  return <section className="rider-card rider-operational-tools"><h2>Delivery tools</h2><p className="rider-muted">Location sharing is optional and runs only while this page is open.</p><div className="rider-tool-actions">{inTransit && <button type="button" className="rider-button-secondary" aria-pressed={tracking} onClick={() => navigator.geolocation ? setTracking((v) => !v) : setError('This device does not support location sharing.')}><MapPin size={17} aria-hidden="true" />{tracking ? 'Stop sharing location' : 'Share live location'}</button>}<button type="button" className="rider-button-secondary" onClick={report}>Report an issue</button></div>{tracking && <p role="status" className="rider-muted">Location sharing is on. Updates pause when this page is hidden.</p>}{status && <p role="status" className="rider-alert rider-alert-success">{status}</p>}{error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}{dialog && <ActionDialog {...dialog} />}</section>;
}
type Bank = { bankName: string; accountName: string; accountLast4: string; revision: number };
type Payout = { id: string; reference: string; amountMinor: number; status: string; accountLast4: string; createdAt: string };
type Earnings = { availableMinor: number; paidMinor: number; heldMinor: number; items: { id: string; orderReference: string; pharmacy: string; amountMinor: number; createdAt: string; payoutStatus: string }[]; payouts: Payout[]; bank: Bank | null; total: number; providerConfigured: boolean; note: string };
export function RiderEarnings() {
  const [data, setData] = useState<Earnings | null>(null), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState(''), [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setData(await getLive<Earnings>(`/api/v1/delivery/earnings?page=${page}&limit=25`)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load earnings.'); } finally { setLoading(false); } }, [page]);
  useEffect(() => { void load(); }, [load]);
  const done = () => { setDialog(null); void load(); };
  const bank = async () => {
    try {
      const result = await getLive<{ items: { name: string; code: string }[] }>('/api/v1/delivery/banks');
      setDialog({ title: 'Your payout bank account', confirm: 'Verify and save', reasonLabel: null, description: 'Use your own Nigerian bank account in the same legal name as your approved rider identity. Sabi stores only the account name, last four digits and provider reference.', fields: [{ name: 'bankCode', label: 'Bank', type: 'select', required: true, defaultValue: result.items[0]?.code, options: result.items.map((b) => ({ value: b.code, label: b.name })) }, { name: 'accountNumber', label: '10-digit account number', type: 'text', required: true }], run: (v) => writeLive('/api/v1/delivery/bank-account', { bankCode: v.bankCode, accountNumber: v.accountNumber, expectedRevision: data?.bank?.revision || 0 }, 'PUT'), onClose: () => setDialog(null), onDone: () => { setMessage('Bank account verified and saved.'); done(); } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Bank verification unavailable.'); }
  };
  const withdraw = () => {
    const key = crypto.randomUUID();
    setDialog({ title: 'Request earnings payout', confirm: 'Request payout', reasonLabel: null, description: `Request ${naira(data?.availableMinor)} to account ending ${data?.bank?.accountLast4}. Finance approval and provider confirmation are required. Large balances may be split into batches.`, run: () => writeLive<Payout>('/api/v1/delivery/payouts', { requestKey: key, expectedBankRevision: data?.bank?.revision }), onClose: () => setDialog(null), onDone: (result) => { setMessage(`Payout request received: ${naira((result as Payout).amountMinor)}. Finance review is next.`); done(); } });
  };
  return <><div className="rider-page-heading"><div><p className="rider-eyebrow">Every delivery, accounted for</p><h1>Your earnings</h1><p className="rider-muted">NGN earnings and withdrawals to your verified bank account.</p></div><button type="button" className="rider-button-secondary" disabled={loading} onClick={load}><RefreshCw size={17} />Refresh</button></div>{error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}{message && <p role="status" className="rider-alert rider-alert-success">{message}</p>}
    {loading && !data ? <RiderEarningsSkeleton /> : data && <>
      <div className="rider-stats rider-earnings-stats">{[['Available to request', data.availableMinor], ['Awaiting payout', data.heldMinor], ['Paid to your bank', data.paidMinor]].map(([label, amount]) => <article className="rider-card rider-stat" key={String(label)}><div><p className="rider-muted">{String(label)}</p><strong>{naira(amount as number)}</strong></div></article>)}</div>
      <section className="rider-card rider-operational-tools"><h2>Payout account</h2><p>{data.bank ? `${data.bank.bankName} · •••• ${data.bank.accountLast4} · ${data.bank.accountName}` : 'Add your own verified bank account before requesting a payout.'}</p><div className="rider-tool-actions"><button type="button" className="rider-button-secondary" disabled={!data.providerConfigured || loading} onClick={bank}>{data.bank ? 'Change bank account' : 'Add bank account'}</button><button type="button" className="rider-button" disabled={!data.bank || !data.availableMinor || loading} onClick={withdraw}>Request payout</button></div><p className="rider-muted">Bank changes and payouts require recent authenticator verification. <Link to="/identity/mfa">Manage account security</Link>.</p>{!data.providerConfigured && <p className="rider-muted">Payout provider configuration is required. Earnings remain recorded; no payment is fabricated.</p>}</section>
      <section className="rider-card rider-operational-tools"><h2>Delivery earnings</h2><p className="rider-muted">{data.note}</p><div className="rider-ledger">{data.items.map((e) => <article key={e.id}><div><strong>{e.orderReference}</strong><p className="rider-muted">{e.pharmacy} · {riderDate(e.createdAt)}</p><span className="rider-caption">{e.payoutStatus.replaceAll('_', ' ').toLowerCase()}</span></div><strong>{naira(e.amountMinor)}</strong></article>)}</div>{!data.items.length && <p className="rider-muted">Completed deliveries with an earning offer appear here.</p>}{data.total > 25 && <div className="rider-tool-actions"><button type="button" className="rider-button-secondary" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page}</span><button type="button" className="rider-button-secondary" disabled={page * 25 >= data.total || loading} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</section>
      <section className="rider-card rider-operational-tools"><h2>Payout history</h2><div className="rider-ledger">{data.payouts.map((p) => <article key={p.id}><div><strong>{naira(p.amountMinor)}</strong><p className="rider-muted">Account •••• {p.accountLast4} · {riderDate(p.createdAt)}</p><span className="rider-caption">{p.reference}</span></div><span className="rider-status">{p.status.replaceAll('_', ' ').toLowerCase()}</span></article>)}</div>{!data.payouts.length && <p className="rider-muted">Your payout requests appear here.</p>}</section>
    </>}{dialog && <ActionDialog {...dialog} />}</>;
}
