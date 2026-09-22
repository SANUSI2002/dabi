import React, { useEffect, useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { getThread, sendMessage, subscribeToChat } from "../chatStore";

export function ChatModal({ prescriptionId, pharmacyId, pharmacyName, onClose }) {
  const [messages, setMessages] = useState(() => getThread(prescriptionId, pharmacyId));
  const [text, setText] = useState("");

  useEffect(
    () => subscribeToChat(() => setMessages(getThread(prescriptionId, pharmacyId))),
    [prescriptionId, pharmacyId]
  );

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(prescriptionId, pharmacyId, pharmacyName, text.trim());
    setText("");
  };

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal sabi-chat-modal" role="dialog" aria-modal="true" aria-label={`Chat with ${pharmacyName}`} onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>
            <MessageCircle size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            {pharmacyName}
          </h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="sabi-chat-thread">
          {messages.length === 0 && (
            <p className="sabi-chat-empty">
              Ask {pharmacyName} about stock, delivery time, or anything on your invoice.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`sabi-chat-bubble ${m.from === "patient" ? "mine" : "theirs"}`}>
              {m.text}
            </div>
          ))}
        </div>

        <div className="sabi-chat-input-row">
          <input
            type="text"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button type="button" onClick={handleSend} aria-label="Send message">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatModal;
