import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useMatch, useNavigate } from "react-router-dom";
import {
  ArrowRight, Bike, CheckCircle2, ChevronRight, ClipboardList, Headphones, History, KeyRound, LayoutDashboard, LoaderCircle,
  LogOut, MapPin, Package, PhoneCall, RefreshCw, ShieldCheck, UserRound, Wallet,
} from "lucide-react";
import { apiConfigured } from "@/config/runtime";
import { liveSignIn, liveSignOut, restoreLiveIdentity, type LiveIdentity } from "@/identity/liveIdentity";
import { IdleSignOutNotice } from "@/identity/IdleSessionGuard";
import { SABI_HEALTH_URL } from "@/public/ecosystemLinks";
import { getLive, writeLive } from "@/pharmacy/liveApi";
import RiderDelivery from "./RiderDelivery";
import { RiderAvailability, RiderEarnings } from "./RiderOperations";
import RiderOfferNotifications from "./RiderOfferNotifications";
import { riderDate, riderStatus, type RiderAssignment, type RiderHistory, type RiderOverview } from "./types";
import "./rider.css";
import { RiderAuthLayout, RiderPasswordField } from "./RiderAuthLayout";
import { RiderDeliverySkeleton, RiderFormSkeleton, RiderListSkeleton, RiderWorkspaceSkeleton, riderSkeletonPage } from "./RiderLoading";

// The mobile bar holds the five everyday destinations; Earnings is added to the sidebar and reached
// from the dashboard and account pages on mobile, so the bar stays readable at five items.
const nav = [
  { path: "/rider/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/rider/offers", label: "Deliveries", icon: Bike },
  { path: "/rider/history", label: "History", icon: History },
  { path: "/rider/profile", label: "My account", icon: UserRound },
  { path: "/rider/support", label: "Support", icon: Headphones },
];
const sidebarNav = [...nav.slice(0, 3), { path: "/rider/earnings", label: "Earnings", icon: Wallet }, ...nav.slice(3)];
const root = "/api/v1/delivery";
const naira = (minor: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);
const statusTone = (item: RiderAssignment) =>
  item.assignmentStatus === "PENDING" ? "is-accent"
    : item.assignmentStatus === "COMPLETED" ? "is-success"
      : item.assignmentStatus === "REJECTED" ? "is-neutral"
        : "is-info";
type Filter = "all" | "offers" | "active";

