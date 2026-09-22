// Re-exported from the shared ZoomContext so every existing import of
// `useZoom` from this path keeps working, but now all callers share
// one real state instance (see context/ZoomContext.jsx for why that
// matters — independent useState copies didn't update each other).
export { useZoom, DEFAULT_ZOOM } from "../context/ZoomContext";
