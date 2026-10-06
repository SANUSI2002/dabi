import React from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, Video } from "lucide-react";
import { useApiData } from "../../../api/useApiData";
import { listUpcomingDoctorAppointments } from "../../../api/doctorsApi";
import { ErrorState, StatusBadge } from "../../../../../shared-portal/design-system/ui.jsx";

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function whenLabel(a) {
  const start = new Date(a.startsAt), now = new Date();
  const minutes = Math.round((start - now) / 60000);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (minutes <= 0) return `Started at ${clock(a.startsAt)}`;
  if (minutes < 60) return `Starts in ${minutes} min · ${clock(a.startsAt)}`;
  if (start.toDateString() === now.toDateString()) return `Today at ${clock(a.startsAt)}`;
  if (start.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${clock(a.startsAt)}`;
  return `${start.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })} at ${clock(a.startsAt)}`;
}

async function loadNext() {
  const items = await listUpcomingDoctorAppointments();
  return items.filter((a) => a.upcoming).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
}

/** The first thing a patient sees: their next consultation and the one action it needs right now. */
export function NextAppointmentCard() {
  const { data: next, error, loading, reload } = useApiData(loadNext, []);
  if (loading && next === undefined) return <section className="sx-card sabi-next-card" aria-busy="true" aria-label="Next appointment"><div className="sx-skeleton" style={{ height: 22, width: "40%" }} /><div className="sx-skeleton" style={{ height: 16, width: "65%", marginTop: 12 }} /></section>;
  if (error) return <ErrorState title="We couldn't load your next appointment" message={error.message} onRetry={reload} />;
  if (!next) return <section className="sx-card sabi-next-card" aria-labelledby="next-apt-heading">
    <div className="sabi-next-main"><span className="sx-eyebrow">Next appointment</span><h2 id="next-apt-heading" className="sx-card-title">Nothing booked yet</h2><p className="sx-card-subtitle">Find a verified doctor or wellness professional and choose a time that suits you.</p></div>
    <div className="sx-actions"><Link className="sx-btn sx-btn-primary" to="/doctor"><CalendarPlus size={16} aria-hidden="true" /> Find a doctor</Link></div>
  </section>;
  const pending = next.status === "REQUESTED";
  const canJoin = next.status === "CONFIRMED" && next.consultationType === "VIRTUAL";
  return <section className={`sx-card sabi-next-card`} aria-labelledby="next-apt-heading">
    <span className="sx-avatar" aria-hidden="true">{next.initials}</span>
    <div className="sabi-next-main">
      <span className="sx-eyebrow">Next appointment</span>
      <h2 id="next-apt-heading" className="sx-card-title">{next.typeLabel} with {next.doctor.name}</h2>
      <p className="sx-card-subtitle">{whenLabel(next)}{next.forName ? ` · for ${next.forName}` : ""}</p>
      <p className="sabi-next-hint">{pending ? `${next.doctor.name} hasn't confirmed yet. We'll let you know when they do.` : canJoin ? "Join from your appointments when it is time." : "See you at the practice."}</p>
    </div>
    <div className="sabi-next-side">
      <StatusBadge status={next.status} />
      {canJoin ? <Link className="sx-btn sx-btn-primary" to="/appointments"><Video size={16} aria-hidden="true" /> Join video consultation</Link>
        : <Link className="sx-btn sx-btn-secondary" to="/appointments">View appointment</Link>}
    </div>
  </section>;
}

export default NextAppointmentCard;
