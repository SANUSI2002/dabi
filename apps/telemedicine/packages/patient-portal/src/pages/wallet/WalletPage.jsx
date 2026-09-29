import React, { useState } from "react";
import {
  ArrowUpRight, CreditCard, FileClock, Info, Landmark, LockKeyhole,
  Plus, ShieldCheck, Wallet,
} from "lucide-react";

import "../../styles/share.css";
import "./Wallet.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";

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
        <Topbar />
        <div className="sabi-wallet-page">
          <header className="sabi-wallet-heading">
            <div>
              <span className="sabi-wallet-eyebrow">PATIENT PAYMENTS</span>
              <h1>Sabi Wallet</h1>
              <p>Your naira balance, deposits, withdrawals and receipts in one place.</p>
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
                <h2 id="wallet-balance-heading">Available balance · NGN</h2>
                <p className="sabi-wallet-balance-value" aria-label="Naira balance unavailable">₦ —</p>
                <p className="sabi-wallet-balance-note">No wallet account or funds are connected to this page yet.</p>
                <div className="sabi-wallet-balance-footer"><LockKeyhole size={16} /> Balance and activity will come from a secure server ledger when activated.</div>
              </section>

              <section className="sabi-wallet-actions" aria-label="Wallet actions">
                <div className="sabi-wallet-action"><button type="button" disabled aria-label="Add money unavailable until wallet activation"><Plus size={20} /></button><span>Add money</span></div>
                <div className="sabi-wallet-action"><button type="button" disabled aria-label="Withdraw to your bank account unavailable until wallet activation"><ArrowUpRight size={20} /></button><span>Withdraw to my bank</span></div>
              </section>

              <section className="sabi-wallet-panel sabi-wallet-activity" aria-labelledby="wallet-activity-heading">
                <div className="sabi-wallet-panel-head">
                  <div><span className="sabi-wallet-eyebrow">YOUR LEDGER</span><h2 id="wallet-activity-heading">Activity</h2></div>
                  <div className="sabi-wallet-filters" role="group" aria-label="Filter wallet activity">
                    {["all", "deposits", "withdrawals"].map((type) => (
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
                <p>This is the frontend experience only. Adding naira and withdrawing to your own verified bank account will be available after the secure wallet service is connected. Sending to other people is not part of this wallet.</p>
                <div className="sabi-wallet-notice-line"><ShieldCheck size={17} /><span>Your current pharmacy checkout still uses its existing secure payment flow; it does not spend wallet funds.</span></div>
              </section>

              <section className="sabi-wallet-panel" aria-labelledby="wallet-methods-heading">
                <div className="sabi-wallet-panel-head"><div><span className="sabi-wallet-eyebrow">ADD MONEY</span><h2 id="wallet-methods-heading">Funding method</h2></div></div>
                <div className="sabi-wallet-method"><CreditCard size={21} /><div><strong>No method linked</strong><p>No card details are stored on this device.</p></div></div>
              </section>

              <section className="sabi-wallet-panel" aria-labelledby="wallet-bank-heading">
                <div className="sabi-wallet-panel-head"><div><span className="sabi-wallet-eyebrow">WITHDRAW MONEY</span><h2 id="wallet-bank-heading">Your bank account</h2></div></div>
                <div className="sabi-wallet-method"><Landmark size={21} /><div><strong>No account linked</strong><p>Withdrawals will only go to a verified account belonging to you.</p></div></div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalletPage;
