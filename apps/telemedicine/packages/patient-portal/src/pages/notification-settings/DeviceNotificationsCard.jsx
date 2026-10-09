import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Send } from "lucide-react";
import { Notice } from "../../../../shared-portal/design-system/ui.jsx";
import { updateNotificationSettings } from "../../api/notificationsApi";
import { disablePush, enablePush, pushStatus, sendTestPush } from "../../pwa/pushNotifications";

const KINDS = { MEDICATION: "Medicine reminders, with Taken and Remind me later", APPOINTMENT: "Appointment updates and reminders", CARE: "Prescriptions, care plans and visit summaries" };

/** Settings → Notifications: normal phone/computer notifications for this device. */
export function DeviceNotificationsCard({ settings, onChanged }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ tone: "", text: "" });
  const load = useCallback(() => { pushStatus().then(setStatus).catch((e) => setStatus({ state: "error", error: e.message })); }, []);
  useEffect(load, [load]);

  const run = async (key, work, done) => {
    setBusy(key); setMessage({ tone: "", text: "" });
    try { const result = await work(); if (done) setMessage({ tone: "success", text: done(result) }); }
    catch (e) { setMessage({ tone: "danger", text: e.message }); if (e.code === "BLOCKED") load(); }
    finally { setBusy(""); }
  };
  const kinds = settings.preferences.pushCategories ?? Object.keys(KINDS);
  const toggleKind = (kind, on) => run(kind, async () => onChanged(await updateNotificationSettings({ pushCategories: on ? [...kinds, kind] : kinds.filter((k) => k !== kind) })));
  const state = status?.state;

  return <section className="sx-card" aria-labelledby="ns-device-title">
    <div className="sx-card-header">
      <div className="ns-title"><span className="ns-icon" aria-hidden="true"><BellRing size={18} /></span>
        <div><h2 id="ns-device-title" className="sx-card-title">Notifications on this device</h2><p className="sx-card-subtitle">Pop-up notifications like any other app, even when Sabi is closed.</p></div>
      </div>
      {state === "on" && <span className="sx-badge sx-badge-success">On</span>}
    </div>
    <div className="ns-form">
      {!status ? <p className="sx-hint">Checking this device…</p>
        : state === "needs-install" ? <Notice tone="info" title="Install Sabi first">On iPhone and iPad, notifications work once Sabi is on your home screen. <Link to="/install" className="sx-link">How to install</Link></Notice>
        : state === "unsupported" ? <Notice tone="info">This browser can't show notifications. Try Chrome, Edge or Samsung Internet, or the installed Sabi app.</Notice>
        : state === "unavailable" ? <Notice tone="info" title="Coming soon">Phone notifications are not available yet. You'll still see everything in Sabi.</Notice>
        : state === "blocked" ? <Notice tone="warning" title="Notifications are blocked">Allow notifications for Sabi in your browser or phone settings, then come back here.</Notice>
        : state === "error" ? <Notice tone="danger">{status.error}</Notice>
        : state === "on" ? <>
          <p className="ns-lead">This device shows Sabi notifications. Tap <strong>Taken</strong> right on a medicine reminder.</p>
          <div className="sx-actions">
            <button type="button" className="sx-btn sx-btn-secondary" disabled={Boolean(busy)} onClick={() => run("test", sendTestPush, () => "Test sent. It should pop up in a few seconds.")}><Send size={15} aria-hidden="true" /> {busy === "test" ? "Sending…" : "Send a test"}</button>
            <button type="button" className="sx-btn sx-btn-danger" disabled={Boolean(busy)} onClick={() => run("off", async () => setStatus(await disablePush()))}>{busy === "off" ? "Turning off…" : "Turn off on this device"}</button>
          </div>
        </> : <>
          <p className="ns-lead">Get medicine reminders and updates as notifications on this {status.config && /Android|iPhone|iPad/i.test(navigator.userAgent) ? "phone" : "device"}.</p>
          <div className="sx-actions">
            <button type="button" className="sx-btn sx-btn-primary" disabled={Boolean(busy)} onClick={() => run("on", async () => setStatus(await enablePush()), () => "Notifications are on for this device.")}><BellRing size={15} aria-hidden="true" /> {busy === "on" ? "Turning on…" : "Turn on notifications"}</button>
          </div>
        </>}
      {message.text && <p className={message.tone === "danger" ? "sx-error-text" : "sx-hint"} role={message.tone === "danger" ? "alert" : "status"}>{message.text}</p>}
      {(state === "on" || state === "off") && <fieldset className="ns-options" disabled={Boolean(busy)}>
        <legend className="sx-label">Show notifications for</legend>
        {Object.entries(KINDS).map(([kind, label]) => <label key={kind} className="ns-option">
          <input type="checkbox" checked={kinds.includes(kind)} onChange={(e) => toggleKind(kind, e.target.checked)} />
          <span><strong>{label}</strong></span>
        </label>)}
      </fieldset>}
    </div>
  </section>;
}

export default DeviceNotificationsCard;
