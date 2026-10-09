import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BellRing, Copy, Download, Eye, RefreshCw, ShieldCheck } from 'lucide-react';
import { getEmergencyCard, saveEmergencyCard, replaceEmergencyCode } from '../api/emergencyCardApi';
import { closeEmergencyNotification, emergencyAccessUrl, notificationSupport, showEmergencyNotification, syncVisibleEmergencyNotification } from './emergencyCardNotification';
import { downloadLockScreenCard, downloadPrintableCard } from './emergencyCardDownload';
import './EmergencyCard.css';
import '../pages/notification-settings/NotificationSettings.css';

const CONSENT_VERSION = 'emergency-card-v1';
export function EmergencyCardPreview({ card }) {
  const [qr, setQr] = useState(''); const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let live = true; setQr(''); setQrError(false);
    QRCode.toDataURL(emergencyAccessUrl(card.code), { width: 200, margin: 4, errorCorrectionLevel: 'M' }).then((data) => { if (live) setQr(data); }).catch(() => { if (live) setQrError(true); });
    return () => { live = false; };
  }, [card.code]);
  return <div className="ec-preview" aria-label="Emergency Card preview">
    <span className="ec-brand"><ShieldCheck size={20} aria-hidden="true" /> Sabi Health · Emergency Card</span>
    <div className="ec-preview-body"><div><h3>{card.displayName || 'Choose your display name'}</h3>
      <span className="ec-code-label">Emergency code</span><p className="ec-code">{card.code}</p>
      <p>Eligible Care Circle members and clinical hospital staff must sign in to Sabi. This code alone does not grant access.</p>
      <span className={`ec-sharing ${card.sharingEnabled ? 'on' : ''}`}>{card.sharingEnabled ? 'Emergency sharing is on' : 'Emergency sharing is off — lookups are blocked'}</span>
    </div>{qr ? <img src={qr} width="160" height="160" alt="QR code opening the Sabi emergency-access sign-in flow" /> : <p role="status">{qrError ? 'QR unavailable. Your code can still be entered in Sabi emergency access.' : 'Preparing QR…'}</p>}</div>
  </div>;
}

