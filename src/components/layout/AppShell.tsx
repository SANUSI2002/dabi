import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "@/components/motion/Reveal";

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();

  return (
    <div className="flex h-full bg-mist-50">
      {/* desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-mist-900/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileNav(true)} />
        <main className="flex-1 overflow-y-auto bg-mesh">
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
            <AnimatePresence mode="wait">
              <PageTransition key={loc.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
