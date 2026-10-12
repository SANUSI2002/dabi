import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getLive, writeLive } from './riderApi';
import { riderDate } from './types';
type OfferNotice = { id: string; title: string; message: string; isRead: boolean; link: string | null; createdAt: string };
export default function RiderOfferNotifications() {
  const [items, setItems] = useState<OfferNotice[]>([]), [open, setOpen] = useState(false), [error, setError] = useState('');
  const navigate = useNavigate(), box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true, busy = false;
    const load = async () => { if (busy || document.hidden) return; busy = true; try { const result = await getLive<{ items: OfferNotice[] }>('/api/v1/delivery/offer-notifications'); if (active) { setItems(result?.items || []); setError(''); } } catch { if (active) setError('Delivery alerts could not be loaded. Refresh your deliveries.'); } finally { busy = false; } };
    void load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  const pick = async (n: OfferNotice) => {
    try { await writeLive(`/api/v1/delivery/offer-notifications/${n.id}/read`, {}); setItems((old) => old.map((r) => r.id === n.id ? { ...r, isRead: true } : r)); }
    catch { setError('Could not mark this alert as read.'); }
    setOpen(false); if (n.link?.match(/^\/rider\/delivery\/[a-f\d-]{36}$/i)) navigate(n.link);
  };
  const count = items.filter((n) => !n.isRead).length;
  return <div ref={box} className="rider-notices"><button type="button" aria-label={`Delivery notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open} className="rider-notice-toggle" onClick={() => setOpen((v) => !v)}><Bell size={20} aria-hidden="true" />{count > 0 && <span>{count}</span>}</button>{open && <section className="rider-notice-panel" aria-label="Delivery notifications"><h2>Delivery offers</h2>{error && <p role="alert">{error}</p>}{items.length ? items.map((n) => <button key={n.id} type="button" onClick={() => pick(n)}><strong>{n.title}{!n.isRead && <span className="rider-caption"> · New</span>}</strong><span>{n.message}</span><small>{riderDate(n.createdAt)}</small></button>) : <p>No delivery notifications yet.</p>}</section>}</div>;
}
