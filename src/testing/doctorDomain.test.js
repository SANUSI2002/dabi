import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
const defaults = () => {
  vi.stubEnv('VITE_SABI_DOCTOR_URL', '');
  vi.stubEnv('VITE_DOCTOR_PORTAL_URL', '');
  vi.resetModules();
};

describe('standalone doctor domain', () => {
  it('uses the doctor domain for production landing and patient entry points', async () => {
    defaults(); vi.stubEnv('DEV', false);
    const landing = await import('../public/ecosystemLinks');
    const patient = await import('../../apps/telemedicine/packages/patient-portal/src/ecosystemLinks');
    expect(landing.DOCTOR_SIGN_IN_URL).toBe('https://doctor.sabihealth.org/login');
    expect(landing.DOCTOR_REGISTER_URL).toBe('https://doctor.sabihealth.org/register');
    expect(patient.DOCTOR_PORTAL_URL).toBe('https://doctor.sabihealth.org');
  });

  it('keeps local development on the existing doctor dev server', async () => {
    defaults(); vi.stubEnv('DEV', true);
    const landing = await import('../public/ecosystemLinks');
    const patient = await import('../../apps/telemedicine/packages/patient-portal/src/ecosystemLinks');
    expect(landing.DOCTOR_SIGN_IN_URL).toBe('http://127.0.0.1:5175/doctor-portal/login');
    expect(patient.DOCTOR_PORTAL_URL).toBe('http://127.0.0.1:5175/doctor-portal');
  });

  it('allows an explicit doctor origin without duplicate path separators', async () => {
    defaults(); vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SABI_DOCTOR_URL', 'https://doctor.example.test/');
    const landing = await import('../public/ecosystemLinks');
    const patient = await import('../../apps/telemedicine/packages/patient-portal/src/ecosystemLinks');
    expect(landing.DOCTOR_SIGN_IN_URL).toBe('https://doctor.example.test/login');
    expect(patient.DOCTOR_PORTAL_URL).toBe('https://doctor.example.test');
  });

  it('keeps legacy redirects limited to browser pages, not API, assets or service workers', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.redirects.map(rule => rule.source)).toEqual([
      '/telemedicine/doctor-portal/:path*', '/doctor-portal/:path*',
    ]);
    for (const rule of config.redirects) {
      expect(rule.destination).toBe('https://doctor.sabihealth.org/:path*');
      expect(rule.permanent).toBe(false);
      const accept = rule.has.find(condition => condition.type === 'header' && condition.key === 'accept');
      expect(new RegExp(accept.value).test('text/html,application/xhtml+xml')).toBe(true);
      expect(new RegExp(accept.value).test('*/*')).toBe(false);
      expect(new RegExp(accept.value).test('application/javascript')).toBe(false);
    }
    expect(config.rewrites[0]).toMatchObject({ source: '/api/:path*', destination: 'https://sabi-health-api-test.onrender.com/api/:path*' });
  });
});
