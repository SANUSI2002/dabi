import { useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  children,
  initial,
}: {
  tabs: string[];
  children: (active: string) => ReactNode;
  initial?: string;
}) {
  const [active, setActive] = useState(initial && tabs.includes(initial) ? initial : tabs[0]);
  const uid = useId();

  return (
    <div>
      <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto border-b border-mist-200 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors",
              active === t ? "text-brand-700" : "text-mist-400 hover:text-mist-600",
            )}
          >
            {t}
            {active === t && (
              <motion.span
                layoutId={`tab-underline-${uid}`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {children(active)}
      </motion.div>
    </div>
  );
}
