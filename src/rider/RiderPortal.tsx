import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  Headphones,
  HeartPulse,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiConfigured } from "@/config/runtime";
import {
  liveSignIn,
  liveSignOut,
  restoreLiveIdentity,
  type LiveIdentity,
} from "@/identity/liveIdentity";
import { IdleSignOutNotice } from "@/identity/IdleSessionGuard";
import { SABI_HEALTH_URL } from "@/public/ecosystemLinks";
import { getLive, writeLive } from "@/pharmacy/liveApi";
import RiderDelivery from "./RiderDelivery";
import {
  riderDate,
  riderStatus,
  type RiderAssignment,
  type RiderHistory,
  type RiderOverview,
} from "./types";
import "./rider.css";

const nav = [
  { path: "/rider/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/rider/offers", label: "Deliveries", icon: Bike },
  { path: "/rider/history", label: "History", icon: History },
  { path: "/rider/profile", label: "My account", icon: UserRound },
  { path: "/rider/support", label: "Support", icon: Headphones },
];
const root = "/api/v1/delivery";
export default function RiderPortal() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const deliveryRoute = useMatch("/rider/delivery/:assignmentId");
  const historyRoute = useMatch("/rider/history/:assignmentId");
  const assignmentId =
    deliveryRoute?.params.assignmentId || historyRoute?.params.assignmentId;
  const joined = pathname === "/rider/join" || pathname === "/rider/signup";
  const page = pathname.startsWith("/rider/history")
    ? "history"
    : pathname === "/rider/profile"
      ? "profile"
      : pathname === "/rider/support"
        ? "support"
        : pathname === "/rider/offers" || deliveryRoute
          ? "offers"
          : "dashboard";
  const gate = useRef(false);
  const currentDetail = useRef(assignmentId);
  useEffect(() => {
    currentDetail.current = assignmentId;
  }, [assignmentId]);
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [overview, setOverview] = useState<RiderOverview | null>(null);
  const [restoring, setRestoring] = useState(apiConfigured);
  const [items, setItems] = useState<RiderAssignment[]>([]);
  const [detail, setSelected] = useState<RiderAssignment | null>(null);
  const selected = identity && detail?.id === assignmentId ? detail : null;
  const [history, setHistory] = useState<RiderHistory>({
    items: [],
    nextOffset: null,
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [queueNext, setQueueNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false);
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
        if (!current.user.roles.includes("DELIVERY_PARTNER"))
          throw new Error(
            "Sabi operations must activate your delivery partner account.",
          );
        await load();
        if (active) setIdentity(current);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  async function run(work: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Delivery service unavailable. Please retry.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!identity || !assignmentId) return;
    let active = true;
    getLive<RiderAssignment>(
      `${root}/assignments/${encodeURIComponent(assignmentId)}`,
    )
      .then((item) => {
        if (active) {
          setSelected(item);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [assignmentId, identity]);
  const loadHistory = useCallback(async (offset = 0) => {
    const result = await getLive<RiderHistory>(
      `${root}/history?limit=20&offset=${offset}`,
    );
    setHistory((previous) => ({
      items: offset ? [...previous.items, ...result.items] : result.items,
      nextOffset: result.nextOffset,
    }));
    setHistoryLoaded(true);
  }, []);
  useEffect(() => {
    if (!identity || page !== "history") return;
    let active = true;
    getLive<RiderHistory>(`${root}/history?limit=20&offset=0`)
      .then((result) => {
        if (!active) return;
        setHistory(result);
        setHistoryLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [identity, page]);
  async function action(kind: string, body: Record<string, unknown> = {}) {
    if (!selected) return;
    await run(async () => {
      const confirmed = await writeLive<
        Pick<RiderAssignment, "assignmentStatus" | "fulfilmentStatus">
      >(`${root}/assignments/${selected.id}/${kind}`, body);
      if (currentDetail.current === selected.id)
        setSelected({
          ...selected,
          ...confirmed,
          ...(confirmed.assignmentStatus === "COMPLETED" ||
          confirmed.assignmentStatus === "REJECTED"
            ? { recipient: undefined }
            : {}),
        });
      setMessage(
        kind === "accept"
          ? "Collection accepted."
          : kind === "reject"
            ? "Assignment declined."
            : body.status === "PICKED_UP"
              ? "Package collected successfully."
              : body.status === "DELIVERED"
                ? "Package delivered successfully."
                : "Delivery started successfully.",
      );
      try {
        const fresh = await getLive<RiderAssignment>(
          `${root}/assignments/${selected.id}`,
        );
        if (currentDetail.current === selected.id) setSelected(fresh);
        await load();
        if (page === "history") await loadHistory();
      } catch {
        throw new Error(
          "Handover saved. Could not refresh delivery details; use Refresh.",
        );
      }
    });
  }
  async function refresh() {
    await load();
    if (page === "history") await loadHistory();
    if (assignmentId) {
      const fresh = await getLive<RiderAssignment>(
        `${root}/assignments/${encodeURIComponent(assignmentId)}`,
      );
      if (currentDetail.current === assignmentId) setSelected(fresh);
    }
  }
  async function signOut() {
    await run(async () => {
      await liveSignOut();
      setIdentity(null);
      setOverview(null);
      setItems([]);
      setHistory({ items: [], nextOffset: null });
      setSelected(null);
      navigate("/rider/login", { replace: true });
    });
  }
  if (joined)
    return (
      <div className="sabi-rider rider-auth">
        <div className="rider-auth-form-panel">
          <Brand />
          <div className="rider-auth-inner">
            <p className="rider-eyebrow">Deliver with Sabi</p>
            <h1>Care doesn't end at the pharmacy.</h1>
            <p className="rider-muted">
              Join the delivery network connecting partner pharmacies with
              patients. Sabi operations reviews and activates rider access
              before assignments are shared.
            </p>
            <div className="rider-card rider-join-note">
              <h2>Speak to our operations team</h2>
              <p>
                Send your name, operating area and contact number. Do not send
                identity documents or passwords by email.
              </p>
              <a
                className="rider-button"
                href="mailto:support@sabihealth.org?subject=Sabi%20rider%20network%20enquiry"
              >
                Contact Sabi operations{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <Link className="rider-text-link" to="/rider/login">
              Already activated? Sign in{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a className="rider-text-link" href={SABI_HEALTH_URL}>
              Back to Sabi Health
            </a>
          </div>
        </div>
        <AuthStory />
      </div>
    );
  if (!identity)
    return (
      <div className="sabi-rider rider-auth">
        <div className="rider-auth-form-panel">
          <Brand />
          <div className="rider-auth-inner">
            <p className="rider-eyebrow">Your next delivery starts here</p>
            <h1>Welcome back.</h1>
            <p className="rider-muted">
              Sign in to your Sabi rider account. Every collection and delivery,
              confirmed.
            </p>
            <IdleSignOutNotice />
            {error && (
              <p role="alert" className="rider-alert rider-alert-error">
                {error}
              </p>
            )}
            {restoring ? (
              <div role="status" className="rider-loading">
                <LoaderCircle aria-hidden="true" /> Restoring your session…
              </div>
            ) : !apiConfigured ? (
              <div className="rider-alert">
                <h2>API connection required</h2>
                <p>
                  This local-storage preview cannot verify real collection or
                  delivery codes. Connect the Sabi API to sign in.
                </p>
              </div>
            ) : (
              <form
                className="rider-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const result = await liveSignIn(email.trim(), password);
                    setPassword("");
                    if (result.kind === "MFA") {
                      navigate("/mfa?context=courier");
                      return;
                    }
                    if (
                      !result.identity.user.roles.includes("DELIVERY_PARTNER")
                    )
                      throw new Error(
                        "Sabi operations must activate your delivery partner account.",
                      );
                    await load();
                    setIdentity(result.identity);
                    navigate("/rider/dashboard", { replace: true });
                  });
                }}
              >
                <label htmlFor="rider-email">Email address</label>
                <input
                  className="rider-input"
                  id="rider-email"
                  type="email"
                  autoComplete="username"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <label htmlFor="rider-password">Password</label>
                <div className="rider-password">
                  <input
                    className="rider-input"
                    id="rider-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rider-eye"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <Link
                  className="rider-text-link rider-forgot"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
                <button className="rider-button" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            )}
            <p className="rider-auth-footer">
              New to the rider network?{" "}
              <Link to="/rider/join">Join the network</Link>
            </p>
            <a className="rider-text-link" href={SABI_HEALTH_URL}>
              Back to Sabi Health
            </a>
          </div>
        </div>
        <AuthStory />
      </div>
    );
  const displayName =
    overview?.profile.displayName || identity.user.fullName || "Rider";
  const title =
    page === "history"
      ? "Delivery history"
      : page === "profile"
        ? "My account"
        : page === "support"
          ? "Rider support"
          : page === "offers"
            ? "Your deliveries"
            : "Dashboard";
  const activeItems = items.filter(
    (item) => item.assignmentStatus === "ACCEPTED",
  );
  const pendingItems = items.filter(
    (item) => item.assignmentStatus === "PENDING",
  );
  return (
    <div className="sabi-rider rider-workspace">
      <a className="rider-skip" href="#rider-main">
        Skip to content
      </a>
      <aside className="rider-sidebar">
        <Brand />
        <p className="rider-nav-caption">Your workspace</p>
        <nav aria-label="Rider navigation">
          {nav.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `rider-nav-link${isActive || (path === "/rider/offers" && deliveryRoute) ? " is-active" : ""}`
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
              {path === "/rider/offers" && !!overview?.stats.pending && (
                <span className="rider-nav-count">
                  {overview.stats.pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="rider-sidebar-bottom">
          <div className="rider-sidebar-note">
            <ShieldCheck size={21} aria-hidden="true" />
            <p>
              Every handover.
              <br />
              <strong>Verified by a code.</strong>
            </p>
          </div>
          <button className="rider-nav-link" disabled={busy} onClick={signOut}>
            <LogOut size={20} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="rider-workspace-main">
        <header className="rider-topbar">
          <span className="rider-topbar-label">
            Rider portal <ChevronRight size={16} aria-hidden="true" />
            {title}
          </span>
          <div className="rider-topbar-actions">
            <span className="rider-status">
              <CheckCircle2 size={15} aria-hidden="true" /> Activated rider
            </span>
            <Link
              className="rider-avatar"
              to="/rider/profile"
              aria-label="My rider account"
            >
              {displayName
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)}
            </Link>
            <button
              className="rider-mobile-signout"
              disabled={busy}
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main id="rider-main" className="rider-content">
          <div className="rider-refresh-row">
            <p className="rider-caption">Connected to Sabi Pharmacy</p>
            <button
              className="rider-button-secondary rider-refresh"
              disabled={busy}
              onClick={() => run(refresh)}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {busy ? "Updating…" : "Refresh"}
            </button>
          </div>
          {message && (
            <p role="status" className="rider-alert rider-alert-success">
              {message}
            </p>
          )}
          {error && !selected && (
            <p role="alert" className="rider-alert rider-alert-error">
              {error}
            </p>
          )}
          {assignmentId ? (
            selected ? (
              <RiderDelivery
                key={`${selected.id}:${selected.fulfilmentStatus}`}
                assignment={selected}
                busy={busy}
                error={error}
                onAction={action}
              />
            ) : error ? (
              <Link className="rider-text-link" to="/rider/offers">
                Back to deliveries
              </Link>
            ) : (
              <p role="status" className="rider-loading">
                <LoaderCircle aria-hidden="true" /> Loading delivery…
              </p>
            )
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Your day, connected</p>
                      <h1>Hello, {displayName.split(" ")[0]}.</h1>
                      <p className="rider-muted">
                        A clear view of every package in your care.
                      </p>
                    </div>
                    <span className="rider-caption">
                      {new Date().toLocaleDateString("en-NG", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                  <section className="rider-hero">
                    <div>
                      <p className="rider-eyebrow">The last mile of care</p>
                      <h2>
                        Deliver health.
                        <br />
                        <span>Make the connection.</span>
                      </h2>
                      <p>
                        Collect from the pharmacy. Confirm with a code. Deliver
                        to the patient with confidence.
                      </p>
                      <Link className="rider-button" to="/rider/offers">
                        View your deliveries{" "}
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </div>
                    <div className="rider-hero-art" aria-hidden="true">
                      <div className="rider-route-orbit" />
                      <div className="rider-hero-bike">
                        <Bike size={100} strokeWidth={1.3} />
                      </div>
                      <span className="rider-hero-label rider-hero-label-start">
                        <Package size={20} />
                        Pharmacy collection
                      </span>
                      <span className="rider-hero-label rider-hero-label-end">
                        <CheckCircle2 size={20} />
                        Patient delivery
                      </span>
                    </div>
                  </section>
                  <div className="rider-stats">
                    {[
                      [Package, "New offers", overview?.stats.pending],
                      [Bike, "Active deliveries", overview?.stats.active],
                      [
                        CheckCircle2,
                        "Completed deliveries",
                        overview?.stats.completed,
                      ],
                    ].map(([Icon, label, count]) => {
                      const Glyph = Icon as typeof Bike;
                      return (
                        <article
                          key={String(label)}
                          className="rider-card rider-stat"
                        >
                          <span className="rider-feature-icon">
                            <Glyph size={22} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="rider-muted">{String(label)}</p>
                            <strong>
                              {typeof count === "number"
                                ? count.toLocaleString("en-NG")
                                : "—"}
                            </strong>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <section>
                    <div className="rider-section-heading">
                      <h2>In your care</h2>
                      <Link className="rider-text-link" to="/rider/offers">
                        View all <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    </div>
                    <AssignmentList
                      items={activeItems.slice(0, 3)}
                      busy={busy}
                      onSelect={(id) => navigate(`/rider/delivery/${id}`)}
                      empty="No active assignments. Accepted deliveries will appear here."
                    />
                    {pendingItems.length > 0 && (
                      <Link className="rider-offer-nudge" to="/rider/offers">
                        <Package size={20} aria-hidden="true" />
                        <span>
                          {overview?.stats.pending || pendingItems.length} new
                          collection offers are waiting for you.
                        </span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    )}
                  </section>
                </>
              )}
              {page === "offers" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Assigned to you</p>
                      <h1>Your deliveries</h1>
                      <p className="rider-muted">
                        Accept a collection, then verify each handover with its
                        own code.
                      </p>
                    </div>
                  </div>
                  <AssignmentList
                    items={items}
                    busy={busy}
                    onSelect={(id) => navigate(`/rider/delivery/${id}`)}
                    empty="No active assignments. New collections appear here when a pharmacy assigns them to you."
                  />
                  {queueNext !== null && (
                    <button
                      className="rider-button-secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const more = await getLive<RiderAssignment[]>(
                            `${root}/assignments?limit=50&offset=${queueNext}`,
                          );
                          setItems((previous) => [...previous, ...more]);
                          setQueueNext(
                            more.length === 50 ? queueNext + 50 : null,
                          );
                        })
                      }
                    >
                      Load more assignments
                    </button>
                  )}
                </>
              )}
              {page === "history" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Every confirmed handover</p>
                      <h1>Delivery history</h1>
                      <p className="rider-muted">
                        Completed and declined assignments, recorded by the
                        server.
                      </p>
                    </div>
                  </div>
                  {!historyLoaded && !error ? (
                    <p role="status" className="rider-loading">
                      Loading delivery history…
                    </p>
                  ) : (
                    <AssignmentList
                      items={history.items}
                      busy={busy}
                      onSelect={(id) => navigate(`/rider/history/${id}`)}
                      empty="No delivery history yet. Completed deliveries will appear here."
                    />
                  )}
                  {history.nextOffset !== null && (
                    <button
                      className="rider-button-secondary"
                      disabled={busy}
                      onClick={() =>
                        run(() => loadHistory(history.nextOffset!))
                      }
                    >
                      Load more history
                    </button>
                  )}
                </>
              )}
              {page === "profile" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Sabi ID</p>
                      <h1>My account</h1>
                      <p className="rider-muted">
                        Your rider access is managed by Sabi operations.
                      </p>
                    </div>
                  </div>
                  <section className="rider-card rider-account">
                    <span className="rider-feature-icon">
                      <UserRound aria-hidden="true" />
                    </span>
                    <h2>{displayName}</h2>
                    <dl>
                      <div>
                        <dt>Email address</dt>
                        <dd>{identity.user.email}</dd>
                      </div>
                      <div>
                        <dt>Rider reference</dt>
                        <dd>{overview?.profile.id}</dd>
                      </div>
                      <div>
                        <dt>Account access</dt>
                        <dd>Activated delivery partner</dd>
                      </div>
                    </dl>
                    <Link
                      className="rider-button-secondary"
                      to="/forgot-password"
                    >
                      Reset your password
                    </Link>
                    <a
                      className="rider-text-link"
                      href="mailto:support@sabihealth.org?subject=Rider%20account%20update"
                    >
                      Request an account update{" "}
                      <ArrowRight size={17} aria-hidden="true" />
                    </a>
                  </section>
                </>
              )}
              {page === "support" && (
                <>
                  <div className="rider-page-heading">
                    <div>
                      <p className="rider-eyebrow">Here to help</p>
                      <h1>Rider support</h1>
                      <p className="rider-muted">
                        A delay, the wrong address, or a code that won't verify?
                        Contact Sabi operations.
                      </p>
                    </div>
                  </div>
                  <section className="rider-card rider-account">
                    <span className="rider-feature-icon">
                      <Headphones aria-hidden="true" />
                    </span>
                    <h2>Keep the package safe.</h2>
                    <p className="rider-muted">
                      Do not mark a package delivered without the recipient's
                      valid code. For a problem at pickup or delivery, include
                      the order reference when contacting support, not patient
                      records or handover codes.
                    </p>
                    <a
                      className="rider-button"
                      href="mailto:support@sabihealth.org?subject=Pharmacy%20delivery%20support"
                    >
                      Email support <ArrowRight size={18} aria-hidden="true" />
                    </a>
                    <p className="rider-caption">support@sabihealth.org</p>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
      <nav className="rider-bottom-nav" aria-label="Mobile rider navigation">
        {nav.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              isActive || (path === "/rider/offers" && deliveryRoute)
                ? "is-active"
                : ""
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function Brand() {
  return (
    <Link className="rider-brand" to="/rider/dashboard">
      <span>
        <Bike size={25} aria-hidden="true" />
      </span>
      <div>
        <strong>Sabi Health</strong>
        <small>RIDER PORTAL</small>
      </div>
    </Link>
  );
}
function AuthStory() {
  return (
    <aside className="rider-auth-story">
      <div className="rider-story-top">
        <HeartPulse size={25} aria-hidden="true" />
        <span>Care, connected.</span>
      </div>
      <div>
        <span className="rider-story-bike">
          <Bike size={100} strokeWidth={1.25} aria-hidden="true" />
        </span>
        <p className="rider-eyebrow">Sabi Health rider network</p>
        <h2>
          Deliver health.
          <br />
          <span>Change someone's day.</span>
        </h2>
        <p>
          From a trusted pharmacy to the person who needs it. You're the
          connection that makes it happen.
        </p>
        <div className="rider-story-proof">
          <ShieldCheck size={23} aria-hidden="true" />
          <span>
            One code at collection.
            <br />
            Another at delivery.
          </span>
        </div>
      </div>
      <p className="rider-caption">Built around safer handovers.</p>
    </aside>
  );
}
function AssignmentList({
  items,
  busy,
  onSelect,
  empty,
}: {
  items: RiderAssignment[];
  busy: boolean;
  onSelect: (id: string) => void;
  empty: string;
}) {
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
        <button
          key={item.id}
          className="rider-card rider-assignment"
          disabled={busy}
          onClick={() => onSelect(item.id)}
        >
          <span className="rider-feature-icon">
            <Package size={22} aria-hidden="true" />
          </span>
          <span className="rider-assignment-info">
            <strong>{item.reference}</strong>
            <span>{item.pickup.name}</span>
            <small>
              {item.deliveredAt
                ? `Delivered ${riderDate(item.deliveredAt)}`
                : item.pickup.address}
            </small>
          </span>
          <span className="rider-status">{riderStatus(item)}</span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