export default function RiderPortal() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const deliveryRoute = useMatch("/rider/delivery/:assignmentId");
  const historyRoute = useMatch("/rider/history/:assignmentId");
  const assignmentId = deliveryRoute?.params.assignmentId || historyRoute?.params.assignmentId;
  const joined = pathname === "/rider/join" || pathname === "/rider/signup";
  const page = pathname.startsWith("/rider/history") ? "history"
    : pathname === "/rider/earnings" ? "earnings"
      : pathname === "/rider/profile" ? "profile"
        : pathname === "/rider/support" ? "support"
          : pathname === "/rider/offers" || deliveryRoute ? "offers"
            : "dashboard";
  const gate = useRef(false);
  const currentDetail = useRef(assignmentId);
  useEffect(() => { currentDetail.current = assignmentId; }, [assignmentId]);
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [overview, setOverview] = useState<RiderOverview | null>(null);
  const [restoring, setRestoring] = useState(apiConfigured);
  const [items, setItems] = useState<RiderAssignment[]>([]);
  const [detail, setSelected] = useState<RiderAssignment | null>(null);
  const selected = identity && detail?.id === assignmentId ? detail : null;
  const [history, setHistory] = useState<RiderHistory>({ items: [], nextOffset: null });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [queueNext, setQueueNext] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  // A message about one page should not follow the rider to the next one.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) { setShownPath(pathname); setMessage(""); if (identity) setError(""); }

  const load = useCallback(async () => {
    const [summary, assignments] = await Promise.all([
      getLive<RiderOverview>(`${root}/me`),
      getLive<RiderAssignment[]>(`${root}/assignments`),
    ]);
    setOverview(summary);
    setItems(assignments);
    setQueueNext(assignments.length === 50 ? 50 : null);
  }, []);
  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;
    restoreLiveIdentity()
      .then(async (current) => {
        if (!active || !current) return;
        if (!current.user.roles.includes("DELIVERY_PARTNER")) throw new Error("Sabi operations must activate your delivery partner account.");
        await load();
        if (active) setIdentity(current);
      })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    if (!identity) return;
    let active = true, polling = false;
    const timer = setInterval(async () => {
      if (!active || polling || gate.current || document.hidden) return;
      polling = true;
      try { await load(); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not refresh delivery offers."); }
      finally { polling = false; }
    }, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [identity, load]);
  async function run(work: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Delivery service unavailable. Please retry."); }
    finally { gate.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!identity || !assignmentId) return;
    let active = true;
    getLive<RiderAssignment>(`${root}/assignments/${encodeURIComponent(assignmentId)}`)
      .then((item) => { if (active) { setSelected(item); setError(""); } })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [assignmentId, identity]);
  const loadHistory = useCallback(async (offset = 0) => {
    const result = await getLive<RiderHistory>(`${root}/history?limit=20&offset=${offset}`);
    setHistory((previous) => ({ items: offset ? [...previous.items, ...result.items] : result.items, nextOffset: result.nextOffset }));
    setHistoryLoaded(true);
  }, []);
  useEffect(() => {
    if (!identity || page !== "history") return;
    let active = true;
    getLive<RiderHistory>(`${root}/history?limit=20&offset=0`)
      .then((result) => { if (!active) return; setHistory(result); setHistoryLoaded(true); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [identity, page]);
  async function action(kind: string, body: Record<string, unknown> = {}) {
    if (!selected) return;
    await run(async () => {
      const confirmed = await writeLive<Pick<RiderAssignment, "assignmentStatus" | "fulfilmentStatus">>(`${root}/assignments/${selected.id}/${kind}`, body);
      if (currentDetail.current === selected.id)
        setSelected({ ...selected, ...confirmed, ...(confirmed.assignmentStatus === "COMPLETED" || confirmed.assignmentStatus === "REJECTED" ? { recipient: undefined } : {}) });
      setMessage(kind === "accept" ? "Collection accepted."
        : kind === "reject" ? "Assignment declined."
          : body.status === "PICKED_UP" ? "Package collected successfully."
            : body.status === "DELIVERED" ? "Package delivered successfully."
              : "Delivery started successfully.");
      try {
        const fresh = await getLive<RiderAssignment>(`${root}/assignments/${selected.id}`);
        if (currentDetail.current === selected.id) setSelected(fresh);
        await load();
        if (page === "history") await loadHistory();
      } catch {
        throw new Error("Handover saved. Could not refresh delivery details; use Refresh.");
      }
    });
  }
  async function refresh() {
    await load();
    if (page === "history") await loadHistory();
    if (assignmentId) {
      const fresh = await getLive<RiderAssignment>(`${root}/assignments/${encodeURIComponent(assignmentId)}`);
      if (currentDetail.current === assignmentId) setSelected(fresh);
    }
  }
  async function signOut() {
    await run(async () => {
      await liveSignOut();
      setIdentity(null); setOverview(null); setItems([]); setHistory({ items: [], nextOffset: null }); setSelected(null);
      navigate("/rider/login", { replace: true });
    });
  }

  // ---- join (legacy enquiry route) -----------------------------------------------------------
  if (joined)
    return (
      <RiderAuthLayout registration>
        <div className="rider-stack-sm">
          <p className="rider-eyebrow">Deliver with Sabi</p>
          <h1>Care doesn’t end at the pharmacy.</h1>
          <p className="rider-muted">Join the delivery network connecting partner pharmacies with patients. Sabi operations reviews and activates rider access before assignments are shared.</p>
        </div>
        <Link className="rider-button rider-button-lg" to="/rider/register">Apply online <ArrowRight size={18} aria-hidden="true" /></Link>
        <div className="rider-card rider-join-note">
          <h2>Prefer to speak to someone?</h2>
          <p className="rider-muted">Send your name, operating area and contact number. Do not send identity documents or passwords by email.</p>
          <a className="rider-button-secondary" href="mailto:support@sabihealth.org?subject=Sabi%20rider%20network%20enquiry">Contact Sabi operations <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
        <div className="rider-actions" style={{ justifyContent: "space-between" }}>
          <Link className="rider-text-link" to="/rider/login">Already activated? Sign in <ArrowRight size={17} aria-hidden="true" /></Link>
          <a className="rider-text-link" href={SABI_HEALTH_URL}>Back to Sabi Health</a>
        </div>
      </RiderAuthLayout>
    );

  // ---- checking an existing session: show the page that is coming, not the sign-in form ----
  if (!identity && restoring && pathname !== "/rider/login") return <RiderWorkspaceSkeleton page={riderSkeletonPage(pathname)} />;

  // ---- sign in -----------------------------------------------------------------------------------
  if (!identity)
    return (
      <RiderAuthLayout>
        <div className="rider-stack-sm">
          <p className="rider-eyebrow">Sabi rider network</p>
          <h1>Welcome back.</h1>
          <p className="rider-muted">Sign in to see your offers and deliveries.</p>
        </div>
        <IdleSignOutNotice />
        {error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}
        {restoring ? (
          <RiderFormSkeleton />
        ) : !apiConfigured ? (
          <div className="rider-alert rider-alert-warn">
            <div><h2>API connection required</h2><p>This local-storage preview cannot verify real collection or delivery codes. Connect the Sabi API to sign in.</p></div>
          </div>
        ) : (
          <form className="rider-form" onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const result = await liveSignIn(email.trim(), password);
              setPassword("");
              if (result.kind === "MFA") { navigate("/mfa?context=courier"); return; }
              if (!result.identity.user.roles.includes("DELIVERY_PARTNER")) throw new Error("Sabi operations must activate your delivery partner account.");
              await load();
              setIdentity(result.identity);
              navigate("/rider/dashboard", { replace: true });
            });
          }}>
            <div className="rider-field">
              <label htmlFor="rider-email">Email address</label>
              <input id="rider-email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="rider-stack-sm">
              <RiderPasswordField id="rider-password" value={password} onChange={setPassword} disabled={busy} />
              <Link className="rider-text-link" style={{ justifySelf: "end", fontSize: ".88rem" }} to="/forgot-password">Forgot password?</Link>
            </div>
            <button className="rider-button rider-button-lg" disabled={busy}>
              {busy ? <><LoaderCircle size={18} className="rider-spin" aria-hidden="true" />Signing in…</> : <>Sign in<ArrowRight size={18} aria-hidden="true" /></>}
            </button>
          </form>
        )}
        <div className="rider-divider" />
        <div className="rider-stack-sm">
          <p className="rider-muted">New to the rider network? <Link className="rider-text-link" to="/rider/register">Create an account</Link></p>
          <Link className="rider-text-link" to="/rider/application">Already applied? View your application <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </RiderAuthLayout>
    );

  // ---- workspace -------------------------------------------------------------------------------
  const displayName = overview?.profile.displayName || identity.user.fullName || "Rider";
  const firstName = displayName.split(" ")[0];
  const initials = displayName.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0].toUpperCase()).join("").slice(0, 2) || "R";
  const title = page === "history" ? "Delivery history" : page === "earnings" ? "Your earnings" : page === "profile" ? "My account"
    : page === "support" ? "Rider support" : page === "offers" ? "Your deliveries" : "Dashboard";
  const activeItems = items.filter((item) => item.assignmentStatus === "ACCEPTED");
  const pendingItems = items.filter((item) => item.assignmentStatus === "PENDING");
  const nextUp = activeItems[0];
  const pendingCount = overview?.stats.pending || pendingItems.length;
  const shown = filter === "offers" ? pendingItems : filter === "active" ? activeItems : items;
  const isActive = (path: string, matched: boolean) => matched || (path === "/rider/offers" && !!deliveryRoute);

  return (
    <div className="sabi-rider rider-workspace">
      <a className="rider-skip" href="#rider-main">Skip to content</a>
      <aside className="rider-sidebar">
        <Brand />
        <p className="rider-nav-caption">Your workspace</p>
        <nav aria-label="Rider navigation">
          {sidebarNav.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={({ isActive: matched }) => `rider-nav-link${isActive(path, matched) ? " is-active" : ""}`}>
              <Icon size={20} aria-hidden="true" />
              {label}
              {path === "/rider/offers" && !!overview?.stats.pending && <span className="rider-nav-count" aria-label={`${overview.stats.pending} new offers`}>{overview.stats.pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rider-sidebar-bottom">
          <div className="rider-sidebar-note">
            <ShieldCheck size={21} aria-hidden="true" />
            <p>Every handover.<br /><strong>Verified by a code.</strong></p>
          </div>
          <button className="rider-nav-link" disabled={busy} onClick={signOut}><LogOut size={20} aria-hidden="true" />Sign out</button>
        </div>
      </aside>
      <div className="rider-workspace-main">
        <header className="rider-topbar">
          <Link className="rider-topbar-brand rider-brand" to="/rider/dashboard" aria-label="Sabi rider dashboard"><span><Bike size={20} aria-hidden="true" /></span></Link>
          <span className="rider-topbar-label">
            <span className="rider-topbar-crumb">Rider portal <ChevronRight size={16} aria-hidden="true" /></span>
            {title}
          </span>
          <div className="rider-topbar-actions">
            <RiderOfferNotifications />
            <span className="rider-status is-success"><CheckCircle2 size={15} aria-hidden="true" /> Activated rider</span>
            <Link className="rider-avatar" to="/rider/profile" aria-label="My rider account">
              {initials}
            </Link>
            <button className="rider-mobile-signout" disabled={busy} onClick={signOut} aria-label="Sign out"><LogOut size={19} /></button>
          </div>
        </header>
        <main id="rider-main" className="rider-content">
          {message && <p role="status" className="rider-alert rider-alert-success"><CheckCircle2 size={18} aria-hidden="true" />{message}</p>}
          {error && !selected && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}
          {assignmentId ? (
            selected ? (
              <RiderDelivery key={`${selected.id}:${selected.fulfilmentStatus}`} assignment={selected} busy={busy} error={error} onAction={action} onRefresh={() => run(refresh)} />
            ) : error ? (
              <Link className="rider-text-link" to="/rider/offers">Back to deliveries</Link>
            ) : (
              <RiderDeliverySkeleton />
            )
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</p>
                      <h1>Hello, {firstName}.</h1>
                      <p className="rider-muted">{nextUp ? "You have a delivery in progress." : pendingItems.length ? "New offers are waiting for you." : "Go online to start receiving offers."}</p>
                    </div>
                    <RefreshButton busy={busy} onClick={() => run(refresh)} />
                  </div>
                  <RiderAvailability />
                  {nextUp && (
                    <section className="rider-card rider-next" aria-label="Next up">
                      <div className="rider-card-head" style={{ marginBottom: 0 }}>
                        <div><p className="rider-eyebrow">Next up</p><h2>{nextUp.reference}</h2></div>
                        <span className={`rider-chip ${statusTone(nextUp)}`}>{riderStatus(nextUp)}</span>
                      </div>
                      <div className="rider-next-route">
                        <div><Package size={18} aria-hidden="true" /><span><strong>Collect from</strong> {nextUp.pickup.name}, {nextUp.pickup.address}</span></div>
                        {nextUp.recipient && <div><MapPin size={18} aria-hidden="true" /><span><strong>Deliver to</strong> {nextUp.recipient.address}</span></div>}
                      </div>
                      <Link className="rider-button rider-button-lg" to={`/rider/delivery/${nextUp.id}`}>
                        {nextUp.fulfilmentStatus === "READY_FOR_PICKUP" ? "Go to collection" : nextUp.fulfilmentStatus === "PICKED_UP" ? "Start delivery" : "Continue delivery"}
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </section>
                  )}
                  {pendingItems.length > 0 && (
                    <Link className="rider-offer-nudge" to="/rider/offers">
                      <Package size={20} aria-hidden="true" />
                      <span><strong>{pendingCount} new {pendingCount === 1 ? "offer" : "offers"}</strong> {pendingCount === 1 ? "is" : "are"} waiting for you.</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  )}
                  <div className="rider-stats" aria-label="Your deliveries at a glance">
                    {([[Package, "New offers", overview?.stats.pending], [Bike, "In progress", overview?.stats.active], [CheckCircle2, "Delivered", overview?.stats.completed]] as const).map(([Icon, label, count]) => (
                      <article key={label} className="rider-card rider-stat">
                        <span className="rider-feature-icon"><Icon size={22} aria-hidden="true" /></span>
                        <div><p className="rider-muted">{label}</p><strong>{typeof count === "number" ? count.toLocaleString("en-NG") : "—"}</strong></div>
                      </article>
                    ))}
                  </div>
                  <section>
                    <div className="rider-section-heading">
                      <h2>In your care</h2>
                      <Link className="rider-text-link" to="/rider/offers">View all <ArrowRight size={17} aria-hidden="true" /></Link>
                    </div>
                    <AssignmentList items={activeItems.slice(0, 3)} busy={busy} onSelect={(id) => navigate(`/rider/delivery/${id}`)} empty="No active deliveries. Accepted deliveries will appear here." />
                  </section>
                  <nav className="rider-quick-links" aria-label="Shortcuts">
                    <Link className="rider-quick-link" to="/rider/earnings"><span className="rider-feature-icon is-accent"><Wallet size={20} aria-hidden="true" /></span><span>Earnings<small>Balance and payouts</small></span></Link>
                    <Link className="rider-quick-link" to="/rider/support"><span className="rider-feature-icon"><Headphones size={20} aria-hidden="true" /></span><span>Get help<small>Problems on the road</small></span></Link>
                  </nav>
                </>
              )}
              {page === "earnings" && <RiderEarnings />}
              {page === "offers" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Assigned to you</p>
                      <h1>Your deliveries</h1>
                      <p className="rider-muted">Open an offer to see the route and what you earn, then accept it.</p>
                    </div>
                    <RefreshButton busy={busy} onClick={() => run(refresh)} />
                  </div>
                  <div className="rider-segment" role="group" aria-label="Filter deliveries">
                    {([["all", "All", items.length], ["offers", "New offers", pendingItems.length], ["active", "In progress", activeItems.length]] as const).map(([value, label, count]) => (
                      <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span className="rider-caption" style={{ color: "inherit" }}>({count})</span></button>
                    ))}
                  </div>
                  <AssignmentList items={shown} busy={busy} onSelect={(id) => navigate(`/rider/delivery/${id}`)}
                    empty={filter === "offers" ? "No new offers right now. Stay online and they will appear here." : filter === "active" ? "Nothing in progress. Accept an offer to start." : "No active assignments. New collections appear here when a pharmacy assigns them to you."} />
                  {queueNext !== null && (
                    <button className="rider-button-secondary" disabled={busy} onClick={() => run(async () => {
                      const more = await getLive<RiderAssignment[]>(`${root}/assignments?limit=50&offset=${queueNext}`);
                      setItems((previous) => [...previous, ...more]);
                      setQueueNext(more.length === 50 ? queueNext + 50 : null);
                    })}>Load more assignments</button>
                  )}
                </>
              )}
              {page === "history" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Every confirmed handover</p>
                      <h1>Delivery history</h1>
                      <p className="rider-muted">Completed and declined assignments.</p>
                    </div>
                    <RefreshButton busy={busy} onClick={() => run(refresh)} />
                  </div>
                  {!historyLoaded && !error ? (
                    <RiderListSkeleton count={4} label="Loading delivery history" />
                  ) : (
                    <AssignmentList items={history.items} busy={busy} onSelect={(id) => navigate(`/rider/history/${id}`)} empty="No delivery history yet. Completed deliveries will appear here." />
                  )}
                  {history.nextOffset !== null && (
                    <button className="rider-button-secondary" disabled={busy} onClick={() => run(() => loadHistory(history.nextOffset!))}>Load more history</button>
                  )}
                </>
              )}
              {page === "profile" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Sabi ID</p>
                      <h1>My account</h1>
                      <p className="rider-muted">Your rider access is managed by Sabi operations.</p>
                    </div>
                  </div>
                  <section className="rider-card rider-account">
                    <div className="rider-actions">
                      <span className="rider-avatar" aria-hidden="true" style={{ width: 52, height: 52, fontSize: "1rem" }}>{initials}</span>
                      <div><h2>{displayName}</h2><span className="rider-chip is-success"><CheckCircle2 size={13} aria-hidden="true" />Activated delivery partner</span></div>
                    </div>
                    <dl>
                      <div><dt>Email address</dt><dd>{identity.user.email}</dd></div>
                      <div><dt>Rider reference</dt><dd>{overview?.profile.id}</dd></div>
                      <div><dt>Account access</dt><dd>Activated delivery partner</dd></div>
                    </dl>
                  </section>
                  <nav className="rider-quick-links" aria-label="Account shortcuts">
                    <Link className="rider-quick-link" to="/rider/earnings"><span className="rider-feature-icon is-accent"><Wallet size={20} aria-hidden="true" /></span><span>View earnings and payout account<small>Bank account and payouts</small></span></Link>
                    <Link className="rider-quick-link" to="/rider/application"><span className="rider-feature-icon"><ShieldCheck size={20} aria-hidden="true" /></span><span>Manage rider credentials<small>Licence, registration, insurance</small></span></Link>
                  </nav>
                  <section className="rider-card rider-stack-sm">
                    <h2>Security and changes</h2>
                    <div className="rider-actions">
                      <Link className="rider-button-secondary" to="/forgot-password"><KeyRound size={17} aria-hidden="true" />Reset your password</Link>
                      <a className="rider-text-link" href="mailto:support@sabihealth.org?subject=Rider%20account%20update">Request an account update <ArrowRight size={17} aria-hidden="true" /></a>
                    </div>
                  </section>
                </>
              )}
              {page === "support" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Here to help</p>
                      <h1>Rider support</h1>
                      <p className="rider-muted">A delay, the wrong address, or a code that won’t verify? Sabi operations can help.</p>
                    </div>
                  </div>
                  <ul className="rider-help-list">
                    <li><span className="rider-feature-icon"><ShieldCheck size={20} aria-hidden="true" /></span><div><strong>The code won’t verify</strong><p>Keep the package. Ask the person to check their latest code, then try again. Never mark a package delivered without a valid code.</p></div></li>
                    <li><span className="rider-feature-icon"><MapPin size={20} aria-hidden="true" /></span><div><strong>Wrong address or no one home</strong><p>Use “Report an issue” on the delivery page so operations can see it straight away.</p></div></li>
                    <li><span className="rider-feature-icon"><Package size={20} aria-hidden="true" /></span><div><strong>Package damaged or not ready</strong><p>Don’t collect a damaged package. Report it from the delivery page and wait for instructions.</p></div></li>
                  </ul>
                  <section className="rider-card rider-account">
                    <span className="rider-feature-icon"><Headphones aria-hidden="true" /></span>
                    <h2>Keep the package safe.</h2>
                    <p className="rider-muted">When contacting support, include the order reference — not patient records or handover codes.</p>
                    <div className="rider-actions">
                      <a className="rider-button" href="mailto:support@sabihealth.org?subject=Pharmacy%20delivery%20support">Email support <ArrowRight size={18} aria-hidden="true" /></a>
                      <span className="rider-caption"><PhoneCall size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> support@sabihealth.org</span>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
      <nav className="rider-bottom-nav" aria-label="Mobile rider navigation">
        {nav.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className={({ isActive: matched }) => isActive(path, matched) || (path === "/rider/profile" && page === "earnings") ? "is-active" : ""}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            {path === "/rider/offers" && !!overview?.stats.pending && <span className="rider-nav-count" aria-hidden="true">{overview.stats.pending}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return <button className="rider-button-ghost" disabled={busy} onClick={onClick}><RefreshCw size={16} aria-hidden="true" className={busy ? "rider-spin" : undefined} />{busy ? "Updating…" : "Refresh"}</button>;
}

function Brand() {
  return (
    <Link className="rider-brand" to="/rider/dashboard">
      <span><Bike size={22} aria-hidden="true" /></span>
      <div><strong>Sabi Health</strong><small>RIDER PORTAL</small></div>
    </Link>
  );
}

function AssignmentList({ items, busy, onSelect, empty }: { items: RiderAssignment[]; busy: boolean; onSelect: (id: string) => void; empty: string }) {
  if (!items.length)
    return (
      <div className="rider-card rider-empty">
        <ClipboardList size={35} aria-hidden="true" />
        <h2>Nothing waiting here.</h2>
        <p className="rider-muted">{empty}</p>
      </div>
    );
  return (
    <div className="rider-assignment-list">
      {items.map((item) => (
        <button key={item.id} className={`rider-card rider-assignment${item.assignmentStatus === "PENDING" ? " is-offer" : ""}`} disabled={busy} onClick={() => onSelect(item.id)}>
          <span className="rider-feature-icon"><Package size={22} aria-hidden="true" /></span>
          <span className="rider-assignment-info">
            <strong>{item.reference}</strong>
            <span>{item.pickup.name}</span>
            <small>{item.deliveredAt ? `Delivered ${riderDate(item.deliveredAt)}` : item.pickup.address}</small>
          </span>
          <span className="rider-assignment-side">
            <span className={`rider-status ${statusTone(item)}`}>{riderStatus(item)}</span>
            {item.earningOfferMinor != null && <strong className="rider-offer-price">You earn {naira(item.earningOfferMinor)}</strong>}
          </span>
        </button>
      ))}
    </div>
  );
}
