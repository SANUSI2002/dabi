import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  children,
  initial,
  active: activeProp,
  onChange,
  label = "Sections",
}: {
  tabs: string[];
  children: (active: string) => ReactNode;
  initial?: string;
  /** controlled mode: pass the active tab + onChange to drive it from the parent (e.g. jump to a tab on an action elsewhere on the page) */
  active?: string;
  onChange?: (tab: string) => void;
  /** accessible name for the tablist */
  label?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(initial && tabs.includes(initial) ? initial : tabs[0]);
  const isControlled = activeProp !== undefined;
  const active = isControlled ? activeProp! : uncontrolled;
  const setActive = (tab: string) => (isControlled ? onChange?.(tab) : setUncontrolled(tab));
  const uid = useId();
  const tabId = (tab: string) => `${uid}-tab-${tab.replace(/\W+/g, "-")}`;
  const panelId = (tab: string) => `${uid}-panel-${tab.replace(/\W+/g, "-")}`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.indexOf(active);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next]);
    document.getElementById(tabId(tabs[next]))?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="mb-5 -mx-1 flex gap-1 overflow-x-auto border-b border-mist-200 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            id={tabId(tab)}
            role="tab"
            type="button"
            aria-selected={active === tab}
            aria-controls={panelId(tab)}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => setActive(tab)}
            onKeyDown={onKeyDown}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 rounded",
              active === tab ? "text-brand-700" : "text-mist-400 hover:text-mist-600",
            )}
          >
            {tab}
            {active === tab && (
              <motion.span
                layoutId={`tab-underline-${uid}`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <motion.div
        key={active}
        id={panelId(active)}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        tabIndex={0}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="focus-visible:outline-none"
      >
        {children(active)}
      </motion.div>
    </div>
  );
}
