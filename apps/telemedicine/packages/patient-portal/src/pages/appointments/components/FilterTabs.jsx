import React from "react";
import { FILTER_TABS } from "../data";

export function FilterTabs({ active, onChange }) {
  return (
    <div className="sabi-apt-tabs">
      {FILTER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={"sabi-apt-tab" + (tab === active ? " active" : "")}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export default FilterTabs;
