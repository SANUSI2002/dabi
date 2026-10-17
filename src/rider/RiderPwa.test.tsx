import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pwa: typeof import('./riderAppState');
let RiderPwa: typeof import('./RiderPwa').default;
let RiderPwaRoute: typeof import('./RiderPwa').RiderPwaRoute;
let added: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  vi.resetModules();
  window.history.replaceState(null, '', '/rider/login');
  document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#061d15">';
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Android Chrome' });
  added = vi.spyOn(window, 'addEventListener');
  pwa = await import('./riderAppState');
  ({ default: RiderPwa, RiderPwaRoute } = await import('./RiderPwa'));
  pwa.initializeRiderPwa();
});
afterEach(() => {
  cleanup();
  for (const [name, listener] of added.mock.calls) window.removeEventListener(name as string, listener as EventListener);
  vi.restoreAllMocks();
});
const mount = () => render(<MemoryRouter><RiderPwa /></MemoryRouter>);
function offer(outcome = 'dismissed', failure = false) {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: failure ? vi.fn().mockRejectedValue(new Error('Browser unavailable')) : vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => { window.dispatchEvent(event); });
  return event;
}

describe('Sabi Rider PWA', () => {
  it('has its own install identity, scope, deep links and valid icons', () => {
    const manifest = JSON.parse(readFileSync('public/rider/manifest.webmanifest', 'utf8'));
    expect(manifest).toMatchObject({ id: '/rider/', name: 'Sabi Rider', scope: '/rider/', start_url: '/rider/dashboard', display: 'standalone' });
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toContain('/rider/earnings');
    for (const icon of manifest.icons) expect(existsSync(`public${icon.src}`)).toBe(true);
  });
  it('switches to the rider manifest and restores the original on pharmacy navigation', () => {
    expect(document.querySelector('link[rel=manifest]')).toHaveAttribute('href', '/rider/manifest.webmanifest');
    expect(document.querySelector('meta[name=apple-mobile-web-app-title]')).toHaveAttribute('content', 'Sabi Rider');
    pwa.setRiderManifest('/rider/offers');
    pwa.setRiderManifest('/pharmacy/login');
    expect(document.querySelector('link[rel=manifest]')).toHaveAttribute('href', '/manifest.webmanifest');
    expect(document.querySelector('meta[name=theme-color]')).toHaveAttribute('content', '#061d15');
    expect(document.querySelector('meta[name=apple-mobile-web-app-title]')).toBeNull();
    expect(pwa.isRiderPath('/ridership')).toBe(false);
  });
  it('also selects the rider manifest when entering from another SPA route', () => {
    pwa.setRiderManifest('/');
    render(<MemoryRouter initialEntries={['/rider/register']}><RiderPwaRoute /></MemoryRouter>);
    expect(document.querySelector('link[rel=manifest]')).toHaveAttribute('href', '/rider/manifest.webmanifest');
  });
  it('captures once, prompts only on a tap, and respects dismissal', async () => {
    mount();
    const event = offer();
    expect(event.defaultPrevented).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(pwa.riderPwaState().installed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByText(/continue in your browser/)).toBeInTheDocument();
  });
  it('hides the invitation after acceptance', async () => {
    mount(); offer('accepted');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); });
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
  it('handles a rejected prompt without leaving a stuck button', async () => {
    mount(); offer('dismissed', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('could not open');
    expect(screen.getByRole('button', { name: 'Install app' })).toBeEnabled();
  });
  it('explains the actual iPhone installation path without pretending to open a prompt', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone Safari' });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
    expect(screen.getByText(/does not enable background GPS/)).toBeInTheDocument();
  });
  it('announces offline state and clears it on reconnect without submitting anything', () => {
    mount();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Nothing is sent automatically');
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('does not suppress installation or claim installs belonging to the pharmacy', () => {
    window.history.replaceState(null, '', '/pharmacy/login');
    const event = offer();
    expect(event.defaultPrevented).toBe(false);
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(pwa.riderPwaState().installed).toBe(false);
    expect(pwa.riderPwaState().canInstall).toBe(false);
  });
});
