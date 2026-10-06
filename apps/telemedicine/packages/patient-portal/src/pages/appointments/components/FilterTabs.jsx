import React from "react";
import { FILTER_TABS } from "../data";
import { Tabs } from "../../../../../shared-portal/design-system/ui.jsx";

/** Appointment filters as an accessible tab list, with how many appointments each holds. */
export function FilterTabs({ active, onChange, counts = {} }) {
  return <Tabs className="sabi-apt-filter" label="Filter appointments" value={active} onChange={onChange}
    tabs={FILTER_TABS.map((tab) => ({ id: tab, label: tab, count: counts[tab] }))} />;
}

export default FilterTabs;
