import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bike, Eye, EyeOff, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import { SABI_HEALTH_URL } from "@/public/ecosystemLinks";

/** One visual shell for rider sign-in, signup and account verification. */
export function RiderAuthLayout({ children, registration = false }: { children: ReactNode; registration?: boolean }) {
  return (
    <div className={`sabi-rider rider-access${registration ? " rider-access-register" : ""}`}>
      <header className="rider-access-header">
        <Link className="rider-brand" to="/rider/login">
          <span><Bike size={25} aria-hidden="true" /></span>
          <div><strong>Sabi Health</strong><small>RIDER NETWORK</small></div>
        </Link>
        <a className="rider-access-home" href={SABI_HEALTH_URL}>Sabi Health <ArrowUpRight size={17} aria-hidden="true" /></a>
      </header>
      <main className="rider-access-grid">
        <section className="rider-access-content" aria-label={registration ? "Rider registration" : "Rider account access"}>
          {children}
          <p className="rider-access-help">Need a hand? <a href="mailto:support@sabihealth.org">Contact support</a></p>
        </section>
        <aside className="rider-access-story" aria-label="The Sabi rider network">
          <p className="rider-access-story-tag"><ShieldCheck size={17} aria-hidden="true" /> CARE, ALL THE WAY HOME</p>
          <div className="rider-access-story-copy">
            <h2>More than a delivery.<br /><span>A connection to care.</span></h2>
            <p>Bring a little peace of mind from the pharmacy to someone's doorstep.</p>
          </div>
          <div className="rider-access-route" aria-hidden="true">
            <svg viewBox="0 0 440 255" fill="none"><path d="M32 184H90C155 184 121 67 191 67H235C305 67 265 190 330 190H404" stroke="currentColor" strokeWidth="2" strokeDasharray="5 9" /><circle cx="32" cy="184" r="10" fill="currentColor" /><circle cx="404" cy="190" r="10" fill="currentColor" /><circle cx="220" cy="125" r="78" stroke="currentColor" opacity=".18" /><circle cx="220" cy="125" r="99" stroke="currentColor" opacity=".1" /></svg>
            <span className="rider-access-route-bike"><Bike size={70} strokeWidth={1.4} /></span>
            <span className="rider-access-route-label rider-access-route-pickup"><PackageCheck size={18} /> Pharmacy pickup</span>
            <span className="rider-access-route-label rider-access-route-delivery"><ShieldCheck size={18} /> Confirmed delivery</span>
          </div>
          <div className="rider-access-story-bottom"><LockKeyhole size={21} aria-hidden="true" /><p>One code at collection.<br /><strong>Another at delivery.</strong></p></div>
        </aside>
      </main>
    </div>
  );
}

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
      {newPassword && <small id={`${id}-hint`}>At least 12 characters, including a number and a symbol.</small>}
    </div>
  );
}
