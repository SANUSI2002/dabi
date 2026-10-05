import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ShieldAlert, Phone, Video, MoreVertical, Paperclip, Image as ImageIcon, FileImage } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { getThreads, subscribeToThreads, markThreadRead, sendMessage } from "../../store/messageStore";
import { addActivity } from "../../store/activityStore";
import "./MessagesPage.css";

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const TEMPLATES = {
  "Insert Template": "Thank you for reaching out. I'll review this and get back to you shortly.",
  "Attach Lab Order": "I'm sending over a new lab order — please book your draw at your earliest convenience.",
};

export function MessagesPage() {
  const navigate = useNavigate();
  const threads = useSyncExternalStore(subscribeToThreads, getThreads, getThreads);
  const [activeId, setActiveId] = useState(threads[0]?.id || null);
  const [draft, setDraft] = useState("");

  const active = threads.find((t) => t.id === activeId) || threads[0];

  useEffect(() => {
    if (active?.unread) markThreadRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  function submit(e) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    sendMessage(active.id, draft.trim());
    addActivity(`Sent a message to ${active.patientName}.`);
    setDraft("");
  }

  function insertTemplate(label) {
    setDraft((d) => (d ? `${d} ${TEMPLATES[label]}` : TEMPLATES[label]));
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search patients, messages..." }}>
      <PageTransition className="dp-messages-page">
        <div className="dp-msg-inbox">
          <div className="dp-msg-inbox-title">Inbox</div>
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button
                key={t.id}
                className={`dp-msg-thread-row${active?.id === t.id ? " dp-msg-thread-row-active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                <div className="dp-msg-thread-top">
                  <span className="dp-msg-thread-name">{t.patientName}</span>
                  {t.unread && <span className="dp-msg-thread-dot" />}
                </div>
                <span className={`dp-msg-context-tag dp-msg-context-${t.tagColor || "green"}`}>{t.context}</span>
                <div className="dp-msg-thread-preview">{last?.text}</div>
              </button>
            );
          })}
        </div>

        <div className="dp-msg-thread">
          {!active ? (
            <p className="dp-empty">Select a conversation.</p>
          ) : (
            <>
              <div className="dp-msg-thread-header">
                <div>
                  <strong>{active.patientName}</strong>
                  <span className={`dp-msg-context-tag dp-msg-context-${active.tagColor || "green"}`} style={{ marginLeft: 10 }}>
                    {active.context}
                  </span>
                </div>
                <div className="dp-msg-thread-header-icons">
                  <button className="dp-icon-btn-outline" aria-label="Call">
                    <Phone size={15} />
                  </button>
                  <button className="dp-icon-btn-outline" aria-label="Video call" onClick={() => navigate(`/consultations?patient=${encodeURIComponent(active.patientName)}`)}>
                    <Video size={15} />
                  </button>
                  <button className="dp-icon-btn-outline" aria-label="More options">
                    <MoreVertical size={15} />
                  </button>
                </div>
              </div>

              <div className="dp-msg-banner">
                <ShieldAlert size={14} /> Secure messaging is not for medical emergencies. In an emergency, instruct the
                patient to call emergency services or visit the ER.
              </div>

              <div className="dp-msg-bubbles">
                {active.messages.map((m, i) => (
                  <div key={i} className={`dp-msg-bubble ${m.from === "doctor" ? "dp-msg-bubble-doctor" : "dp-msg-bubble-patient"}`}>
                    <div>{m.text}</div>
                    {m.attachment && (
                      <div className="dp-msg-attachment">
                        <FileImage size={16} />
                        <span>{m.attachment}</span>
                      </div>
                    )}
                    <div className="dp-msg-bubble-time">{timeLabel(m.at)}</div>
                  </div>
                ))}
              </div>

              <form className="dp-msg-composer" onSubmit={submit}>
                <button type="button" className="dp-msg-icon-btn" aria-label="Attach file">
                  <Paperclip size={16} />
                </button>
                <button type="button" className="dp-msg-icon-btn" aria-label="Attach image">
                  <ImageIcon size={16} />
                </button>
                <input
                  placeholder="Type a secure message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit" className="dp-msg-send" aria-label="Send">
                  <Send size={16} />
                </button>
              </form>
              <div className="dp-msg-quick-actions">
                <button className="dp-text-btn" onClick={() => insertTemplate("Insert Template")}>
                  Insert Template
                </button>
                <button className="dp-text-btn" onClick={() => insertTemplate("Attach Lab Order")}>
                  Attach Lab Order
                </button>
              </div>
            </>
          )}
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default MessagesPage;
