import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, MessageCircle, ShieldCheck } from "lucide-react";
import { PageShell } from "../hospitals/hospitalShared";
import { ErrorState, LoadingState, Notice, PageHeader } from "../../../../shared-portal/design-system/ui.jsx";
import {
  getNotificationSettings, resendWhatsAppCode, sendWhatsAppCode, turnOffWhatsApp, updateNotificationSettings, verifyWhatsAppCode,
} from "../../api/notificationsApi";
import "./NotificationSettings.css";

const CATEGORY_LABELS = {
  MEDICATION: ["Medication reminders", "A message when a dose is due, with Taken and Remind me later buttons."],
  APPOINTMENT: ["Appointment updates", "Confirmations, cancellations, and reminders the day before and an hour before."],
  CARE: ["Prescriptions and care updates", "New prescriptions, care plans and visit summaries. The message only says there is an update; details stay in Sabi."],
};

export const CONSENT_TEXT = "I agree to receive Sabi Health notifications on WhatsApp at this number, including medication reminders. Messages are delivered through WhatsApp (Meta). I can turn this off at any time.";

const fullDate = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });

/** Enter a number and agree → a code is sent; enter the code → linked. Also used to change the number. */
function LinkNumber({ settings, onChanged, onCancel }) {
  const pending = settings.whatsapp.pending;
  const [phone, setPhone] = useState(settings.whatsapp.registeredPhone || "");
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const run = async (work) => {
    setBusy(true); setError("");
    try { onChanged(await work()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (pending) {
    const wait = Math.max(0, Math.ceil((new Date(pending.resendAvailableAt).getTime() - now) / 1000));
    return <form className="ns-form" onSubmit={(e) => { e.preventDefault(); run(async () => { const next = await verifyWhatsAppCode(code.trim()); setCode(""); return next; }); }}>
      <p className="ns-lead">We sent a 6-digit code on WhatsApp to <strong>{pending.phone}</strong>. Enter it below. It expires in 10 minutes.</p>
      <div className="sx-field">
        <label htmlFor="ns-code">Verification code</label>
        <input id="ns-code" className="sx-input ns-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(error)} aria-describedby={error ? "ns-error" : undefined} />
      </div>
      {error && <p id="ns-error" className="sx-error-text" role="alert">{error}</p>}
      <div className="sx-actions">
        <button type="submit" className="sx-btn sx-btn-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify number"}</button>
        <button type="button" className="sx-btn sx-btn-secondary" disabled={busy || wait > 0} onClick={() => run(resendWhatsAppCode)}>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</button>
        <button type="button" className="sx-btn sx-btn-ghost" disabled={busy} onClick={() => onChanged({ ...settings, whatsapp: { ...settings.whatsapp, pending: null } }, { editing: true })}>Use a different number</button>
      </div>
    </form>;
  }

  return <form className="ns-form" onSubmit={(e) => { e.preventDefault(); run(() => sendWhatsAppCode(phone)); }}>
    <div className="sx-field">
      <label htmlFor="ns-phone">WhatsApp number</label>
      <input id="ns-phone" className="sx-input" type="tel" autoComplete="tel" required placeholder="0803 123 4567"
        value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="ns-phone-hint" />
      <span id="ns-phone-hint" className="sx-hint">The number you use on WhatsApp. We'll send a code to check it's yours.</span>
    </div>
    <label className="ns-check">
      <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
      <span>{CONSENT_TEXT}</span>
    </label>
    {error && <p className="sx-error-text" role="alert">{error}</p>}
    <div className="sx-actions">
      <button type="submit" className="sx-btn sx-btn-primary" disabled={busy || !agreed || !phone.trim()}>{busy ? "Sending…" : "Send code"}</button>
      {onCancel && <button type="button" className="sx-btn sx-btn-ghost" onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}

function WhatsAppCard({ settings, onChanged }) {
  const { whatsapp } = settings;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = (next, { editing: keepEditing = false } = {}) => { onChanged(next); setEditing(keepEditing); };

  const turnOff = async () => {
    if (!window.confirm("Turn off WhatsApp notifications? You'll still see everything in Sabi.")) return;
    setBusy(true); setError("");
    try { changed(await turnOffWhatsApp()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <section className="sx-card" aria-labelledby="ns-whatsapp-title">
    <div className="sx-card-header">
      <div className="ns-title"><span className="ns-icon" aria-hidden="true"><MessageCircle size={18} /></span>
        <div><h2 id="ns-whatsapp-title" className="sx-card-title">WhatsApp</h2><p className="sx-card-subtitle">Get reminders and updates on WhatsApp.</p></div>
      </div>
      {whatsapp.connection && <span className="sx-badge sx-badge-success">On</span>}
    </div>
    {!whatsapp.available && !whatsapp.connection
      ? <Notice tone="info" title="Coming soon">WhatsApp notifications are not available yet. You'll still get every notification here in Sabi.</Notice>
      : whatsapp.connection && !editing && !whatsapp.pending
        ? <div className="ns-form">
          <dl className="sx-facts">
            <dt>Number</dt><dd>{whatsapp.connection.phone}</dd>
            <dt>Verified</dt><dd>{fullDate(whatsapp.connection.verifiedAt)}</dd>
            {settings.preferences.consentedAt && <><dt>Agreed</dt><dd>{fullDate(settings.preferences.consentedAt)}</dd></>}
          </dl>
          {error && <p className="sx-error-text" role="alert">{error}</p>}
          <div className="sx-actions">
            <button type="button" className="sx-btn sx-btn-secondary" onClick={() => setEditing(true)}>Change number</button>
            <button type="button" className="sx-btn sx-btn-danger" disabled={busy} onClick={turnOff}>{busy ? "Turning off…" : "Turn off WhatsApp"}</button>
          </div>
        </div>
        : <>
          {whatsapp.connection && <Notice tone="info">Your current number keeps working until the new one is verified.</Notice>}
          <LinkNumber settings={settings} onChanged={changed} onCancel={whatsapp.connection ? () => setEditing(false) : null} />
        </>}
  </section>;
}

function CategoriesCard({ settings, onChanged }) {
  const { preferences, categories } = settings;
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const save = async (key, changes) => {
    setSaving(key); setError("");
    try { onChanged(await updateNotificationSettings(changes)); } catch (e) { setError(e.message); } finally { setSaving(""); }
  };
  const toggle = (category, on) => save(category, { whatsappCategories: on ? [...preferences.whatsappCategories, category] : preferences.whatsappCategories.filter((c) => c !== category) });
  return <section className="sx-card" aria-labelledby="ns-what-title">
    <div className="sx-card-header">
      <div className="ns-title"><span className="ns-icon" aria-hidden="true"><BellRing size={18} /></span>
        <div><h2 id="ns-what-title" className="sx-card-title">What to send on WhatsApp</h2><p className="sx-card-subtitle">Everything always appears in your Sabi notifications.</p></div>
      </div>
    </div>
    <fieldset className="ns-options" disabled={Boolean(saving)}>
      <legend className="sx-sr-only">Updates sent on WhatsApp</legend>
      {categories.map((category) => {
        const [label, hint] = CATEGORY_LABELS[category] || [category, ""];
        return <label key={category} className="ns-option">
          <input type="checkbox" checked={preferences.whatsappCategories.includes(category)} onChange={(e) => toggle(category, e.target.checked)} />
          <span><strong>{label}</strong><small>{hint}</small></span>
        </label>;
      })}
    </fieldset>
    <div className="ns-privacy">
      <span className="ns-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
      <label className="ns-option">
        <input type="checkbox" checked={preferences.showMedicationDetails} disabled={Boolean(saving)} onChange={(e) => save("details", { showMedicationDetails: e.target.checked })} />
        <span><strong>Show medicine names in WhatsApp reminders</strong>
          <small>Off: "It's time for your morning medicine dose." On: "It's time for your Amlodipine 5 mg dose." Anyone who can see your phone could read it.</small></span>
      </label>
    </div>
    {error && <p className="sx-error-text" role="alert">{error}</p>}
  </section>;
}

/** Settings → Notifications: WhatsApp number and consent, and which updates go to WhatsApp. */
export function NotificationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    getNotificationSettings().then((next) => { setSettings(next); setError(""); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return <PageShell mainClassName="sabi-main"><div className="sx-page ns-page">
    <PageHeader eyebrow="Settings" title="Notifications" description="Choose how Sabi reaches you. Notifications always appear in the app; WhatsApp is optional." />
    {error && !settings ? <ErrorState title="We couldn't load your notification settings" message={error} onRetry={load} />
      : !settings ? <LoadingState label="Loading your settings…" />
      : <>
        <WhatsAppCard settings={settings} onChanged={setSettings} />
        <CategoriesCard settings={settings} onChanged={setSettings} />
        <p className="ns-note">Medicine reminders follow the times in <Link to="/medications" className="sx-link">My Medicines</Link>. Marking a dose as taken on WhatsApp updates it here too. Changes to these settings appear in your <Link to="/activity" className="sx-link">Activity log</Link>.</p>
      </>}
  </div></PageShell>;
}

export default NotificationSettingsPage;
