import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SabiAiPage from '../../apps/telemedicine/packages/patient-portal/src/pages/ai/SabiAiPage.jsx';
import { ZoomProvider } from '../../apps/telemedicine/packages/patient-portal/src/context/ZoomContext.jsx';
const mocks = vi.hoisted(() => ({ request: vi.fn(), upload: vi.fn(), user: null }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity', () => ({ authorizedRequest: mocks.request, getCurrentUser: () => mocks.user }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/recordsApi', () => ({ uploadDocument: mocks.upload }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/pages/dashboard/components', () => ({ Sidebar: () => <nav aria-label="Patient portal navigation">Patient navigation</nav>, Topbar: () => <header>Patient top bar</header> }));
const session = { id: 'synthetic-session', title: 'Understanding a report', messages: [], runs: [] };
const ok = (data) => ({ status: 'success', data });
beforeEach(() => { mocks.user = { id: 'synthetic-patient', fullName: 'Synthetic Patient', email: 'patient@example.test', emailVerifiedAt: '2026-01-01', roles: ['PATIENT'] }; mocks.request.mockReset(); mocks.upload.mockReset(); mocks.request.mockImplementation(async (path, options) => {
  if (path.endsWith('/config')) return ok({ enabled: true, documents: true, consentVersion: 'sabi-ai-conversation-v1', actions: [] });
  if (path.endsWith('/usage')) return ok({ today: 0, dailyAllowance: 10 });
  if (path.endsWith('/sessions')) return options?.method === 'POST' ? ok(session) : ok({ items: [] });
  if (path.endsWith('/messages')) return ok({ id: 'synthetic-run', status: 'QUEUED', sessionId: session.id });
  if (path.endsWith('/source-documents') || path.endsWith('/sources')) return ok({ items: [] });
  return ok(session);
}); });
const open = () => render(<MemoryRouter><ZoomProvider><SabiAiPage /></ZoomProvider></MemoryRouter>);
describe('patient portal Sabi AI host integration', () => {
  it('provides the existing email-verification recovery route for a legacy unverified patient', async () => {
    mocks.user.emailVerifiedAt = null;
    open(); await screen.findByRole('heading', { name: 'What would you like to understand?' });
    expect(screen.getByRole('complementary', { name: 'Email verification' })).toHaveTextContent('Confirm your email to use Sabi AI.');
    expect(screen.getByRole('link', { name: 'Request a verification link' })).toHaveAttribute('href', '/verify-email');
  });

  it('does not ask a verified patient to verify again', async () => {
    open(); await screen.findByRole('heading', { name: 'What would you like to understand?' });
    expect(screen.queryByRole('complementary', { name: 'Email verification' })).not.toBeInTheDocument();
  });
  it('keeps the existing portal shell and uses its signed-in authenticated API', async () => {
    const { container } = open(); await screen.findByRole('heading', { name: 'What would you like to understand?' });
    expect(screen.getByRole('navigation', { name: 'Patient portal navigation' })).toBeInTheDocument();
    expect(screen.getByText('Patient top bar')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Patient')).toBeInTheDocument();
    expect(container.querySelector('.sabi-ai-embedded')).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith('/api/v1/ai/config', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it('submits only the explicit question through the existing transport, not a patient chart or credential', async () => {
    open(); await screen.findByRole('heading', { name: 'What would you like to understand?' });
    fireEvent.change(screen.getByLabelText('Your message to Sabi'), { target: { value: 'Explain the word report.' } });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(mocks.request.mock.calls.some(([p]) => p.endsWith('/messages'))).toBe(true));
    const [, options] = mocks.request.mock.calls.find(([p]) => p.endsWith('/messages'));
    expect(options.body).toEqual({ message: 'Explain the word report.', clientMessageId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    expect(JSON.stringify(options.body)).not.toMatch(/patientId|accessToken|tenant|organization/);
  });
  it('shows backend failure without inventing an answer or removing portal navigation', async () => {
    mocks.request.mockRejectedValue(new Error('The service could not be reached.')); open();
    await screen.findByText('The service could not be reached.');
    expect(screen.getByRole('navigation', { name: 'Patient portal navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
