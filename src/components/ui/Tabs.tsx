import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  children,
}: {
  tabs: string[];
  children: (active: string) => ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-mist-200">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={cn(
              "relative px-3.5 py-2.5 text-sm font-semibold transition-colors",
              active === t ? "text-brand-700" : "text-mist-400 hover:text-mist-600",
            )}
          >
            {t}
            {active === t && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient"
              />
            )}
          </button>
        ))}
      </div>
      <motion.div key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {children(active)}
      </motion.div>
    </div>
  );
}
