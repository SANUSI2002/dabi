import React from "react";

export const FILTER_TABS = ["Upcoming", "Awaiting", "Past", "Cancelled", "All"];

export function FilterTabs({ active, onChange }) {
  return (
    <div className="sabi-apt-tabs" role="tablist" aria-label="Filter appointments">
      {FILTER_TABS.map((tab) => (
        <button key={tab} type="button" role="tab" aria-selected={tab === active} className={"sabi-apt-tab" + (tab === active ? " active" : "")} onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export default FilterTabs;
