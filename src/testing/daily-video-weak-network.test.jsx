import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ create: vi.fn(), frames: [] }));
vi.mock('@daily-co/daily-js', () => ({ default: { createFrame: mock.create } }));
import DailyConsultation, { callTiming, slowConnection } from '../../apps/telemedicine/packages/shared-video/DailyConsultation';

const session = { url: 'https://sabihealth.daily.co/sabi-v-' + 'a'.repeat(32), token: 'synthetic-token-for-tests', expiresAt: new Date(Date.now() + 3600000).toISOString() };
const original = { ...callTiming };
// Each frame joins with the next scripted outcome: 'ok' or an error to reject with.
function frames(outcomes) {
  mock.create.mockImplementation((_host, options) => {
    const outcome = outcomes[mock.frames.length] ?? 'ok';
    const handlers = {};
    const frame = {
      options, handlers,
      on: vi.fn((name, handler) => { handlers[name] = handler; return frame; }),
      join: vi.fn(() => outcome === 'ok' ? Promise.resolve({}).then(() => handlers['joined-meeting']?.()) : Promise.reject(outcome)),
      destroy: vi.fn().mockResolvedValue({}), updateSendSettings: vi.fn().mockResolvedValue({}), updateReceiveSettings: vi.fn().mockResolvedValue({}), setLocalVideo: vi.fn(),
    };
    mock.frames.push(frame);
    return frame;
  });
}
function mount({ check = vi.fn().mockResolvedValue({ eligible: true }) } = {}) {
  render(<DailyConsultation appointmentId="synthetic" getConfig={async () => ({ enabled: true })} joinSession={vi.fn().mockResolvedValue(session)} checkSession={check} onClose={vi.fn()} />);
  return { check };
}
async function join(name = 'Join video and chat') {
  await waitFor(() => expect(screen.queryByText('Checking video availability…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name }));
}
const latest = () => mock.frames.at(-1);
beforeEach(() => { callTiming.retryDelays = [0, 0]; callTiming.accessCheckMs = 20; });
afterEach(() => { cleanup(); Object.assign(callTiming, original); mock.frames = []; mock.create.mockReset(); });

describe('video calls on a weak connection', () => {
  it('retries a join that fails on the network, then connects', async () => {
    frames([new Error('network timeout'), new Error('network timeout'), 'ok']);
    mount(); await join();
    await screen.findByText('Connected · open Chat inside the call');
    expect(mock.create).toHaveBeenCalledTimes(3);
    expect(mock.frames[0].destroy).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says why when Daily refuses the call, without pointless retries', async () => {
    frames([{ error: { type: 'nbf-room' }, errorMsg: 'Meeting not yet started' }]);
    mount(); await join();
    expect(await screen.findByRole('alert')).toHaveTextContent("The video room isn't open yet. It opens 10 minutes before the appointment.");
    expect(mock.create).toHaveBeenCalledTimes(1);
  });

  it('gives a network explanation after the retries run out', async () => {
    frames([new Error('timeout'), new Error('timeout'), new Error('timeout')]);
    mount(); await join();
    expect(await screen.findByRole('alert')).toHaveTextContent('join with audio only');
    expect(mock.create).toHaveBeenCalledTimes(3);
  });

  it('can join with audio only, which starts light on data', async () => {
    frames(['ok']);
    mount(); await join('Join with audio only');
    await screen.findByText('Connected with audio only · open Chat inside the call');
    expect(latest().options.startVideoOff).toBe(true);
    expect(latest().updateSendSettings).toHaveBeenCalledWith({ video: 'bandwidth-optimized' });
  });

  it('lowers quality on a weak network and offers to turn video off when it is very weak', async () => {
    frames(['ok']);
    mount(); await join(); await screen.findByText('Connected · open Chat inside the call');
    expect(latest().options.startVideoOff).toBe(false);
    act(() => latest().handlers['network-quality-change']({ threshold: 'low' }));
    expect(await screen.findByText(/video quality is lowered/)).toBeInTheDocument();
    expect(latest().updateSendSettings).toHaveBeenCalledWith({ video: 'bandwidth-optimized' });
    act(() => latest().handlers['network-quality-change']({ threshold: 'very-low' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off my video' }));
    await waitFor(() => expect(latest().setLocalVideo).toHaveBeenCalledWith(false));
    act(() => latest().handlers['network-quality-change']({ threshold: 'good' }));
    await waitFor(() => expect(latest().updateSendSettings).toHaveBeenLastCalledWith({ video: 'default-video' }));
    expect(screen.queryByText(/video quality is lowered/)).not.toBeInTheDocument();
  });

  it('shows reconnecting during a drop-out instead of ending the call', async () => {
    frames(['ok']);
    mount(); await join(); await screen.findByText('Connected · open Chat inside the call');
    act(() => latest().handlers['network-connection']({ type: 'sfu', event: 'interrupted' }));
    expect(screen.getByText('Your connection dropped. Reconnecting…')).toBeInTheDocument();
    act(() => latest().handlers['network-connection']({ type: 'sfu', event: 'connected' }));
    expect(screen.queryByText('Your connection dropped. Reconnecting…')).not.toBeInTheDocument();
    expect(latest().destroy).not.toHaveBeenCalled();
  });

  it('keeps the call when an access re-check fails on the network, but ends it when access is gone', async () => {
    frames(['ok']);
    const check = vi.fn().mockRejectedValue(Object.assign(new Error('Failed to fetch'), { status: undefined }));
    mount({ check }); await join(); await screen.findByText('Connected · open Chat inside the call');
    expect(await screen.findByText("We couldn't reach Sabi to re-check your access. Your call continues.")).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    check.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your consultation access changed');
  });
});

describe('slow connection detection', () => {
  it('recommends audio only when the phone reports a slow network or data saver', () => {
    expect(slowConnection({ effectiveType: '2g' })).toBe(true);
    expect(slowConnection({ effectiveType: '4g', saveData: true })).toBe(true);
    expect(slowConnection({ effectiveType: '4g' })).toBe(false);
    expect(slowConnection(undefined)).toBe(false);
  });
});
