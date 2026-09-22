export const DEFAULT_MAP_COORDINATES = [9.0765, 7.3986];

/**
 * Returns safe numeric coordinates for Leaflet and external map links.
 * Invalid or missing values fall back to Abuja so location actions never crash.
 */
export function validateCoordinates(lat, lng) {
  const safeLat = Number(lat);
  const safeLng = Number(lng);

  if (
    !Number.isFinite(safeLat) ||
    !Number.isFinite(safeLng) ||
    safeLat < -90 || safeLat > 90 ||
    safeLng < -180 || safeLng > 180
  ) {
    return DEFAULT_MAP_COORDINATES;
  }

  return [safeLat, safeLng];
}

/** Opens validated driving directions in a separate, isolated browser tab. */
export function openExternalDirections(lat, lng, label = "SabiHealth location") {
  const [safeLat, safeLng] = validateCoordinates(lat, lng);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}`;
  const directionsLink = document.createElement("a");
  directionsLink.href = url;
  directionsLink.target = "_blank";
  directionsLink.rel = "noopener noreferrer";
  directionsLink.setAttribute("aria-label", `Open directions to ${label}`);
  directionsLink.click();
}
