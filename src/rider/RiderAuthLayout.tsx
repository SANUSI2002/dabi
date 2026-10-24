import SabiBrand from '@/components/brand/SabiBrand';
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bike, Check, Eye, EyeOff, Radio, ShieldCheck, Wallet, X } from "lucide-react";
import { SABI_HEALTH_URL } from "@/public/ecosystemLinks";
import RiderPwa from './RiderPwa';

/** One calm shell for rider sign-in, sign-up and email verification. The side panel only says what
 *  the rider network really does. */
export function RiderAuthLayout({ children, registration = false }: { children: ReactNode; registration?: boolean }) {
  return (
    <div className={`sabi-rider rider-access${registration ? " rider-access-register" : ""}`}>
      <header className="rider-access-header">
        <Link className="rider-brand" to="/rider/login">
          <SabiBrand symbol size={38} inverse/>
          <div><strong>Sabi Health</strong><small>RIDER NETWORK</small></div>
        </Link>
        <a className="rider-access-home" href={SABI_HEALTH_URL}>Sabi Health <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>
      <main className="rider-access-grid">
        <section className="rider-access-content" aria-label={registration ? "Rider registration" : "Rider account access"}>
          <RiderPwa />
          {children}
          <p className="rider-access-help">Need a hand? <a href="mailto:support@sabihealth.org">Contact support</a></p>
        </section>
        <aside className="rider-access-story" aria-label="The Sabi rider network">
          <div style={{ display: "grid", gap: 14 }}>
            <p className="rider-access-story-tag"><ShieldCheck size={16} aria-hidden="true" /> CARE, ALL THE WAY HOME</p>
            <h2>More than a delivery.<br /><span>A connection to care.</span></h2>
            <p>Carry medicines from trusted pharmacies to the people waiting for them.</p>
          </div>
          <ul className="rider-access-benefits">
            <li><Radio size={20} aria-hidden="true" /><div><strong>Ride when it suits you</strong>Go online when you are ready; go offline any time.</div></li>
            <li><Wallet size={20} aria-hidden="true" /><div><strong>See what you earn first</strong>Each offer shows your earning before you accept it.</div></li>
            <li><ShieldCheck size={20} aria-hidden="true" /><div><strong>Every handover confirmed</strong>One code at the pharmacy, another at the door.</div></li>
          </ul>
          <p className="rider-access-story-bottom"><Bike size={18} aria-hidden="true" /> Paid to your own verified bank account.</p>
        </aside>
      </main>
    </div>
  );
}

const RULES: [string, (v: string) => boolean][] = [
  ["12+ characters", (v) => v.length >= 12],
  ["A number", (v) => /\d/.test(v)],
  ["A symbol", (v) => /[^A-Za-z0-9]/.test(v)],
];
export const strongPassword = (v: string) => RULES.every(([, test]) => test(v));

export function RiderPasswordField({ id, value, onChange, disabled = false, newPassword = false }: {
  id: string; value: string; onChange: (value: string) => void; disabled?: boolean; newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="rider-access-field">
      <label htmlFor={id}>Password</label>
      <div className="rider-password">
        <input id={id} className="rider-input" required type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 12 : undefined} maxLength={newPassword ? 128 : undefined} aria-describedby={newPassword ? `${id}-hint` : undefined} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <button className="rider-eye" type="button" disabled={disabled} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
      </div>
      {newPassword && <ul id={`${id}-hint`} className="rider-password-rules" aria-label="Password needs">
        {RULES.map(([label, test]) => { const met = test(value); return <li key={label} className={met ? "is-met" : ""}>{met ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{label}<span className="sr-only">{met ? " (done)" : " (still needed)"}</span></li>; })}
      </ul>}
    </div>
  );
}
