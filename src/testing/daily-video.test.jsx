import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ create: vi.fn(), frames: [] }));
vi.mock('@daily-co/daily-js', () => ({ default: { createFrame: mock.create } }));
import DailyConsultation, { validVideoSession } from '../../apps/telemedicine/packages/shared-video/DailyConsultation';
const session = { url: 'https://sabihealth.daily.co/sabi-v-' + 'a'.repeat(32), token: 'synthetic-token-for-tests', expiresAt: new Date(Date.now() + 3600000).toISOString() };
afterEach(() => { cleanup(); vi.useRealTimers(); mock.frames = []; mock.create.mockReset(); });
function mount({ enabled = true, join = vi.fn().mockResolvedValue(session), check = vi.fn().mockResolvedValue({ eligible: true }), close = vi.fn() } = {}) {
  mock.create.mockImplementation(() => { const frame = { on: vi.fn().mockReturnThis(), join: vi.fn().mockResolvedValue({}), destroy: vi.fn().mockResolvedValue({}) }; mock.frames.push(frame); return frame; });
  const view = render(<StrictMode><DailyConsultation appointmentId="synthetic" getConfig={async () => ({ enabled })} joinSession={join} checkSession={check} onClose={close} /></StrictMode>);
  return { ...view, join, check, close };
}
async function connect() {
  await waitFor(() => expect(screen.queryByText('Checking video availability…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Join video and chat' }));
}
describe('Daily call UI lifecycle', () => {
  it('requires explicit consent and creates exactly one frame under StrictMode', async () => {
    const view = mount();
    await waitFor(() => expect(screen.queryByText('Checking video availability…')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Join video and chat' })).toBeDisabled();
    await connect(); await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    expect(view.join).toHaveBeenCalledWith('synthetic', { providerConsent: true });
    expect(mock.frames[0].join).toHaveBeenCalledWith({ url: session.url, token: session.token });
    view.unmount(); await waitFor(() => expect(mock.frames[0].destroy).toHaveBeenCalledTimes(1));
  });
  it('disables calls when the backend is not enabled', async () => {
    const view = mount({ enabled: false });
    await screen.findByText('Video service is not enabled yet. Please contact Sabi support.');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Join video and chat' })).toBeDisabled(); expect(view.join).not.toHaveBeenCalled();
  });
  it('shows denied access and supports an explicit retry without a frame', async () => {
    mount({ join: vi.fn().mockRejectedValue(new Error('The call opens 10 minutes before the appointment.')) });
    await connect(); await screen.findByText('The call opens 10 minutes before the appointment.');
    expect(mock.create).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Reconnect' })).toBeEnabled();
  });
  it('does not create a frame when a join response arrives after closing', async () => {
    let resolve; const view = mount({ join: vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; })) });
    await connect(); await waitFor(() => expect(view.join).toHaveBeenCalled()); view.unmount();
    await act(async () => resolve(session)); expect(mock.create).not.toHaveBeenCalled();
  });
  it('closes with Escape and does not place tokens in the rendered DOM', async () => {
    const view = mount(); await connect(); await waitFor(() => expect(mock.create).toHaveBeenCalled());
    expect(document.body.textContent).not.toContain(session.token);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(view.close).toHaveBeenCalled();
  });
  it.each(['https://evil.test/call', 'https://sabihealth.daily.co.evil.test/call', 'http://sabihealth.daily.co/call', session.url + '?token=exposed'])('rejects invalid provider URL %s', (url) => {
    expect(validVideoSession({ ...session, url })).toBe(false);
  });
});
