import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, MonitorSmartphone, RefreshCw, Share, ShieldCheck, SquarePlus, X, Zap } from "lucide-react";
import { dismissedRecently, promptInstall, rememberDismissal, useInstallState } from "../../../shared-portal/pwa/installPrompt.js";
import { pushNotification } from "../notifications/notificationStore";
import { PageShell } from "../pages/hospitals/hospitalShared";
import "./InstallApp.css";

const ICON = `${import.meta.env.BASE_URL || "/"}pwa-192x192.png`;
const SHOWN_KEY = "sabi-install-sheet-shown";
const SHOW_AFTER_MS = 2500;

const BENEFITS = [
  { icon: MonitorSmartphone, title: "Opens from your home screen", text: "One tap, full screen, no browser bars — just like any other app." },
  { icon: Zap, title: "Quick on weak connections", text: "The app is kept on your phone, so it starts fast even when the network is slow." },
  { icon: RefreshCw, title: "Always up to date", text: "Improvements arrive by themselves. Nothing to download from an app store." },
  { icon: ShieldCheck, title: "Same secure account", text: "Your records stay protected and you sign in exactly as you do now." },
];

/** iPhone and iPad install from Safari's Share menu; there is no install button to press. */
export function IosSteps() {
  return <ol className="ia-steps">
    <li><span className="ia-step-icon" aria-hidden="true"><Share size={16} /></span><span>Tap <strong>Share</strong> in Safari's toolbar</span></li>
    <li><span className="ia-step-icon" aria-hidden="true"><SquarePlus size={16} /></span><span>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong></span></li>
  </ol>;
}

function InstallButton({ onDone, className = "" }) {
  const [busy, setBusy] = useState(false);
  const install = async () => {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    onDone?.(outcome);
  };
  return <button type="button" className={`sx-btn sx-btn-primary ${className}`} disabled={busy} onClick={install}>
    <Download size={16} aria-hidden="true" /> {busy ? "Opening…" : "Install app"}
  </button>;
}

/**
 * Invitation shown after sign-in, once per visit, until the app is installed (or "Not now" for a week).
 * Also adds an "Install the Sabi app" item to the bell that opens /install.
 */
export function InstallAppSheet() {
  const { installed, canPrompt, platform } = useInstallState();
  const [open, setOpen] = useState(false);
  const installable = canPrompt || platform === "ios";

  useEffect(() => {
    if (installed) return undefined;
    pushNotification({ title: "Install the Sabi app", body: "Open Sabi from your home screen — quicker on slow networks.", kind: "info", dedupeKey: "install-app", link: "/install" });
    let shown = false;
    try { shown = window.sessionStorage.getItem(SHOWN_KEY) === "1"; } catch { /* show anyway */ }
    if (shown || dismissedRecently() || !installable) return undefined;
    const timer = setTimeout(() => {
      setOpen(true);
      try { window.sessionStorage.setItem(SHOWN_KEY, "1"); } catch { /* fine */ }
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [installed, installable]);

  if (!open || installed) return null;
  const later = () => { rememberDismissal(); setOpen(false); };
  return <div className="ia-sheet" role="dialog" aria-modal="false" aria-labelledby="ia-sheet-title">
    <button type="button" className="ia-close" aria-label="Close" onClick={later}><X size={18} /></button>
    <div className="ia-sheet-head">
      <img src={ICON} alt="" width="56" height="56" className="ia-icon" />
      <div>
        <h2 id="ia-sheet-title">Get the Sabi app</h2>
        <p>Install Sabi on this {platform === "desktop" ? "computer" : "phone"}. No app store, takes a few seconds.</p>
      </div>
    </div>
    <ul className="ia-benefits">
      {BENEFITS.slice(0, 3).map(({ icon: Icon, title }) => <li key={title}><Icon size={16} aria-hidden="true" /> {title}</li>)}
    </ul>
    {platform === "ios" && !canPrompt && <IosSteps />}
    <div className="ia-actions">
      {canPrompt && <InstallButton onDone={(outcome) => { if (outcome !== "accepted") later(); else setOpen(false); }} />}
      <button type="button" className="sx-btn sx-btn-ghost" onClick={later}>Not now</button>
      <Link to="/install" className="sx-link" onClick={() => setOpen(false)}>Why install?</Link>
    </div>
  </div>;
}

/** /install — what the installed app gives you, and how to install it on this device. */
const Shell = ({ children }) => <PageShell mainClassName="sabi-main">{children}</PageShell>;
export function InstallAppPage() {
  const { installed, canPrompt, platform } = useInstallState();
  const [outcome, setOutcome] = useState("");
  return <Shell><div className="sx-page ia-page">
    <section className="ia-hero">
      <img src={ICON} alt="" width="88" height="88" className="ia-icon ia-icon-lg" />
      <div>
        <span className="sx-eyebrow">Sabi app</span>
        <h1>Sabi Health, right on your home screen</h1>
        <p>Install Sabi in a few seconds — no app store and no big download. It opens like any other app and starts quickly even on a slow network.</p>
      </div>
    </section>

    <section className="sx-card ia-status" aria-live="polite">
      {installed || outcome === "accepted"
        ? <p className="ia-done"><CheckCircle2 size={20} aria-hidden="true" /> Sabi is installed on this device. Open it from your home screen or app list.</p>
        : canPrompt
          ? <><p>Your browser is ready to install Sabi.</p><InstallButton className="ia-big" onDone={setOutcome} /></>
          : platform === "ios"
            ? <><p>On iPhone or iPad, install Sabi from Safari:</p><IosSteps /></>
            : <><p>Open your browser's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On iPhone, use Safari's Share menu.</p>
              <p className="sx-hint">If you don't see that option, open Sabi in Chrome, Edge or Samsung Internet.</p></>}
      {outcome === "dismissed" && !installed && <p className="sx-hint">No problem — you can install it any time from this page.</p>}
    </section>

    <section className="ia-grid" aria-label="What you get">
      {BENEFITS.map(({ icon: Icon, title, text }) => <article key={title} className="sx-card ia-benefit">
        <span className="ia-benefit-icon" aria-hidden="true"><Icon size={20} /></span>
        <h2>{title}</h2><p>{text}</p>
      </article>)}
    </section>

    <section className="sx-card ia-faq">
      <h2 className="sx-card-title">Good to know</h2>
      <dl>
        <dt>Does it take much space?</dt><dd>No. It's the same Sabi you use in the browser, kept on your device — much smaller than a typical app-store app.</dd>
        <dt>Do I still need the internet?</dt><dd>Yes, to see your latest records, book and join consultations. The app itself opens quickly from your phone.</dd>
        <dt>How do I remove it?</dt><dd>Like any app: press and hold the Sabi icon and remove it. Your account and records are not affected.</dd>
      </dl>
    </section>
  </div></Shell>;
}
