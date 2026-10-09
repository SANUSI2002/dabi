import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/telemedicine/packages/patient-portal/src/pages/hospitals/hospitalShared', () => ({ PageShell: ({ children }) => <main>{children}</main> }));

const userAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
let pwa; let ui; let store;
async function load() {
  vi.resetModules();
  pwa = await import('../../apps/telemedicine/packages/shared-portal/pwa/installPrompt.js');
  ui = await import('../../apps/telemedicine/packages/patient-portal/src/pwa/InstallApp.jsx');
  store = await import('../../apps/telemedicine/packages/patient-portal/src/notifications/notificationStore.js');
  pwa.captureInstallPrompt();
}
/** What Chrome sends when the app becomes installable. */
function offerInstall(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => { window.dispatchEvent(event); });
  return event;
}
const showSheet = () => { render(<MemoryRouter><ui.InstallAppSheet /></MemoryRouter>); act(() => { vi.advanceTimersByTime(3000); }); };

beforeEach(async () => {
  window.localStorage.clear(); window.sessionStorage.clear();
  vi.useFakeTimers();
  await load();
});
afterEach(() => {
  cleanup(); vi.useRealTimers();
  if (userAgent) Object.defineProperty(window.navigator, 'userAgent', userAgent); else delete window.navigator.userAgent;
});

describe('install the Sabi app', () => {
  it('keeps the browser offer and replays it when the patient taps Install', async () => {
    const event = offerInstall('accepted');
    expect(event.defaultPrevented).toBe(true); // our invitation instead of the browser's mini bar
    showSheet();
    expect(screen.getByRole('dialog', { name: 'Get the Sabi app' })).toBeInTheDocument();
    expect(screen.getByText('Opens from your home screen, fast on slow networks.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); });
    expect(event.prompt).toHaveBeenCalled();
    expect(pwa.installState().installed).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Not now" hides it for a week and it shows once per visit', () => {
    offerInstall();
    showSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pwa.dismissedRecently()).toBe(true);
    cleanup();
    showSheet();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the Safari steps on iPhone, where there is no install button', () => {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
    showSheet();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('stays quiet when the browser cannot install, and adds an install item to the bell', () => {
    showSheet();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getNotifications()).toEqual([expect.objectContaining({ title: 'Install the Sabi app', link: '/install', dedupeKey: 'install-app' })]);
  });

  it('never asks once the app is installed', () => {
    offerInstall();
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    showSheet();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    render(<MemoryRouter><ui.InstallAppPage /></MemoryRouter>);
    expect(screen.getByText(/Sabi is installed on this device/)).toBeInTheDocument();
  });

  it('the install page explains what the app gives and installs from there too', async () => {
    const event = offerInstall('dismissed');
    render(<MemoryRouter><ui.InstallAppPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Sabi Health, right on your home screen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick on weak connections' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); });
    expect(event.prompt).toHaveBeenCalled();
    expect(screen.getByText(/you can install it any time from this page/)).toBeInTheDocument();
  });
});
