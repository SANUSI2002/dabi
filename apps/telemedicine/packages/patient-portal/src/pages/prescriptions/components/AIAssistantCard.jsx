import React from "react";
import { Sparkles, Info } from "lucide-react";

export function AIAssistantCard({ insight, onAskQuestion }) {
  return (
    <div className="sabi-rx-ai-card">
      <div className="sabi-rx-ai-head">
        <div className="sabi-rx-ai-icon">
          <Sparkles size={16} strokeWidth={2} />
        </div>
        <span className="sabi-rx-ai-title">Sabi AI Assistant</span>
      </div>

      <p className="sabi-rx-ai-quote">&ldquo;{insight.quote}&rdquo;</p>

      <div className="sabi-rx-ai-note">
        <Info size={15} strokeWidth={2} />
        <span>{insight.note}</span>
      </div>

      <button className="sabi-rx-ai-btn" onClick={onAskQuestion}>
        Ask a Question
      </button>
    </div>
  );
}

export default AIAssistantCard;