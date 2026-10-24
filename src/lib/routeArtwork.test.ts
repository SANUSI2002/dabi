import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { artworkIdFor, artworkUrl } from "./routeArtwork";
import { ROUTE_ARTWORK } from "./routeArtwork.data";

describe("route artwork", () => {
  it("finds each page's own illustration, parameterised routes included", () => {
    expect(artworkIdFor("/accounting/invoices")).toBe("accounting-invoices");
    expect(artworkIdFor("/accounting/invoices/")).toBe("accounting-invoices");
    expect(artworkIdFor("/patients/abc-123")).toBe("patients-id");
    expect(artworkIdFor("/ward-round/a1")).toBe("ward-round-admissionId-roundId");
    expect(artworkIdFor("/ward-round/a1/r9")).toBe("ward-round-admissionId-roundId");
    expect(artworkIdFor("/equipment-scada/register")).toBe("equipment-scada-register"); // a static route before a dynamic one
    expect(artworkIdFor("/equipment-scada/register/eq-7")).toBe("equipment-scada-register-id");
  });
  it("falls back to the nearest parent route, and to none outside the hospital OS", () => {
    expect(artworkIdFor("/accounting/payers")).toBe("accounting");
    expect(artworkIdFor("/workforce/leave/requests/42")).toBe("workforce-leave");
    expect(artworkIdFor("/portal/abc")).toBeNull();
    expect(artworkIdFor("/")).toBeNull();
  });
  it("points at published images for every mapped route", () => {
    for (const [, id] of ROUTE_ARTWORK) {
      expect(existsSync(`public/emr-artwork/v1/${id}-v1.webp`), id).toBe(true);
      expect(artworkUrl(id)).toMatch(new RegExp(`emr-artwork/v1/${id}-v1\\.webp$`));
    }
  });
});
