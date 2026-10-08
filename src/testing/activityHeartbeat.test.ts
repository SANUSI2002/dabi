import { afterEach, describe, expect, it, vi } from 'vitest';
import { startIdleTimeout as rootStart } from '../lib/idleTimeout';
// @ts-expect-error Separately bundled JavaScript portal shares the same activity policy.
import { startIdleTimeout as portalStart } from '../../apps/telemedicine/packages/shared-portal/idleTimeout.js';

describe.each([['root', rootStart], ['portal', portalStart]])('%s authenticated activity heartbeat', (_name, start) => {
  let stop: (() => void) | undefined;
  afterEach(() => { stop?.(); vi.useRealTimers(); });
  const setup = (signedIn = () => true, callback = vi.fn().mockResolvedValue(undefined)) => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    localStorage.clear();
    const idle = vi.fn();
    stop = start({ onIdle: idle, onActive: callback, isSignedIn: signedIn });
    return { idle, callback };
  };
  it('keeps active typing connected without extending an unattended session', async () => {
    const { idle, callback } = setup();
    for (let i = 0; i < 12; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown'));
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(10);
    expect(idle).not.toHaveBeenCalled();
    const sent = callback.mock.calls.length;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(callback).toHaveBeenCalledTimes(sent);
    expect(idle).toHaveBeenCalledOnce();
  });
  it('does not send heartbeats while signed out or after cleanup', async () => {
    const { callback } = setup(() => false);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(callback).not.toHaveBeenCalled();
    stop?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(callback).not.toHaveBeenCalled();
  });
  it('handles keepalive failure without disabling the idle deadline', async () => {
    const { idle, callback } = setup(() => true, vi.fn().mockRejectedValue(new Error('Offline')));
    await vi.advanceTimersByTimeAsync(310_000);
    expect(callback).toHaveBeenCalledOnce();
    expect(idle).toHaveBeenCalledOnce();
  });
});
