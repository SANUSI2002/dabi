import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, WifiOff } from 'lucide-react';
import { installRiderApp, riderPwaSnapshot, riderPwaState, setRiderManifest, subscribeRiderPwa } from './riderAppState';

/** Also restores the pharmacy manifest when navigating out of the rider app. */
export function RiderPwaRoute() {
  const { pathname } = useLocation();
  useEffect(() => { setRiderManifest(pathname); }, [pathname]);
  return null;
}

export default function RiderPwa() {
  useSyncExternalStore(subscribeRiderPwa, riderPwaSnapshot, riderPwaSnapshot);
  const { online, installed, canInstall, ios } = riderPwaState();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function install() {
    if (busy) return;
    if (!canInstall) { setHelp(!help); return; }
    setBusy(true); setError('');
    try { await installRiderApp(); }
    catch { setError('The install window could not open. Try your browser’s Install app menu.'); }
    finally { setBusy(false); }
  }
  return <section className="rider-pwa" aria-label="Rider app and connection">
    {!online && <p className="rider-alert rider-alert-warn" role="status"><WifiOff size={20} aria-hidden="true" /><span>You’re offline. Connect to refresh offers, upload documents or confirm a handover. Nothing is sent automatically.</span></p>}
    {!installed && <div className="rider-install">
      <div><strong>Sabi Rider, on your home screen</strong><p>Open your deliveries in one tap.</p></div>
      <button className="rider-button-secondary" type="button" disabled={busy} onClick={install} aria-expanded={!canInstall ? help : undefined} aria-controls={!canInstall ? 'rider-install-help' : undefined}><Download size={18} aria-hidden="true" />{busy ? 'Opening…' : 'Install app'}</button>
    </div>}
    {!installed && help && <div id="rider-install-help" className="rider-install-help">
      {ios ? <p><Share size={17} aria-hidden="true" /> In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> and <strong>Add</strong>.</p>
        : <p>In Chrome, Edge or Samsung Internet, open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If it is not available, continue in your browser.</p>}
      <p>You still need internet for live offers, delivery codes and payouts. Installing does not enable background GPS tracking.</p>
    </div>}
    {error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}
  </section>;
}
