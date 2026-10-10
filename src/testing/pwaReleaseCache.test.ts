import { describe, expect, it } from "vitest";
import { sabiPwaOptions } from "../../apps/telemedicine/packages/shared-portal/pwa/pwaOptions";

describe("installed app release consistency", () => {
  const options = sabiPwaOptions({
    cacheId: "pharmacy",
    name: "Sabi Pharmacy",
    shortName: "Sabi Pharmacy",
    description: "Pharmacy workspace",
    themeColor: "#061d15",
    backgroundColor: "#061d15",
    nestedApps: [/^\/telemedicine(?:\/|$)/],
  });

  it("precaches top-level JavaScript with the HTML shell so an old release can still boot", () => {
    expect(options.workbox.globPatterns).toContain("*.html");
    expect(options.workbox.globPatterns).toContain("assets/*.{js,css,woff2}");
    expect(options.workbox.globPatterns.every((pattern) => !pattern.includes("**"))).toBe(true);
  });

  it("keeps updates user-controlled and excludes API and nested application navigation", () => {
    expect(options.registerType).toBe("prompt");
    expect(options.injectRegister).toBe(false);
    for (const path of ["/api/v1/pharmacy-portal/me", "/telemedicine/login"]) {
      expect(options.workbox.navigateFallbackDenylist.some((pattern) => pattern.test(path))).toBe(true);
    }
  });
});
