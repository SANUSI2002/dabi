import React, { createContext, useContext, useState, useMemo } from "react";

// This now represents a value applied to the --sabi-font-scale CSS variable,
// NOT the CSS `zoom` property. `zoom` shrinks rendered pixels while leaving
// vh/vw units (like the sidebar's height: 100vh) computed against the real
// viewport — that mismatch was the cause of the white gap at the bottom of
// the sidebar. --sabi-font-scale instead scales font-size/spacing via calc(),
// which share.css already supports everywhere, without touching layout height.
export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.85;
export const MAX_ZOOM = 1.3;

const ZoomContext = createContext(null);

export function ZoomProvider({ children }) {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM);

  const setZoom = (next) => {
    setZoomState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    });
  };

  const value = useMemo(() => [zoom, setZoom], [zoom]);

  return (
    <ZoomContext.Provider value={value}>
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom() {
  const ctx = useContext(ZoomContext);

  if (!ctx) {
    throw new Error(
      "useZoom must be used within a ZoomProvider (wrap the app root in <ZoomProvider>)."
    );
  }

  return ctx;
}
