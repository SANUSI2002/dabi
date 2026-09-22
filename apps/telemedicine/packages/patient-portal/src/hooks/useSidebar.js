import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sabi-sidebar-collapsed";

/**
 * Owns sidebar collapse + mobile-drawer state.
 * - `collapsed` persists across reloads via localStorage (desktop/tablet).
 * - `mobileOpen` is session-only; the mobile drawer should always start closed.
 */
export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage unavailable (e.g. private browsing) — fail silently,
      // collapse state just won't persist this session.
    }
  }, [collapsed]);

  // Close the mobile drawer automatically if the viewport grows past
  // the breakpoint where the drawer applies, so it doesn't get "stuck"
  // open if the user resizes or rotates a tablet.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handleChange = (e) => {
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile };
}

export default useSidebar;
