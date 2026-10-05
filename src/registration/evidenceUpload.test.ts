import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('@/config/runtime', () => ({ apiBaseUrl: 'https://sabihealth.org' }));
vi.mock('@/identity/liveIdentity', () => ({ liveApiRequest: vi.fn() }));
import { liveUploadApplicantEvidence } from './livePlatform';
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 'doc-1', scanStatus: 'PENDING' } }) }))));
afterEach(() => vi.unstubAllGlobals());
it('rejects files over the server-provided plan limit before fetching', async () => {
  const file = new File(['%PDF-1.7 content'], 'credential.pdf', { type: 'application/pdf' });
  await expect(liveUploadApplicantEvidence('app', 'OFFICER_LICENCE', 'capability', file, 10)).rejects.toThrow('0.00001 MB');
  expect(fetch).not.toHaveBeenCalled();
});
it('uploads bounded raw bytes with the scoped applicant token, not a scanner API key', async () => {
  const file = new File(['%PDF-1.7'], 'credential.pdf', { type: 'application/pdf' });
  await expect(liveUploadApplicantEvidence('app', 'OFFICER_LICENCE', 'capability', file, 3500000)).resolves.toMatchObject({ data: { scanStatus: 'PENDING' } });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/applications/app/evidence/OFFICER_LICENCE'), expect.objectContaining({ body: file, headers: { 'Content-Type': 'application/pdf', 'X-Sabi-Client': 'browser', 'X-Sabi-Evidence-Token': 'capability' } }));
});
