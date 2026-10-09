import { afterEach, expect, it, vi } from 'vitest';
import { sabiPwaOptions } from '../../apps/telemedicine/packages/shared-portal/pwa/pwaOptions';

afterEach(() => vi.unstubAllGlobals());
it('never puts emergency API responses or cross-origin patient data in the offline cache', () => {
  const origin = 'https://sabi.example.test';
  vi.stubGlobal('registration', { scope: origin + '/' });
  const options = sabiPwaOptions({ cacheId: 'patient', name: 'Sabi', shortName: 'Sabi', description: 'Sabi', themeColor: '#113c30', backgroundColor: '#ffffff', nestedApps: [] });
  for (const path of ['/api/v1/profile/emergency-card', '/api/v1/profile/emergency-card/lookup', '/api/v1/profile/emergency-card/responder']) {
    expect(options.workbox.navigateFallbackDenylist.some((pattern) => pattern.test(path))).toBe(true);
    for (const rule of options.workbox.runtimeCaching) expect(rule.urlPattern({ url: new URL(path, origin), sameOrigin: true })).toBe(false);
  }
  for (const rule of options.workbox.runtimeCaching) {
    expect(rule.urlPattern({ url: new URL('https://api.example.test/assets/clinical.pdf'), sameOrigin: false })).toBe(false);
  }
});
