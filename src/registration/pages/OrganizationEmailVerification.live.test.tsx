import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveRequestVerificationLink, liveVerifyApplication } from '../livePlatform';
import { ApplicationEmailVerificationPage } from './OrganizationRegistration';

vi.mock('@/config/runtime', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/config/runtime')>(),
  apiConfigured: true,
  apiBaseUrl: 'https://api.test',
}));
vi.mock('../livePlatform', async (importOriginal) => ({
  ...await importOriginal<typeof import('../livePlatform')>(),
  liveVerifyApplication: vi.fn(),
  liveRequestVerificationLink: vi.fn(),
}));

const id = '33333333-3333-4333-8333-333333333333';
function showPage() {
  return render(<MemoryRouter initialEntries={[`/register/organization/verify/${id}`]}><Routes><Route path="/register/organization/verify/:id" element={<ApplicationEmailVerificationPage/>}/></Routes></MemoryRouter>);
}

afterEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/'); });

describe('hospital email verification recovery', () => {
  it('verifies a valid link and offers the document-upload capability', async () => {
    window.history.replaceState(null, '', `/register/organization/verify/${id}#${'a'.repeat(64)}`);
    vi.mocked(liveVerifyApplication).mockResolvedValue({ data: { id, reference: 'SABI-APP-TEST', status: 'SUBMITTED', createdAt: '2026-09-24', submittedAt: '2026-09-24', evidenceAccessToken: 'b'.repeat(64) } });
    showPage();
    await waitFor(() => expect(screen.getByText('Application email verified')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Continue to requested documents' })).toHaveAttribute('href', `/register/organization/evidence/${id}#${'b'.repeat(64)}`);
    expect(window.location.hash).toBe('');
  });

  it('recovers from an expired or consumed token without retrying it', async () => {
    window.history.replaceState(null, '', `/register/organization/verify/${id}#${'c'.repeat(64)}`);
    vi.mocked(liveVerifyApplication).mockRejectedValue(new Error('verification link invalid'));
    showPage();
    await waitFor(() => expect(screen.getByText('Verification could not be completed')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Continue to document upload' })).toHaveAttribute('href', `/register/organization/evidence/${id}`);
    expect(screen.getByRole('button', { name: 'Email new link' })).toBeInTheDocument();
  });

  it('offers document access and a fresh verification link when the one-time link is missing', async () => {
    window.history.replaceState(null, '', `/register/organization/verify/${id}`);
    vi.mocked(liveRequestVerificationLink).mockResolvedValue({ message: 'If pending, a link will be emailed.' });
    showPage();
    expect(screen.getByRole('link', { name: 'Continue to document upload' })).toHaveAttribute('href', `/register/organization/evidence/${id}`);
    fireEvent.change(screen.getByLabelText('Not verified yet? Request another email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email new link' }));
    await waitFor(() => expect(liveRequestVerificationLink).toHaveBeenCalledWith(id, 'owner@example.com'));
    expect(screen.getByText(/If verification is still pending/)).toBeInTheDocument();
    expect(liveVerifyApplication).not.toHaveBeenCalled();
  });
});
