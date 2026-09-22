import React from "react";
import { Search } from "lucide-react";
import { PrescriptionCard } from "./PrescriptionCard";

/* DEBUG NOTE: Prescriptions refactor - Search and status controls drive the shared page-level filtered data. */
export function PrescriptionsList({ prescriptions, onViewDetails, searchQuery, statusFilter, onSearchQueryChange, onStatusFilterChange }) {

  return (
    <div className="sabi-rx-list-wrap">
      <div className="sabi-rx-list-head">
        <div className="sabi-rx-tabs"><span className="sabi-rx-tab active">All Prescriptions</span></div>
        <div className="sabi-rx-list-tools">
          <label className="sabi-rx-search"><Search size={16} strokeWidth={2} aria-hidden="true" /><input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search prescriptions" aria-label="Search prescriptions" /></label>
          <select className="sabi-rx-status-filter" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label="Filter prescriptions by status">
            <option value="All">All statuses</option><option value="Active">Active</option><option value="Needs Renewal">Needs Renewal</option>
          </select>
        </div>
      </div>

      <div className="sabi-rx-list">
        {prescriptions.length ? prescriptions.map((rx) => <PrescriptionCard prescription={rx} key={rx.id} onViewDetails={onViewDetails} />) : <p className="sabi-rx-empty">No prescriptions match the current filters.</p>}
      </div>
    </div>
  );
}

export default PrescriptionsList;
