import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@daily-co/daily-js', () => ({ default: { createFrame: mock.create } }));
import DailyConsultation from '../../apps/telemedicine/packages/shared-video/DailyConsultation';

const session = { url: 'https://sabihealth.daily.co/sabi-v-' + 'a'.repeat(32), token: 'synthetic-token-for-tests', expiresAt: new Date(Date.now() + 3600000).toISOString() };
afterEach(() => { cleanup(); mock.create.mockReset(); });
function mount(props = {}, join = vi.fn().mockResolvedValue(session)) {
  mock.create.mockImplementation(() => { const frame = { on: vi.fn(() => frame), join: vi.fn().mockResolvedValue({}), destroy: vi.fn().mockResolvedValue({}) }; return frame; });
  render(<DailyConsultation appointmentId="synthetic" getConfig={async () => ({ enabled: true })} joinSession={join} checkSession={vi.fn().mockResolvedValue({})} onClose={vi.fn()} {...props} />);
  return join;
}
const ready = () => waitFor(() => expect(screen.queryByText('Checking video availability…')).not.toBeInTheDocument());

describe('telemedicine consent before joining', () => {
  it('tells patients what they consent to, including emergencies and how their information is used', async () => {
    mount({ role: 'patient' }); await ready();
    const notice = screen.getByRole('region', { name: 'Before you join' });
    expect(notice).toHaveTextContent('not for emergencies');
    expect(notice).toHaveTextContent('call 112');
    expect(notice).toHaveTextContent('voluntarily and with your consent');
    expect(notice).toHaveTextContent('The call is not recorded');
    expect(screen.getByRole('checkbox', { name: /I consent to this telemedicine consultation/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Join video and chat' })).toBeDisabled();
  });

  it('asks a parent or guardian to confirm when joining for a family member', async () => {
    mount({ role: 'patient', forName: 'Synthetic Child' }); await ready();
    expect(screen.getByRole('region', { name: 'Before you join' })).toHaveTextContent('You are joining for Synthetic Child. You confirm you are their parent or guardian');
  });

  it('gives professionals their own terms and records that version', async () => {
    const join = mount({ role: 'professional' }); await ready();
    expect(screen.getByRole('region', { name: 'Before you join' })).toHaveTextContent('Do not record the call or take screenshots');
    fireEvent.click(screen.getByRole('checkbox', { name: /agree to conduct this consultation on these terms/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Join video and chat' }));
    await waitFor(() => expect(join).toHaveBeenCalledWith('synthetic', { providerConsent: true, consentVersion: 'telemedicine-professional-v1' }));
  });

  it('still joins on a server that does not know consent versions yet', async () => {
    const join = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Invalid input data'), { status: 400 }))
      .mockResolvedValue(session);
    mount({ role: 'patient' }, join); await ready();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Join video and chat' }));
    await waitFor(() => expect(mock.create).toHaveBeenCalled());
    expect(join.mock.calls.map(([, body]) => body)).toEqual([{ providerConsent: true, consentVersion: 'telemedicine-patient-v1' }, { providerConsent: true }]);
  });

  it('does not retry when the server refuses the consent itself', async () => {
    const join = vi.fn().mockRejectedValue(Object.assign(new Error('Please confirm the video privacy notice.'), { status: 400, code: 'VIDEO_CONSENT_REQUIRED' }));
    mount({ role: 'patient' }, join); await ready();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Join video and chat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please confirm the video privacy notice.');
    expect(join).toHaveBeenCalledTimes(1);
  });
});
