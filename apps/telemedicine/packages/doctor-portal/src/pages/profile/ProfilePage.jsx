import React, { useRef, useState, useSyncExternalStore } from "react";
import {
  Award,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  ClipboardCheck,
  Eye,
  GraduationCap,
  Hospital,
  MoreVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import {
  getProfile,
  subscribeToProfile,
  updateProfile,
} from "../../store/profileStore";
import "./ProfilePage.css";

/* ─── Formatting ─────────────────────────────────────────────── */
const money = new Intl.NumberFormat("en-NG");
const blankLocation = { name: "", address: "", days: "", hours: "", type: "clinic" };

/* ─── Shared sub-components ─────────────────────────────────── */

/** Labelled input field */
function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="dpm-field">
      <span>{label}</span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Modal dialog with header + body + action row */
function Dialog({ title, children, onClose, onSave, saveLabel = "Save changes", danger }) {
  return (
    <div
      className="dpm-dialog-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dpm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dpm-dialog-head">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        <div className="dpm-dialog-body">{children}</div>
        <div className="dpm-dialog-actions">
          <button className="dpm-button dpm-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`dpm-button ${danger ? "dpm-button-danger" : "dpm-button-primary"}`}
            onClick={onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Card section title with optional action button */
function SectionTitle({ children, action, onAction }) {
  return (
    <div className="dpm-section-title">
      <h2>{children}</h2>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

/** Specialty / topic chip with remove button */
function Tag({ children, primary, onRemove }) {
  return (
    <span className={`dpm-tag${primary ? " dpm-tag-primary" : ""}`}>
      {children}
      <button onClick={onRemove} aria-label={`Remove ${children}`}>
        <X size={15} />
      </button>
    </span>
  );
}

/** Platform stats number cell */
function Stat({ number, text }) {
  return (
    <div className="dpm-stat">
      <strong>{number}</strong>
      <span>{text}</span>
    </div>
  );
}

/* ─── Modal: Edit Consultation Fees ─────────────────────────── */
function FeeDialog({ fees, onClose, onSave }) {
  const [values, setValues] = useState(fees);

  function update(i, key, value) {
    setValues(
      values.map((fee, index) =>
        index === i
          ? { ...fee, [key]: key === "amount" ? Math.max(0, Number(value)) : value }
          : fee
      )
    );
  }

  return (
    <Dialog title="Edit consultation fees" onClose={onClose} onSave={() => onSave(values)}>
      <div className="dpm-modal-fields">
        {values.map((fee, i) => (
          <React.Fragment key={fee.id}>
            <Field
              label={`${fee.type} duration`}
              value={fee.duration}
              onChange={(v) => update(i, "duration", v)}
            />
            <Field
              label={`${fee.type} fee (₦)`}
              type="number"
              value={fee.amount}
              onChange={(v) => update(i, "amount", v)}
            />
          </React.Fragment>
        ))}
      </div>
    </Dialog>
  );
}

/* ─── Modal: Add / Edit Location ────────────────────────────── */
function LocationDialog({ location, onClose, onSave }) {
  const [form, setForm] = useState(location);
  const change = (key, value) => setForm({ ...form, [key]: value });

  return (
    <Dialog
      title={location.name ? "Edit location" : "Add clinical location"}
      onClose={onClose}
      onSave={() => form.name.trim() && form.address.trim() && onSave(form)}
    >
      <div className="dpm-modal-fields">
        <Field label="Location name"  value={form.name}    onChange={(v) => change("name",    v)} />
        <Field label="Address"        value={form.address} onChange={(v) => change("address", v)} />
        <Field label="Working days"   value={form.days}    onChange={(v) => change("days",    v)} />
        <Field label="Working hours"  value={form.hours}   onChange={(v) => change("hours",   v)} />
        <label className="dpm-field">
          <span>Location type</span>
          <select value={form.type} onChange={(e) => change("type", e.target.value)}>
            <option value="clinic">Private clinic</option>
            <option value="hospital">Medical center / hospital</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ProfilePage() {
  const profile = useSyncExternalStore(subscribeToProfile, getProfile, getProfile);

  const [draft,  setDraft]  = useState(profile);
  const [modal,  setModal]  = useState(null);
  const [menu,   setMenu]   = useState(null);
  const [notice, setNotice] = useState("");

  const photoInput = useRef(null);

  /* Helpers */
  const set = (key, value) => setDraft((cur) => ({ ...cur, [key]: value }));
  const identity = draft.identity;
  const updateIdentity = (key, value) => set("identity", { ...identity, [key]: value });

  function save() {
    updateProfile(draft);
    setNotice("Profile changes saved locally.");
    setTimeout(() => setNotice(""), 2500);
  }

  function addTag(group) {
    const label = window.prompt(
      group === "primary" ? "Primary specialty" : "Topic or condition"
    );
    if (label?.trim()) {
      set("specialties", {
        ...draft.specialties,
        [group]: [...draft.specialties[group], label.trim()],
      });
    }
  }

  function removeTag(group, label) {
    set("specialties", {
      ...draft.specialties,
      [group]: draft.specialties[group].filter((item) => item !== label),
    });
  }

  function photoChanged(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateIdentity("photo", reader.result);
    reader.readAsDataURL(file);
  }

  function openLocation(location, index) {
    setModal({ kind: "location", location, index });
  }

  /* Close location menu when clicking outside */
  function handlePageClick() {
    if (menu !== null) setMenu(null);
  }

  /* Credential icon mapping */
  function credentialIcon(icon) {
    if (icon === "degree")  return <GraduationCap size={22} />;
    if (icon === "award")   return <Award size={22} />;
    return <ClipboardCheck size={22} />;
  }

  return (
    <PortalLayout
      topbarProps={{ title: "Profile Management", profileMode: true, notificationCount: 1 }}
    >
      <PageTransition className="dpm-page" onClick={handlePageClick}>

        {/* ── Save notice ─────────────────────────────────────── */}
        {notice && (
          <div className="dpm-notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            A. PUBLIC VISIBILITY BAR
        ══════════════════════════════════════════════════════ */}
        <section className="dpm-card dpm-visibility">
          <div className="dpm-visibility-info">
            <Eye size={24} aria-hidden="true" />
            <span>Public Visibility</span>
            <button
              className={`dpm-toggle${draft.visibility ? " is-on" : ""}`}
              onClick={() => set("visibility", !draft.visibility)}
              role="switch"
              aria-checked={draft.visibility}
              aria-label="Toggle public visibility"
            >
              <i />
            </button>
            <em className={draft.visibility ? "" : "is-off"}>
              {draft.visibility ? "Live in Directory" : "Hidden from Directory"}
            </em>
          </div>
          <div className="dpm-actions">
            <button
              className="dpm-button dpm-button-secondary"
              onClick={() => setModal("preview")}
            >
              Preview Public Profile
            </button>
            <button className="dpm-button dpm-button-primary" onClick={save}>
              Save Changes
            </button>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            MAIN GRID  (left: main column | right: side column)
        ══════════════════════════════════════════════════════ */}
        <div className="dpm-grid">

          {/* ── LEFT / MAIN COLUMN ──────────────────────────── */}
          <main className="dpm-main-column">

            {/* B. DOCTOR INFORMATION */}
            <section className="dpm-card dpm-identity">
              {/* Profile photo */}
              <div className="dpm-photo-wrap">
                <img src={identity.photo} alt={`${identity.name} profile photo`} />
                <button
                  onClick={() => photoInput.current.click()}
                  aria-label="Change profile photo"
                >
                  <Camera size={20} />
                </button>
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  onChange={photoChanged}
                  aria-hidden="true"
                />
              </div>

              {/* Identity details */}
              <div className="dpm-identity-content">
                <div className="dpm-name">
                  <h1>{identity.name}</h1>
                  {identity.verified && (
                    <span className="dpm-verified-badge">
                      <BadgeCheck size={17} />
                      MDCN Verified
                    </span>
                  )}
                </div>
                <p className="dpm-identity-subtitle">{identity.professionalTitle}</p>
                <div className="dpm-identity-fields">
                  <Field
                    label="Professional Title"
                    value={identity.professionalTitle}
                    onChange={(v) => updateIdentity("professionalTitle", v)}
                  />
                  <Field
                    label="Languages Spoken"
                    value={identity.languages}
                    onChange={(v) => updateIdentity("languages", v)}
                  />
                </div>
              </div>
            </section>

            {/* D. PROFESSIONAL BIO */}
            <section className="dpm-card dpm-section">
              <SectionTitle action={<Pencil size={18} />}>
                Professional Bio
              </SectionTitle>
              <div className="dpm-bio-wrap">
                <textarea
                  className="dpm-bio"
                  maxLength={1000}
                  value={draft.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  aria-label="Professional bio"
                />
                <span className="dpm-counter" aria-live="polite">
                  {draft.bio.length} / 1000
                </span>
              </div>
            </section>

            {/* E. SPECIALTIES & FOCUS AREAS */}
            <section className="dpm-card dpm-section">
              <SectionTitle>Specialties &amp; Focus Areas</SectionTitle>

              <p className="dpm-label">Primary Specialty</p>
              <div className="dpm-tags">
                {draft.specialties.primary.map((item) => (
                  <Tag key={item} primary onRemove={() => removeTag("primary", item)}>
                    {item}
                  </Tag>
                ))}
                <button className="dpm-add-tag" onClick={() => addTag("primary")}>
                  <Plus size={16} />
                  Add Primary
                </button>
              </div>

              <p className="dpm-label dpm-label-topic">
                Sub-specialties &amp; Conditions Treated
              </p>
              <div className="dpm-tags">
                {draft.specialties.topics.map((item) => (
                  <Tag key={item} onRemove={() => removeTag("topics", item)}>
                    {item}
                  </Tag>
                ))}
                <button className="dpm-add-tag" onClick={() => addTag("topics")}>
                  <Plus size={16} />
                  Add Topic
                </button>
              </div>
            </section>
          </main>

          {/* ── RIGHT / SIDE COLUMN ─────────────────────────── */}
          <aside className="dpm-side-column">

            {/* F. PLATFORM STATS */}
            <section className="dpm-card dpm-stats">
              <h2>Platform Stats</h2>
              <div className="dpm-stat-pair">
                <Stat number={draft.statistics.experience} text="Years Exp." />
                <Stat
                  number={draft.statistics.rating}
                  text={
                    <>
                      <Star size={15} fill="currentColor" />
                      {" "}{draft.statistics.reviews} Reviews
                    </>
                  }
                />
              </div>
              <div className="dpm-patients">
                <span>Patients Treated on Sabi</span>
                <strong>{draft.statistics.patientsTreated}</strong>
              </div>
            </section>

            {/* G. CONSULTATION FEES */}
            <section className="dpm-card dpm-side-card">
              <SectionTitle action="Edit" onAction={() => setModal("fees")}>
                Consultation Fees
              </SectionTitle>
              {draft.fees.map((fee) => (
                <div className="dpm-fee" key={fee.id}>
                  <span className="dpm-fee-icon" aria-hidden="true">
                    {fee.id === "virtual" ? <Video size={22} /> : <Building2 size={22} />}
                  </span>
                  <div className="dpm-fee-info">
                    <strong>{fee.type}</strong>
                    <small>{fee.duration}</small>
                  </div>
                  <b className="dpm-fee-amount">₦{money.format(fee.amount)}</b>
                </div>
              ))}
            </section>

            {/* H. CREDENTIALS */}
            <section className="dpm-card dpm-side-card dpm-credentials">
              <SectionTitle action="Manage" onAction={() => setModal("credentials")}>
                Credentials
              </SectionTitle>
              {draft.credentials.map((item) => (
                <div className="dpm-credential" key={item.id}>
                  <span className="dpm-credential-icon" aria-hidden="true">
                    {credentialIcon(item.icon)}
                  </span>
                  <div>
                    <strong>{item.type}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </section>

          </aside>
        </div>

        {/* ══════════════════════════════════════════════════════
            I. CLINICAL LOCATIONS & AFFILIATIONS
        ══════════════════════════════════════════════════════ */}
        <section className="dpm-card dpm-locations">
          <SectionTitle
            action={
              <>
                <Plus size={18} />
                Add Location
              </>
            }
            onAction={() => openLocation(blankLocation)}
          >
            Clinical Locations &amp; Affiliations
          </SectionTitle>

          <div className="dpm-location-grid">
            {draft.locations.map((location, index) => (
              <article className="dpm-location" key={location.id}>
                <span className="dpm-location-icon" aria-hidden="true">
                  {location.type === "hospital" ? (
                    <Hospital size={22} />
                  ) : (
                    <Building2 size={22} />
                  )}
                </span>
                <div className="dpm-location-content">
                  <h3>{location.name}</h3>
                  <p>{location.address}</p>
                  <div className="dpm-location-badges">
                    <span>{location.days}</span>
                    <span>{location.hours}</span>
                  </div>
                </div>
                {/* Three-dot menu */}
                <button
                  className="dpm-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === index ? null : index);
                  }}
                  aria-label={`Options for ${location.name}`}
                  aria-expanded={menu === index}
                >
                  <MoreVertical size={20} />
                </button>
                {menu === index && (
                  <div className="dpm-location-menu" role="menu">
                    <button
                      role="menuitem"
                      onClick={() => { openLocation(location, index); setMenu(null); }}
                    >
                      <Pencil size={14} />
                      Edit location
                    </button>
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => { setModal({ kind: "remove", index }); setMenu(null); }}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ── Modals ──────────────────────────────────────────── */}
        {modal === "fees" && (
          <FeeDialog
            fees={draft.fees}
            onClose={() => setModal(null)}
            onSave={(fees) => { set("fees", fees); setModal(null); }}
          />
        )}

        {modal?.kind === "location" && (
          <LocationDialog
            location={modal.location}
            onClose={() => setModal(null)}
            onSave={(location) => {
              set(
                "locations",
                modal.index === undefined
                  ? [...draft.locations, { ...location, id: String(Date.now()) }]
                  : draft.locations.map((item, i) =>
                      i === modal.index ? { ...location, id: item.id } : item
                    )
              );
              setModal(null);
            }}
          />
        )}

        {modal?.kind === "remove" && (
          <Dialog
            title="Remove clinical location?"
            onClose={() => setModal(null)}
            onSave={() => {
              set(
                "locations",
                draft.locations.filter((_, i) => i !== modal.index)
              );
              setModal(null);
            }}
            saveLabel="Remove location"
            danger
          >
            <p className="dpm-dialog-copy">
              This location will no longer appear on your public profile.
            </p>
          </Dialog>
        )}

        {modal === "credentials" && (
          <Dialog
            title="Credential management"
            onClose={() => setModal(null)}
            onSave={() => setModal(null)}
            saveLabel="Close"
          >
            <p className="dpm-dialog-copy">
              Credential changes are submitted for verification before they appear on your
              public profile.
            </p>
          </Dialog>
        )}

        {modal === "preview" && (
          <Dialog
            title="Public profile preview"
            onClose={() => setModal(null)}
            onSave={() => setModal(null)}
            saveLabel="Close"
          >
            <div className="dpm-preview">
              <img src={identity.photo} alt="" />
              <div>
                <strong>{identity.name}</strong>
                <p>{identity.professionalTitle}</p>
                <small>
                  {draft.visibility
                    ? "Visible in the Sabi directory"
                    : "Currently hidden from the Sabi directory"}
                </small>
              </div>
            </div>
          </Dialog>
        )}

      </PageTransition>
    </PortalLayout>
  );
}
