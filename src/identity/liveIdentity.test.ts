import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/runtime', () => ({ apiBaseUrl: 'https://api.test' }));

import { liveSignIn, liveSignOut } from './liveIdentity';

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

afterEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => respond({ status: 'success' })));
  await liveSignOut();
  vi.unstubAllGlobals();
});

describe('live platform identity', () => {
  it('does not grant a standard account Command Center access', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/login')) return respond({ status: 'success', accessToken: 'test-token' });
      if (url.endsWith('/me')) return respond({ user: { id: 'patient-1', email: 'patient@example.test', roles: [] }, organizations: [] });
      if (url.endsWith('/platform-assignment')) return respond({ error: { code: 'PLATFORM_ACCESS_DENIED', message: 'Access denied.' } }, 403);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await liveSignIn('patient@example.test', 'test-password');
    expect(result.kind).toBe('AUTHENTICATED');
    if (result.kind === 'AUTHENTICATED') {
      expect(result.identity.platformAssigned).toBe(false);
      expect(result.identity.platform).toBeNull();
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('recognizes an assigned account before MFA without exposing permissions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/login')) return respond({ status: 'success', accessToken: 'test-token' });
      if (url.endsWith('/me')) return respond({ user: { id: 'staff-1', email: 'staff@example.test', roles: [] }, organizations: [] });
      if (url.endsWith('/platform-assignment')) return respond({ data: { assigned: true } });
      if (url.endsWith('/platform-context')) return respond({ error: { code: 'MFA_ENROLLMENT_REQUIRED', message: 'Set up an authenticator.' } }, 403);
      throw new Error(`Unexpected request: ${url}`);
    }));
    const result = await liveSignIn('staff@example.test', 'test-password');
    expect(result.kind).toBe('AUTHENTICATED');
    if (result.kind === 'AUTHENTICATED') {
      expect(result.identity.platformAssigned).toBe(true);
      expect(result.identity.platform).toBeNull();
    }
  });

  it('loads roles only after verified platform context', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/login')) return respond({ status: 'success', accessToken: 'test-token' });
      if (url.endsWith('/me')) return respond({ user: { id: 'staff-1', email: 'staff@example.test', roles: [] }, organizations: [] });
      if (url.endsWith('/platform-assignment')) return respond({ data: { assigned: true } });
      if (url.endsWith('/platform-context')) return respond({ data: { roles: ['SABI_PLATFORM_ADMIN'], permissions: ['platform.onboarding.review'] } });
      throw new Error(`Unexpected request: ${url}`);
    }));
    const result = await liveSignIn('staff@example.test', 'test-password');
    expect(result.kind).toBe('AUTHENTICATED');
    if (result.kind === 'AUTHENTICATED') {
      expect(result.identity.platform?.roles).toEqual(['SABI_PLATFORM_ADMIN']);
    }
  });
});
