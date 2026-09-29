import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Building2, CreditCard,
  FileClock, Info, LockKeyhole, Pill, Plus, ShieldCheck, Stethoscope, Wallet,
} from "lucide-react";

import "../../styles/share.css";
import "./Wallet.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";

const PLANNED_USES = [
  { icon: Stethoscope, title: "Consultations", detail: "Find a doctor", to: "/doctor" },
  { icon: Pill, title: "Prescriptions", detail: "Browse the pharmacy", to: "/pharmacy-market" },
  { icon: Building2, title: "Hospital visits", detail: "Explore hospitals", to: "/hospitals" },
];

export function WalletPage() {
  const [zoom] = useZoom();
  const [activityType, setActivityType] = useState("all");

  // There is no patient-wallet API or server ledger yet. Never derive a balance
  // from browser storage, checkout orders, or sample transactions.
  const transactions = [];

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search Sabi Health..." />
        <div className="sabi-wallet-page">
          <header className="sabi-wallet-heading">
            <div>
              <span className="sabi-wallet-eyebrow">PATIENT PAYMENTS</span>
              <h1>Sabi Wallet</h1>
              <p>A dedicated place for your future care balance, payments and receipts.</p>
            </div>
            <span className="sabi-wallet-stage"><span /> Frontend preview</span>
          </header>

          <div className="sabi-wallet-layout">
            <div className="sabi-wallet-primary">
              <section className="sabi-wallet-balance" aria-labelledby="wallet-balance-heading">
                <div className="sabi-wallet-balance-rings" aria-hidden="true"><span /><span /></div>
                <div className="sabi-wallet-balance-top">
                  <span className="sabi-wallet-mark"><Wallet size={24} /></span>
                  <span className="sabi-wallet-status">Not activated</span>
                </div>
                <h2 id="wallet-balance-heading">Available balance</h2>
                <p className="sabi-wallet-balance-value" aria-label="Balance unavailable">—</p>
                <p className="sabi-wallet-balance-note">No wallet account or funds are connected to this page yet.</p>
                <div className="sabi-wallet-balance-footer"><LockKeyhole size={16} /> Balance and activity will come from a secure server ledger when activated.</div>
              </section>

              <section className="sabi-wallet-actions" aria-label="Wallet actions">
                <div className="sabi-wallet-action"><button type="button" disabled aria-label="Add money unavailable until wallet activation"><Plus size={20} /></button><span>Add money</span></div>
                <div className="sabi-wallet-action"><button type="button" disabled aria-label="Send money unavailable until wallet activation"><ArrowUpRight size={20} /></button><span>Send</span></div>
                <div className="sabi-wallet-action"><button type="button" disabled aria-label="Withdraw money unavailable until wallet activation"><ArrowDownLeft size={20} /></button><span>Withdraw</span></div>
              </section>

              <section className="sabi-wallet-panel sabi-wallet-activity" aria-labelledby="wallet-activity-heading">
                <div className="sabi-wallet-panel-head">
                  <div><span className="sabi-wallet-eyebrow">YOUR LEDGER</span><h2 id="wallet-activity-heading">Activity</h2></div>
                  <div className="sabi-wallet-filters" role="group" aria-label="Filter wallet activity">
                    {["all", "money in", "money out"].map((type) => (
                      <button key={type} type="button" className={activityType === type ? "active" : ""} aria-pressed={activityType === type} onClick={() => setActivityType(type)}>{type}</button>
                    ))}
                  </div>
                </div>
                {transactions.length === 0 && <div className="sabi-wallet-empty"><span><FileClock size={27} /></span><h3>No wallet activity yet</h3><p>{activityType === "all" ? "Once the wallet is activated, verified transactions and receipts will appear here." : `No ${activityType} transactions to show. Wallet transactions are not available yet.`}</p></div>}
              </section>
            </div>

            <aside className="sabi-wallet-aside">
              <section className="sabi-wallet-panel sabi-wallet-notice" aria-labelledby="wallet-status-heading">
                <span className="sabi-wallet-notice-icon"><Info size={19} /></span>
                <h2 id="wallet-status-heading">Wallet is not live yet</h2>
                <p>This is the frontend experience only. You cannot add, transfer or withdraw money here, and no wallet payment will be offered at checkout until the server-side ledger is ready.</p>
                <div className="sabi-wallet-notice-line"><ShieldCheck size={17} /><span>Your current pharmacy checkout still uses its existing secure payment flow.</span></div>
              </section>

              <section className="sabi-wallet-panel" aria-labelledby="wallet-methods-heading">
                <div className="sabi-wallet-panel-head"><div><span className="sabi-wallet-eyebrow">PAYMENT SETUP</span><h2 id="wallet-methods-heading">Funding methods</h2></div></div>
                <div className="sabi-wallet-method"><CreditCard size={21} /><div><strong>No method linked</strong><p>Cards and bank accounts are not stored on this device.</p></div></div>
              </section>

              <section className="sabi-wallet-panel" aria-labelledby="wallet-uses-heading">
                <div className="sabi-wallet-panel-head"><div><span className="sabi-wallet-eyebrow">EXPLORE CARE</span><h2 id="wallet-uses-heading">Where to go next</h2></div></div>
                <p className="sabi-wallet-aside-intro">Explore these services now. Wallet payments for them are planned, not enabled.</p>
                <div className="sabi-wallet-uses">{PLANNED_USES.map(({ icon: Icon, title, detail, to }) => <Link key={title} to={to}><span><Icon size={18} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></Link>)}</div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalletPage;
