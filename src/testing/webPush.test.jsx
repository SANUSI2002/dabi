import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({ authorizedRequest: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity', () => identity);
const api = vi.hoisted(() => ({ updateNotificationSettings: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/notificationsApi', () => api);

const push = await import('../../apps/telemedicine/packages/patient-portal/src/pwa/pushNotifications.js');
const { DeviceNotificationsCard } = await import('../../apps/telemedicine/packages/patient-portal/src/pages/notification-settings/DeviceNotificationsCard.jsx');

const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const subscription = { endpoint: 'https://push.example.test/device-1', toJSON: () => ({ endpoint: 'https://push.example.test/device-1', keys: { p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) } }), unsubscribe: vi.fn(async () => true) };
let current;
function browserWithPush(permission = 'default') {
  current = null;
  const pushManager = { getSubscription: vi.fn(async () => current), subscribe: vi.fn(async () => { current = subscription; return subscription; }) };
  Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  window.PushManager = function PushManager() {};
  window.Notification = { permission, requestPermission: vi.fn(async () => { window.Notification.permission = 'granted'; return 'granted'; }) };
  return pushManager;
}
const devices = () => (current ? [{ endpoint: current.endpoint }] : []);
const settings = { preferences: { pushCategories: ['MEDICATION', 'APPOINTMENT', 'CARE'] } };

beforeEach(() => {
  identity.authorizedRequest.mockReset();
  identity.authorizedRequest.mockImplementation(async (url, options = {}) => {
    if (url.endsWith('/config')) return { data: { available: true, publicKey: PUBLIC_KEY, devices: devices() } };
    if (url.endsWith('/test')) return { data: { sent: 1 } };
    if (options.method === 'DELETE') { current = null; return { data: { subscribed: false } }; }
    return { data: { subscribed: true } };
  });
});
afterEach(() => { cleanup(); delete window.PushManager; delete window.Notification; delete window.navigator.serviceWorker; });

describe('phone notifications on this device', () => {
  it('converts the server key to the bytes the browser needs', () => {
    expect(push.keyBytes(PUBLIC_KEY)).toHaveLength(65);
  });

  it('asks permission, subscribes and registers the device, then offers a test and turning it off', async () => {
    const manager = browserWithPush();
    render(<MemoryRouter><DeviceNotificationsCard settings={settings} onChanged={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
    expect(await screen.findByText('Notifications are on for this device.')).toBeInTheDocument();
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(manager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(identity.authorizedRequest).toHaveBeenCalledWith('/api/v1/notifications/push/subscriptions', { method: 'POST', body: subscription.toJSON() });

    fireEvent.click(screen.getByRole('button', { name: /Send a test/ }));
    expect(await screen.findByText(/Test sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off on this device' }));
    expect(await screen.findByRole('button', { name: 'Turn on notifications' })).toBeInTheDocument();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('explains blocked notifications and iPhones that need the app installed first', async () => {
    browserWithPush('denied');
    render(<MemoryRouter><DeviceNotificationsCard settings={settings} onChanged={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByText('Notifications are blocked')).toBeInTheDocument();
    cleanup();
    delete window.PushManager;
    const ua = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' });
    render(<MemoryRouter><DeviceNotificationsCard settings={settings} onChanged={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByText('Install Sabi first')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How to install' })).toHaveAttribute('href', '/install');
    if (ua) Object.defineProperty(window.navigator, 'userAgent', ua); else delete window.navigator.userAgent;
  });

  it('chooses which kinds of update appear as notifications', async () => {
    browserWithPush();
    const onChanged = vi.fn();
    api.updateNotificationSettings.mockResolvedValue({ preferences: { pushCategories: ['MEDICATION', 'CARE'] } });
    render(<MemoryRouter><DeviceNotificationsCard settings={settings} onChanged={onChanged} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Appointment updates/ }));
    await waitFor(() => expect(api.updateNotificationSettings).toHaveBeenCalledWith({ pushCategories: ['MEDICATION', 'CARE'] }));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('service worker add-on', () => {
  function worker() {
    const listeners = {};
    const shown = [];
    const opened = [];
    const scope = {
      registration: { scope: 'https://telemedicine.sabihealth.test/', showNotification: vi.fn(async (title, options) => { shown.push({ title, ...options }); }) },
      clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async (url) => { opened.push(url); }) },
      location: { origin: 'https://telemedicine.sabihealth.test' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    const source = fs.readFileSync(path.resolve('apps/telemedicine/packages/shared-portal/public/push-sw.js'), 'utf8');
    new Function('self', 'fetch', source)(scope, scope.fetch = vi.fn(async () => ({ json: async () => ({ data: { message: 'Recorded: dose taken at 8:05 am. Well done.' } }) })));
    const dispatch = async (type, event) => { let work; listeners[type]({ ...event, waitUntil: (p) => { work = p; } }); await work; };
    return { dispatch, shown, opened, scope };
  }

  it('shows a reminder with its buttons and answers Taken without opening the app', async () => {
    const sw = worker();
    await sw.dispatch('push', { data: { json: () => ({ title: 'Time for your medicine', body: 'Your morning medicine dose (8:00 am).', tag: 'dose-1', url: '/medications', actions: [{ action: 'taken', title: 'Taken' }, { action: 'snooze', title: 'Remind me later' }], actionToken: 'signed.token' }) } });
    expect(sw.shown[0]).toMatchObject({ title: 'Time for your medicine', tag: 'dose-1', actions: [{ action: 'taken', title: 'Taken' }, { action: 'snooze', title: 'Remind me later' }], icon: 'https://telemedicine.sabihealth.test/pwa-192x192.png' });

    const notification = { tag: 'dose-1', data: sw.shown[0].data, close: vi.fn() };
    await sw.dispatch('notificationclick', { action: 'taken', notification });
    expect(sw.scope.fetch).toHaveBeenCalledWith('https://telemedicine.sabihealth.test/api/v1/notifications/push/action', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'signed.token', action: 'taken' }) }));
    expect(sw.shown[1]).toMatchObject({ title: 'Sabi Health', body: 'Recorded: dose taken at 8:05 am. Well done.', tag: 'dose-1' });
    expect(sw.opened).toHaveLength(0);
  });

  it('tapping the notification opens Sabi on its page', async () => {
    const sw = worker();
    await sw.dispatch('notificationclick', { action: '', notification: { tag: 'x', data: { url: '/appointments' }, close: vi.fn() } });
    expect(sw.opened).toEqual(['https://telemedicine.sabihealth.test/appointments']);
  });
});
