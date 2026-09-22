import React from "react";

/* DEBUG NOTE: Prescriptions refactor - Header now contains only prescription context, not retired actions. */
export function PrescriptionsHeader() {
  return (
    <div className="sabi-rx-header">
      <div>
        <h1 className="sabi-rx-title">Prescriptions</h1>
        <p className="sabi-rx-subtitle">
          Manage your medications, monitor your treatment plans, and never miss a dose.
        </p>
      </div>
    </div>
  );
}

export default PrescriptionsHeader;
