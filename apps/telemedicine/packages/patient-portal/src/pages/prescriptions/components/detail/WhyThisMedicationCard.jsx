import React from "react";
import { FlaskConical, Award, Info } from "lucide-react";

const ICONS = { FlaskConical, Award };

export function WhyThisMedicationCard({ items }) {
  return (
    <div className="sabi-card sabi-rxd-why-card">
      <h2 className="sabi-rxd-card-title sabi-rxd-why-title">
        <Info size={20} strokeWidth={2} />
        Why this medication?
      </h2>

      <div className="sabi-rxd-why-list">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div className="sabi-rxd-why-item" key={item.title}>
              <div className="sabi-rxd-why-icon">
                {Icon && <Icon size={18} strokeWidth={2} />}
              </div>
              <div>
                <div className="sabi-rxd-why-item-title">{item.title}</div>
                <p className="sabi-rxd-why-item-body">{item.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WhyThisMedicationCard;