export function EmergencyCardSection({ previewInitially = false }) {
  const [card, setCard] = useState(null); const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(previewInitially); const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState('');
  const [consent, setConsent] = useState(false); const [replace, setReplace] = useState(false);
  const load = useCallback(() => {
    setError('');
    getEmergencyCard().then((data) => { setCard(data); setDraft(data); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (card) void syncVisibleEmergencyNotification(card).catch(() => {}); }, [card]);
  const support = notificationSupport();
  const run = async (key, action) => {
    setBusy(key); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message || 'That action could not be completed. Please retry.'); }
    finally { setBusy(''); }
  };
  const save = () => {
    // Explicit save action only. Ask before any awaited network request to preserve iOS user activation.
    const permission = draft.notificationEnabled && !card.notificationEnabled && support.available
      ? (Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission)) : null;
    return run('save', async () => {
      const next = await saveEmergencyCard({ version: card.version, displayName: draft.displayName.trim(), sharingEnabled: draft.sharingEnabled,
        scopes: draft.scopes, notificationEnabled: draft.notificationEnabled, ...(consentRequired ? { consentVersion: CONSENT_VERSION } : {}) });
      setCard(next); setDraft(next); setConsent(false);
      setMessage('Emergency Card preferences saved.');
      if (permission) { const result = await permission; await showEmergencyNotification(next, result); setMessage('Preferences saved and Emergency Card notification shown. Phone settings control lock-screen visibility.'); }
    });
  };
  const displayNotification = () => {
    const permission = support.available && Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(support.permission);
    return run('notification', async () => {
      const fresh = await getEmergencyCard(); setCard(fresh);
      await showEmergencyNotification(fresh, await permission);
      setMessage('Emergency Card notification shown. You can dismiss it; it will not be sent repeatedly.');
    });
  };
  const rotate = () => run('replace', async () => {
    const next = await replaceEmergencyCode(card.version); setCard(next); setDraft(next); setReplace(false);
    await closeEmergencyNotification();
    if (next.notificationEnabled && support.permission === 'granted') await showEmergencyNotification(next, 'granted');
    setMessage('Emergency code replaced. Old codes no longer work. Replace your downloaded wallpaper and printed cards. Old notifications on other or offline devices may remain visible, but their code cannot be used.');
  });
  const dirty = card && draft && (draft.displayName !== card.displayName || draft.sharingEnabled !== card.sharingEnabled || draft.notificationEnabled !== card.notificationEnabled || JSON.stringify(draft.scopes) !== JSON.stringify(card.scopes));
  const consentRequired = card && draft && draft.sharingEnabled && (!card.sharingEnabled || JSON.stringify(draft.scopes) !== JSON.stringify(card.scopes));
  return <section className="sx-card ec-settings" aria-labelledby="ec-title">
    <div className="sx-card-header"><div className="ns-title"><span className="ns-icon" aria-hidden="true"><ShieldCheck size={20} /></span><div>
      <h2 id="ec-title" className="sx-card-title">Emergency Card</h2><p className="sx-card-subtitle">A name and code someone can find when you need care.</p>
    </div></div></div>
    {!card ? <div role="status">{error ? <><p role="alert">{error}</p><button className="sx-btn sx-btn-secondary" onClick={load}>Try again</button></> : 'Loading your Emergency Card…'}</div> : <>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <fieldset className="ec-controls" disabled={Boolean(busy)}>
          <legend className="sx-sr-only">Emergency Card preferences</legend>
          <label className="sx-field">Name shown on your card<input className="sx-input" value={draft.displayName} maxLength={120} required onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoComplete="name" /></label>
          <label className="ns-option"><input type="checkbox" checked={draft.sharingEnabled} onChange={(e) => setDraft({ ...draft, sharingEnabled: e.target.checked })} />
            <span><strong>Enable emergency sharing</strong><small>Disabling this blocks future emergency lookups, including old QR codes.</small></span></label>
          <div className="ec-scopes"><span className="ec-field-label">Who may access your emergency summary</span>
            <label className="ns-option"><input type="checkbox" checked={draft.scopes.careCircle} onChange={(e) => setDraft({ ...draft, scopes: { ...draft.scopes, careCircle: e.target.checked } })} />
              <span><strong>Your Care Circle</strong><small>Only active members you have explicitly given Emergency Summary permission.</small></span></label>
            <label className="ns-option"><input type="checkbox" checked={draft.scopes.hospitals} onChange={(e) => setDraft({ ...draft, scopes: { ...draft.scopes, hospitals: e.target.checked } })} />
              <span><strong>Verified Sabi hospitals</strong><small>Authorised clinical staff may retrieve it in an emergency, even if you are not enrolled at their hospital. They must record why.</small></span></label>
          </div>
          <label className="ns-option"><input type="checkbox" checked={draft.notificationEnabled} onChange={(e) => setDraft({ ...draft, notificationEnabled: e.target.checked })} />
            <span><strong>Enable Emergency Card notification</strong><small>This is separate from emergency sharing. Turning this off does not change who may access your summary.</small></span></label>
          {consentRequired && <label className="ns-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to share my read-only emergency summary with the selected eligible groups. It includes recorded identification, allergies, medicines, conditions, blood group and emergency contacts.</span></label>}
          <button type="submit" className="sx-btn sx-btn-primary" disabled={!dirty || !draft.displayName.trim() || (consentRequired && !consent) || (draft.sharingEnabled && !draft.scopes.careCircle && !draft.scopes.hospitals)}>{busy === 'save' ? 'Saving…' : 'Save preferences'}</button>
        </fieldset>
      </form>
      <div className="ec-code-row"><div><span className="ec-code-label">Your emergency code</span><p className="ec-readable-code">{card.code}</p></div>
        <button className="sx-btn sx-btn-secondary" disabled={Boolean(busy)} onClick={() => run('copy', async () => { await navigator.clipboard.writeText(card.code); setMessage('Emergency code copied.'); })}><Copy size={17} aria-hidden="true" /> Copy code</button>
      </div>
      <div className="sx-actions ec-actions">
        <button className="sx-btn sx-btn-secondary" onClick={() => setPreview(!preview)} aria-expanded={preview}><Eye size={17} aria-hidden="true" /> {preview ? 'Hide preview' : 'Preview card'}</button>
        <button className="sx-btn sx-btn-secondary" disabled={Boolean(busy) || !card.notificationEnabled} onClick={displayNotification}><BellRing size={17} aria-hidden="true" /> {busy === 'notification' ? 'Showing…' : 'Show Emergency Card notification'}</button>
        <button className="sx-btn sx-btn-secondary" disabled={Boolean(busy)} onClick={() => run('wallpaper', async () => { await downloadLockScreenCard(card); setMessage('Card downloaded. Set the image as your wallpaper yourself in your phone settings.'); })}><Download size={17} aria-hidden="true" /> Download lock-screen card</button>
        <button className="sx-btn sx-btn-secondary" disabled={Boolean(busy)} onClick={() => run('print', async () => { await downloadPrintableCard(card); setMessage('Printable wallet card downloaded. Print at actual size (85.6 × 54 mm).'); })}><Download size={17} aria-hidden="true" /> Download printable card</button>
      </div>
      {preview && <EmergencyCardPreview card={card} />}
      <div className="ec-explanation">
        <p>Your phone settings control lock-screen visibility. The notification may be dismissed; permanent visibility cannot be guaranteed. Sabi does not repeatedly send it after dismissal.</p>
        <p>A PWA cannot change your wallpaper for you. Download the card and set it manually.</p>
        {!support.available && <p>{support.installRequired ? 'On iPhone or iPad, open Sabi from your Home Screen to use notifications.' : 'Notifications are unavailable in this browser; downloads and emergency sharing still work.'}</p>}
        {support.permission === 'denied' && <p>Notifications are blocked in your phone or browser settings. Downloads and emergency sharing still work.</p>}
      </div>
      <div className="ec-replace"><button className="sx-btn sx-btn-ghost" disabled={Boolean(busy)} onClick={() => setReplace(!replace)} aria-expanded={replace}><RefreshCw size={17} aria-hidden="true" /> Replace emergency code</button>
        {replace && <div className="ec-confirm" role="group" aria-label="Confirm emergency code replacement"><p>Previous codes, downloaded cards and printed QR codes will stop working immediately. Replace your wallpaper and printed cards after this change. Old notifications on offline devices cannot always be removed.</p>
          <div className="sx-actions"><button className="sx-btn sx-btn-danger" disabled={Boolean(busy)} onClick={rotate}>{busy === 'replace' ? 'Replacing…' : 'Confirm replacement'}</button><button className="sx-btn sx-btn-secondary" onClick={() => setReplace(false)}>Cancel</button></div></div>}
      </div>
    </>}
    {card && error && <p className="sx-error-text" role="alert">{error}{error.includes('Refresh') && <button className="sx-btn sx-btn-ghost" onClick={load}>Refresh card</button>}</p>}
    {message && <p className="ec-success" role="status">{message}</p>}
  </section>;
}
