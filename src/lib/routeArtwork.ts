import { ROUTE_ARTWORK } from "./routeArtwork.data";

// The decorative banner illustration for a page: its route's own artwork, else its nearest parent
// route's, else none. Images are the optimised WebPs of the Sabi EMR original artwork library.

// "/ward-round/:admissionId/:roundId?" → /^\/ward-round\/[^/]+(?:\/[^/]+)?\/?$/ (one pass, so the
// optional group's own "(?:" is never read as a parameter)
const pattern = (route: string) =>
  new RegExp(`^${route.split("/").filter(Boolean).map((seg) => (seg.startsWith(":") ? (seg.endsWith("?") ? "(?:/[^/]+)?" : "/[^/]+") : `/${seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).join("")}/?$`);
const compiled = ROUTE_ARTWORK.map(([route, id]) => ({ route, id, re: pattern(route), dynamic: route.includes(":") }));
const ART_BASE = `${import.meta.env.BASE_URL ?? "/"}emr-artwork/v1/`;

/** The artwork id for a path (e.g. "/accounting/invoices" → "accounting-invoices"), or null. */
export function artworkIdFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  // an exact (or parameterised) route first, static routes before dynamic ones
  const hit = compiled.find((c) => !c.dynamic && c.re.test(path)) ?? compiled.find((c) => c.dynamic && c.re.test(path));
  if (hit) return hit.id;
  const parts = path.split("/").filter(Boolean);
  for (let n = parts.length - 1; n > 0; n -= 1) {
    const parent = `/${parts.slice(0, n).join("/")}`;
    const up = compiled.find((c) => !c.dynamic && c.route === parent);
    if (up) return up.id;
  }
  return null;
}
export const artworkUrl = (id: string, thumb = false) => `${ART_BASE}${id}${thumb ? "-thumb" : ""}-v1.webp`;
