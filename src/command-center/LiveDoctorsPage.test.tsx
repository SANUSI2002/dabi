import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LiveDoctorsPage, { safeCredentialPreview } from './LiveDoctorsPage';
const api = vi.fn();
vi.mock('@/identity/liveIdentity', () => ({ liveApiRequest: (...args: unknown[]) => api(...args) }));
const profile = { id: 'doctor-1', userId: 'owner', name: 'Synthetic Doctor', email: 'synthetic@example.test', emailVerified: true, status: 'PENDING', specialty: 'General Practice', registrationNumber: 'TEST-001', submittedAt: '2026-10-05', applicationId: 'app', credentials: [{ id: 'doc', kind: 'licence', scanStatus: 'PENDING', reviewStatus: 'PENDING', byteSize: 100, sha256: 'synthetic' }], blockers: ['licence: clean malware screening required.'] };
function mount(userId = 'reviewer', canApprove = true) { return render(<MemoryRouter initialEntries={['/command-center/sabi-health/doctors/doctor-1']}><LiveDoctorsPage userId={userId} canApprove={canApprove} /></MemoryRouter>); }
beforeEach(() => { api.mockReset(); api.mockResolvedValue({ data: profile }); });
afterEach(cleanup);
describe('live doctor verification screen', () => {
  it('blocks previews and approval until server evidence gates pass', async () => {
    mount(); expect(await screen.findByText('Synthetic Doctor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview document' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); expect(screen.getByRole('button', { name: 'Approve doctor workspace' })).toBeDisabled();
    expect(screen.getByText('licence: clean malware screening required.')).toBeInTheDocument();
  });
  it('prevents self-review and approval', async () => {
    mount('owner'); expect(await screen.findByText('You cannot review or approve your own application.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve doctor workspace' })).not.toBeInTheDocument();
  });
  it('keeps reviewer-only roles read-only', async () => {
    mount('reviewer', false); expect(await screen.findByText(/Your role can inspect/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept document' })).not.toBeInTheDocument();
  });
  it('provides a fresh MFA path and retry instead of presenting outages as an empty queue', async () => {
    api.mockRejectedValue(new Error('Recent multi-factor verification is required.')); mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Recent multi-factor verification is required.');
    expect(screen.getByRole('link', { name: 'Verify authenticator again' })).toHaveAttribute('href', '/identity/mfa?next=command-center');
    expect(screen.queryByText('No doctor applications with this status.')).not.toBeInTheDocument();
  });
  it('allows only private signed HTTPS Supabase previews', () => {
    expect(safeCredentialPreview('https://test.supabase.co/storage/v1/object/sign/bucket/path?token=synthetic')).toBe(true);
    for (const value of ['javascript:alert(1)', 'https://test.supabase.co.evil.test/storage/v1/object/sign/a', 'https://name:password@test.supabase.co/storage/v1/object/sign/a', 'https://test.supabase.co/storage/v1/object/public/a']) expect(safeCredentialPreview(value)).toBe(false);
  });
  it('previews screened files inside Command Center without relying on browser popups', async () => {
    const clean = { ...profile, credentials: [{ ...profile.credentials[0], scanStatus: 'CLEAN', contentType: 'image/png' }] };
    api.mockImplementation(async (path: string) => ({ data: path.endsWith('/preview') ? { url: 'https://test.supabase.co/storage/v1/object/sign/bucket/file?token=synthetic' } : clean }));
    mount(); await screen.findByText('Synthetic Doctor');
    fireEvent.click(screen.getByRole('button', { name: 'Preview document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Practising licence' });
    expect(dialog.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/storage/v1/object/sign/'));
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept document' })).toBeEnabled();
  });
});
