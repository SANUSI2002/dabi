import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "@/components/motion/Reveal";
import { useIntegrations } from "@/store/useIntegrations";
import { EntitlementBoundary } from "@/platform/EntitlementBoundary";
import { useTenant } from "@/store/useTenant";
import { useRevenueCycle } from "@/billing/useRevenueCycle";
import { EmrRouteLoadingScreen } from "./AppLoadingScreen";
import "@/store/accounting/bootstrap";

function TimedRouteLoader({ pathname, tenantName }: { pathname: string; tenantName: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 650);
    return () => window.clearTimeout(timer);
  }, []);

  return <AnimatePresence>{visible && <EmrRouteLoadingScreen pathname={pathname} tenantName={tenantName} />}</AnimatePresence>;
}

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();
  const tenantName = useTenant((state) => state.tenant.name);

  useEffect(() => {
    document.title = `Sabi OS — ${tenantName}`;
  }, [tenantName]);

  // Platform integration layer: mirror EMR billing + payroll into Accounting.
  // Runs on load and whenever the app route changes, so the ledger stays current
  // without EMR/HR knowing accounting exists. No-op when nothing is pending.
  const autoSync = useIntegrations((s) => s.autoSync);
  const revenuePostingVersion = useRevenueCycle((state) => `${state.invoices.length}:${state.payments.length}`);
  useEffect(() => {
    if (!autoSync) return;
    const c = useIntegrations.getState().pendingCounts();
    if (c.emrBilling || c.payrollAccrual || c.payrollSettlement || c.pharmacy) useIntegrations.getState().syncAll();
  }, [autoSync, loc.pathname, revenuePostingVersion]);

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
        <main className="relative flex-1 overflow-y-auto bg-mesh">
          <TimedRouteLoader key={loc.key} pathname={loc.pathname} tenantName={tenantName} />
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
            <AnimatePresence mode="wait">
              <PageTransition key={loc.pathname}>
                <EntitlementBoundary>
                  <Outlet />
                </EntitlementBoundary>
              </PageTransition>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
