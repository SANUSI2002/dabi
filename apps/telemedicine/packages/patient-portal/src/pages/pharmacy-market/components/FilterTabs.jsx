import React from "react";

export function FilterTabs({ filters, activeFilter, onChange }) {
  return <div className="sabi-market-filters" role="tablist">{filters.map((filter) => <button key={filter} type="button" role="tab" aria-selected={filter === activeFilter} className={filter === activeFilter ? "active" : ""} onClick={() => onChange(filter)}>{filter}</button>)}</div>;
}
