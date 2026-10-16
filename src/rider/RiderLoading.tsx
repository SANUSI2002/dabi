// Loading states for the rider area. Instead of a generic spinner or the clinical "Sabi OS" screen,
// riders see the shape of the page that is about to appear, so nothing jumps when it arrives.
// Self-contained styles (riderLoading.css) so the route-level loader works before rider.css loads.
import { Bike } from "lucide-react";
import "./riderLoading.css";

const AUTH_PATHS = ["/rider/login", "/rider/register", "/rider/join", "/rider/signup", "/rider/verify-email", "/rider/forgot-password"];
export const isRiderPath = (pathname: string) => pathname === "/rider" || pathname.startsWith("/rider/") || pathname.startsWith("/pharmacy/courier");

function Block({ w = "100%", h = 14, r = 8, className = "" }: { w?: number | string; h?: number; r?: number; className?: string }) {
  return <span aria-hidden="true" className={`rsk-block ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

function Mark({ label = "RIDER PORTAL" }: { label?: string }) {
  return (
    <span className="rsk-brand" aria-hidden="true">
      <span className="rsk-mark"><Bike size={20} /></span>
      <span><strong>Sabi Health</strong><small>{label}</small></span>
    </span>
  );
}

/** A list of delivery cards being fetched. */
export function RiderListSkeleton({ count = 3, label = "Loading deliveries" }: { count?: number; label?: string }) {
  return (
    <div className="rsk-list" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rsk-card rsk-row">
          <Block w={44} h={44} r={12} />
          <span className="rsk-grow"><Block w="45%" h={14} /><Block w="70%" h={11} /></span>
          <Block w={72} h={24} r={999} />
        </div>
      ))}
    </div>
  );
}

/** Three stat tiles and a panel, used while earnings load. */
export function RiderEarningsSkeleton() {
  return (
    <div className="rsk-stack" role="status" aria-label="Loading your earnings">
      <div className="rsk-stats">{[0, 1, 2].map((i) => <div key={i} className="rsk-card rsk-stack-sm"><Block w="60%" h={11} /><Block w="80%" h={22} /></div>)}</div>
      <div className="rsk-card rsk-stack-sm"><Block w="35%" h={16} /><Block w="90%" h={11} /><Block w={150} h={44} r={12} /></div>
      <div className="rsk-card rsk-stack-sm"><Block w="40%" h={16} />{[0, 1, 2].map((i) => <Block key={i} h={36} r={10} />)}</div>
    </div>
  );
}

/** The delivery page: progress steps, the action card and the two stops. */
export function RiderDeliverySkeleton() {
  return (
    <div className="rsk-stack" role="status" aria-label="Loading delivery">
      <Block w={140} h={14} />
      <span className="rsk-stack-sm"><Block w={90} h={11} /><Block w="65%" h={26} /></span>
      <div className="rsk-card rsk-steps">{[0, 1, 2, 3].map((i) => <span key={i} className="rsk-step"><Block w={32} h={32} r={999} /><Block w="70%" h={10} /></span>)}</div>
      <div className="rsk-grid">
        <div className="rsk-card rsk-stack-sm"><Block h={46} r={12} /><Block w="55%" h={18} /><Block w="85%" h={11} /><Block h={60} r={12} /><Block h={52} r={14} /></div>
        <div className="rsk-card rsk-stack-sm">{[0, 1].map((i) => <span key={i} className="rsk-row"><Block w={40} h={40} r={12} /><span className="rsk-grow"><Block w="30%" h={10} /><Block w="55%" h={15} /><Block w="80%" h={11} /></span></span>)}</div>
      </div>
    </div>
  );
}

function DashboardBody() {
  return (
    <>
      <span className="rsk-stack-sm"><Block w={130} h={11} /><Block w="55%" h={30} /><Block w="70%" h={13} /></span>
      <div className="rsk-card rsk-row"><span className="rsk-grow"><Block w="55%" h={18} /><Block w="85%" h={12} /></span><Block w={130} h={48} r={12} /></div>
      <div className="rsk-card rsk-stack-sm"><Block w={70} h={10} /><Block w="50%" h={18} /><Block w="80%" h={12} /><Block h={56} r={14} /></div>
      <div className="rsk-stats">{[0, 1, 2].map((i) => <div key={i} className="rsk-card rsk-stack-sm"><Block w={36} h={36} r={10} /><Block w="60%" h={11} /><Block w="35%" h={22} /></div>)}</div>
    </>
  );
}

/** The whole signed-in workspace (top bar, sidebar on desktop, bottom bar on phones). */
export function RiderWorkspaceSkeleton({ page = "dashboard" }: { page?: "dashboard" | "list" | "delivery" | "earnings" | "account" }) {
  return (
    <div className="rsk-root rsk-workspace" role="status" aria-label="Opening your rider portal">
      <div className="rsk-progress" aria-hidden="true"><span /></div>
      <aside className="rsk-sidebar" aria-hidden="true">
        <Mark />
        <span className="rsk-stack-sm" style={{ marginTop: 18 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Block key={i} h={40} r={12} className={i === 0 ? "rsk-strong" : ""} />)}</span>
      </aside>
      <div className="rsk-main" aria-hidden="true">
        <div className="rsk-topbar"><span className="rsk-mobile-only"><span className="rsk-mark"><Bike size={18} /></span></span><Block w={120} h={16} /><span className="rsk-grow" /><Block w={40} h={40} r={999} /></div>
        <div className="rsk-content rsk-stack">
          {page === "dashboard" ? <DashboardBody />
            : page === "delivery" ? <RiderDeliverySkeleton />
              : page === "earnings" ? <><span className="rsk-stack-sm"><Block w={150} h={11} /><Block w="45%" h={28} /></span><RiderEarningsSkeleton /></>
                : page === "account" ? <><span className="rsk-stack-sm"><Block w={70} h={11} /><Block w="40%" h={28} /></span><div className="rsk-card rsk-stack-sm"><Block w={52} h={52} r={999} />{[0, 1, 2].map((i) => <Block key={i} h={48} r={10} />)}</div></>
                  : <><span className="rsk-stack-sm"><Block w={110} h={11} /><Block w="45%" h={28} /><Block w="70%" h={13} /></span><Block w={280} h={44} r={14} /><RiderListSkeleton count={4} /></>}
        </div>
      </div>
      <nav className="rsk-bottom" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i}><Block w={22} h={22} r={7} className={i === 0 ? "rsk-strong" : ""} /><Block w={44} h={8} /></span>)}</nav>
    </div>
  );
}

/** Sign-in / sign-up shell with the form still loading. */
export function RiderAuthSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="rsk-root rsk-auth" role="status" aria-label="Loading">
      <div className="rsk-progress" aria-hidden="true"><span /></div>
      <div className="rsk-auth-form" aria-hidden="true">
        <Mark label="RIDER NETWORK" />
        <span className="rsk-stack-sm" style={{ marginTop: 28 }}><Block w={120} h={11} /><Block w="70%" h={32} /><Block w="85%" h={13} /></span>
        <RiderFormSkeleton fields={fields} />
      </div>
      <div className="rsk-auth-story" aria-hidden="true" />
    </div>
  );
}

/** Just the fields, for use inside an already-rendered layout. */
export function RiderFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <span className="rsk-stack" style={{ marginTop: 24 }} role="status" aria-label="Loading">
      {Array.from({ length: fields }, (_, i) => <span key={i} className="rsk-stack-sm"><Block w={110} h={12} /><Block h={50} r={12} /></span>)}
      <Block h={56} r={14} className="rsk-strong" />
    </span>
  );
}

/** A plain page with a header, used while the rider application loads. */
export function RiderApplicationSkeleton() {
  return (
    <div className="rsk-root rsk-application" role="status" aria-label="Loading your application">
      <div className="rsk-progress" aria-hidden="true"><span /></div>
      <div className="rsk-app-header" aria-hidden="true"><Mark label="RIDER APPLICATION" /><Block w={90} h={36} r={10} /></div>
      <div className="rsk-app-main rsk-stack" aria-hidden="true">
        <div className="rsk-card rsk-stack-sm"><Block w={140} h={11} /><Block w="45%" h={28} /><Block w="85%" h={13} /></div>
        <div className="rsk-card rsk-stack-sm">{[0, 1, 2, 3].map((i) => <span key={i} className="rsk-row"><Block w={32} h={32} r={999} /><span className="rsk-grow"><Block w="40%" h={14} /><Block w="25%" h={10} /></span></span>)}</div>
        {[0, 1].map((i) => <div key={i} className="rsk-card rsk-stack-sm"><span className="rsk-row"><Block w={40} h={40} r={12} /><span className="rsk-grow"><Block w="45%" h={14} /><Block w="35%" h={10} /></span><Block w={90} h={24} r={999} /></span><Block h={70} r={12} /></div>)}
      </div>
    </div>
  );
}

/** Route-level fallback while the rider code itself downloads. */
export function RiderRouteLoader({ pathname }: { pathname: string }) {
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <RiderAuthSkeleton />;
  if (pathname.startsWith("/rider/application")) return <RiderApplicationSkeleton />;
  return <RiderWorkspaceSkeleton page={riderSkeletonPage(pathname)} />;
}

export function riderSkeletonPage(pathname: string): "dashboard" | "list" | "delivery" | "earnings" | "account" {
  if (pathname.startsWith("/rider/delivery/") || /^\/rider\/history\/[^/]+/.test(pathname)) return "delivery";
  if (pathname.startsWith("/rider/offers") || pathname.startsWith("/rider/history")) return "list";
  if (pathname.startsWith("/rider/earnings")) return "earnings";
  if (pathname.startsWith("/rider/profile") || pathname.startsWith("/rider/support")) return "account";
  return "dashboard";
}
