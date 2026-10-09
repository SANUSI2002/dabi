import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ELSEWHERE_NOTICE, elsewhereSignInUrl, reportSignedInElsewhere, signedOutElsewhere, startSessionWatch } from '../../apps/telemedicine/packages/shared-portal/sessionWatch.js';
import { createDoctorAuthClient } from '../../apps/telemedicine/packages/doctor-portal/src/services/doctorAuthClient.js';

const flush = () => vi.advanceTimersByTimeAsync(0);
let stop;
beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); });
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });

describe('signed in on another device', () => {
  it('signs this device out at the first check that finds the session ended elsewhere', async () => {
    const check = vi.fn().mockResolvedValueOnce('active').mockResolvedValue('elsewhere');
    const onSignedInElsewhere = vi.fn();
    stop = startSessionWatch({ check, onSignedInElsewhere, intervalMs: 10_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onSignedInElsewhere).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onSignedInElsewhere).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onSignedInElsewhere).toHaveBeenCalledTimes(1); // once only
  });

  it('checks at once when the app comes back to the screen, and not while it is hidden', async () => {
    const check = vi.fn().mockResolvedValue('elsewhere');
    const onSignedInElsewhere = vi.fn();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    stop = startSessionWatch({ check, onSignedInElsewhere });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(onSignedInElsewhere).toHaveBeenCalled();
  });

  it('reacts immediately when any request is refused, and other tabs follow', async () => {
    const onSignedInElsewhere = vi.fn();
    stop = startSessionWatch({ check: vi.fn().mockResolvedValue('active'), onSignedInElsewhere });
    reportSignedInElsewhere();
    expect(onSignedInElsewhere).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('sabi:signed-in-elsewhere')).toBeTruthy();

    stop(); const otherTab = vi.fn();
    stop = startSessionWatch({ check: vi.fn(), onSignedInElsewhere: otherTab });
    window.dispatchEvent(new StorageEvent('storage', { key: 'sabi:signed-in-elsewhere', newValue: String(Date.now()) }));
    expect(otherTab).toHaveBeenCalledTimes(1);
  });

  it('does nothing while nobody is signed in, offline or when the server is busy', async () => {
    const onSignedInElsewhere = vi.fn();
    stop = startSessionWatch({ check: vi.fn().mockRejectedValue(new Error('offline')), onSignedInElsewhere, isSignedIn: () => true });
    await vi.advanceTimersByTimeAsync(30_000);
    stop(); stop = startSessionWatch({ check: vi.fn().mockResolvedValue('elsewhere'), onSignedInElsewhere, isSignedIn: () => false });
    await vi.advanceTimersByTimeAsync(30_000);
    reportSignedInElsewhere();
    expect(onSignedInElsewhere).not.toHaveBeenCalled();
  });

  it('builds the sign-in link and explains why', () => {
    expect(elsewhereSignInUrl('/doctor-portal/')).toBe('/doctor-portal/login?reason=elsewhere');
    expect(signedOutElsewhere('?reason=elsewhere')).toBe(true);
    expect(signedOutElsewhere('?reason=idle')).toBe(false);
    expect(ELSEWHERE_NOTICE).toMatch(/signed in on another device/);
  });
});

describe('professional portal session check', () => {
  const reply = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  const doctorRoutes = (url) => (url.endsWith('/auth/me') ? reply(200, { user: { id: 'u1', fullName: 'Dr Synthetic', accountStatus: 'ACTIVE', emailVerifiedAt: '2026-01-01' } })
    : url.endsWith('/professionals/me') ? reply(200, { data: { id: 'p1', professionType: 'DOCTOR', verificationStatus: 'VERIFIED' } }) : null);

  it('reports "elsewhere" from the session check, and from a refused refresh', async () => {
    let sessionReply = reply(200, { data: { active: true } });
    const fetcher = vi.fn((url) => doctorRoutes(url) ?? (url.endsWith('/auth/login') ? reply(200, { accessToken: 't1' })
      : url.endsWith('/auth/session') ? sessionReply
      : url.endsWith('/auth/refresh') ? reply(401, { code: 'SIGNED_IN_ELSEWHERE', message: 'signed in elsewhere' }) : reply(404, {})));
    const onSignedInElsewhere = vi.fn();
    const client = createDoctorAuthClient({ base: 'https://api.test', fetcher, lock: (work) => work(), onSignedInElsewhere });
    await client.signIn('doctor@synthetic.test', 'x');
    expect(await client.checkSession()).toBe('active');
    sessionReply = reply(401, { code: 'SIGNED_IN_ELSEWHERE' });
    expect(await client.checkSession()).toBe('elsewhere');

    const second = createDoctorAuthClient({ base: 'https://api.test', fetcher: vi.fn((url) => doctorRoutes(url) ?? (url.endsWith('/auth/login') ? reply(200, { accessToken: 't2' })
      : url.endsWith('/auth/refresh') ? reply(401, { code: 'SIGNED_IN_ELSEWHERE' }) : reply(401, {}))), lock: (work) => work(), onSignedInElsewhere });
    await second.signIn('doctor@synthetic.test', 'x');
    await expect(second.authenticated('/doctor-appointments/practice/appointments')).rejects.toMatchObject({ status: 401 });
    expect(onSignedInElsewhere).toHaveBeenCalledTimes(1);
    expect(await second.checkSession()).toBe('elsewhere');
  });
});
