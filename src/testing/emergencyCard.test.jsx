import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getEmergencyCard: vi.fn(), saveEmergencyCard: vi.fn(), replaceEmergencyCode: vi.fn(), getEmergencyResponder: vi.fn(), lookupEmergencySummary: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/emergencyCardApi', () => api);
const identity = vi.hoisted(() => ({ restoreSession: vi.fn(), signOut: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity', () => identity);
vi.mock('../../apps/telemedicine/packages/patient-portal/src/pages/Onboarding/login', () => ({ default: () => <p>Sign in using your own Sabi account</p> }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,synthetic'), toString: vi.fn(async () => '<svg viewBox="0 0 100 100"></svg>'), toCanvas: vi.fn(async () => {}) } }));
const { EmergencyCardSection } = await import('../../apps/telemedicine/packages/patient-portal/src/emergency/EmergencyCardSection');
const { default: EmergencyAccessPage, EmergencySummary } = await import('../../apps/telemedicine/packages/patient-portal/src/emergency/EmergencyAccessPage');
const notify = await import('../../apps/telemedicine/packages/patient-portal/src/emergency/emergencyCardNotification');
const { toServerPermissions, fromServerPermissions } = await import('../../apps/telemedicine/packages/patient-portal/src/pages/family/data');

const initial = { code: 'EC-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', version: 1, displayName: 'Ada Synthetic', sharingEnabled: false, notificationEnabled: false, scopes: { careCircle: false, hospitals: false }, consent: { version: null, at: null } };
let saved; let worker;
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  saved = structuredClone(initial);
  api.getEmergencyCard.mockImplementation(async () => saved);
  api.saveEmergencyCard.mockImplementation(async (input) => { saved = { ...saved, ...input }; return saved; });
  api.replaceEmergencyCode.mockImplementation(async () => { saved = { ...saved, code: 'EC-1111-2222-3333-4444-5555-6666', version: 2 }; return saved; });
  identity.restoreSession.mockResolvedValue({ fullName: 'Synthetic Responder', roles: ['PATIENT'] });
  api.getEmergencyResponder.mockResolvedValue({ hospitals: [] });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  window.Notification = { permission: 'default', requestPermission: vi.fn(async () => 'granted') };
  worker = { active: true, scope: window.location.origin + '/', showNotification: vi.fn(async () => {}), getNotifications: vi.fn(async () => []) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: vi.fn(async () => worker) } });
});
afterEach(() => { cleanup(); delete window.Notification; delete navigator.serviceWorker; vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('Emergency Card consent and phone behaviour', () => {
  it('does not request permission on installation, loading, preview or enabling sharing alone', async () => {
    render(<EmergencyCardSection />);
    await screen.findByText(initial.code);
    fireEvent.click(screen.getByLabelText(/Enable emergency sharing/));
    fireEvent.click(screen.getByLabelText(/Your Care Circle/));
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I agree to share/));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await screen.findByText('Emergency Card preferences saved.');
    expect(api.saveEmergencyCard).toHaveBeenCalledWith(expect.objectContaining({ sharingEnabled: true, notificationEnabled: false, consentVersion: 'emergency-card-v1' }));
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it('saves separate notification preferences despite denied permission; disabling notifications does not disable sharing', async () => {
    saved = { ...initial, sharingEnabled: true, scopes: { careCircle: true, hospitals: false } };
    Notification.requestPermission.mockResolvedValue('denied');
    const close = vi.fn(); worker.getNotifications.mockResolvedValue([]);
    render(<EmergencyCardSection />); await screen.findByText(initial.code);
    worker.getNotifications.mockResolvedValue([{ close }]);
    fireEvent.click(screen.getByLabelText(/Enable Emergency Card notification/));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await screen.findByRole('alert');
    expect(saved).toMatchObject({ sharingEnabled: true, notificationEnabled: true });
    expect(worker.showNotification).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/Enable Emergency Card notification/));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await screen.findByText('Emergency Card preferences saved.');
    expect(saved).toMatchObject({ sharingEnabled: true, notificationEnabled: false });
    expect(close).toHaveBeenCalledOnce();
  });

  it('uses one stable tag, name/code only, no repeating sends or duplicate notifications', async () => {
    saved = { ...initial, notificationEnabled: true };
    const { rerender } = render(<EmergencyCardSection />); await screen.findByText(initial.code);
    expect(worker.showNotification).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show Emergency Card notification' }));
    await screen.findByText(/You can dismiss it/);
    expect(worker.showNotification).toHaveBeenCalledWith('Sabi Emergency Card', expect.objectContaining({ tag: 'sabi-emergency-card', renotify: false, requireInteraction: true, body: expect.stringContaining(initial.code), data: { kind: 'sabi-emergency-card', url: expect.stringContaining('/emergency-access#code=') } }));
    expect(JSON.stringify(worker.showNotification.mock.calls)).not.toMatch(/allerg|diagnos|medication/);
    rerender(<EmergencyCardSection />);
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show Emergency Card notification' }));
    await waitFor(() => expect(worker.showNotification).toHaveBeenCalledTimes(2));
    expect(worker.showNotification.mock.calls[1][1].tag).toBe(worker.showNotification.mock.calls[0][1].tag);
  });

  it('requires confirmation before replacement; invalidates old cards and replaces this device’s visible notification', async () => {
    saved = { ...initial, notificationEnabled: true }; Notification.permission = 'granted';
    const close = vi.fn(); worker.getNotifications.mockResolvedValue([{ close }]);
    render(<EmergencyCardSection />); await screen.findByText(initial.code);
    fireEvent.click(screen.getByRole('button', { name: 'Replace emergency code' }));
    expect(api.replaceEmergencyCode).not.toHaveBeenCalled();
    expect(screen.getByText(/Previous codes, downloaded cards/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    await screen.findByText(/Emergency code replaced/);
    expect(api.replaceEmergencyCode).toHaveBeenCalledWith(1);
    expect(close).toHaveBeenCalledOnce();
    expect(worker.showNotification.mock.calls[0][1].body).toContain(saved.code);
    expect(worker.showNotification.mock.calls[0][1].body).not.toContain(initial.code);
  });

  it('handles unsupported browsers without removing download/sharing controls', async () => {
    delete window.Notification;
    render(<EmergencyCardSection />); await screen.findByText(initial.code);
    expect(screen.getByText(/Notifications are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download lock-screen card' })).toBeEnabled();
    expect(screen.getByLabelText(/Enable emergency sharing/)).toBeEnabled();
  });

  it('explains iOS Home Screen requirements even when Notification is absent, without asking permission', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    try {
      const notification = window.Notification; delete window.Notification;
      expect(notify.notificationSupport()).toMatchObject({ available: false, installRequired: true });
      window.Notification = notification;
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
      expect(notify.notificationSupport()).toMatchObject({ available: true, installRequired: false });
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'userAgent', descriptor); else delete navigator.userAgent;
      delete navigator.standalone;
    }
  });

  it('builds a real application URL with a fragment identifier, never medical data or a token', () => {
    const url = new URL(notify.emergencyAccessUrl(initial.code, 'https://actual.example', '/patient/'));
    expect(url.origin).toBe('https://actual.example'); expect(url.pathname).toBe('/patient/emergency-access');
    expect(url.search).toBe(''); expect(new URLSearchParams(url.hash.slice(1)).get('code')).toBe(initial.code);
  });

  it('updates an existing visible card after a name/code change, but never recreates a dismissed card', async () => {
    Notification.permission = 'granted';
    worker.getNotifications.mockResolvedValue([{ body: 'Old card', close: vi.fn() }]);
    await notify.syncVisibleEmergencyNotification({ ...initial, notificationEnabled: true });
    expect(worker.showNotification).toHaveBeenCalledOnce();
    worker.getNotifications.mockResolvedValue([]);
    await notify.syncVisibleEmergencyNotification({ ...initial, notificationEnabled: true });
    expect(worker.showNotification).toHaveBeenCalledOnce();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('never automatically grants Emergency Summary with ordinary Care Circle levels', () => {
    expect(toServerPermissions({ vitals: true }, 'viewer')).toEqual(['VITALS']);
    expect(toServerPermissions({ emergencySummary: true }, 'emergency-only')).toEqual(['EMERGENCY_SUMMARY']);
    expect(fromServerPermissions([]).emergencySummary).toBe(false);
    expect(fromServerPermissions(['EMERGENCY_SUMMARY']).emergencySummary).toBe(true);
  });
});

describe('controlled responder entry and read-only summary', () => {
  const summary = { identification: { name: 'Synthetic Authorized Patient' }, allergies: { state: 'UNKNOWN', items: [], verification: 'UNKNOWN' }, bloodGroup: { value: null, verification: 'UNKNOWN' }, medications: { state: 'UNKNOWN', items: [], patientReported: [] }, conditions: { items: [] }, contacts: [], lastUpdatedAt: null };
  it('clears an authorized summary on code changes and ignores responses from an abandoned lookup', async () => {
    window.history.replaceState(null, '', '/emergency-access#code=' + initial.code);
    api.lookupEmergencySummary.mockResolvedValueOnce({ summary, access: { at: null } });
    render(<MemoryRouter><EmergencyAccessPage /></MemoryRouter>);
    const button = await screen.findByRole('button', { name: 'View emergency summary' });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    await screen.findByRole('region', { name: 'Read-only emergency summary' });
    fireEvent.change(screen.getByLabelText('Patient emergency code'), { target: { value: 'EC-1111-2222-3333-4444-5555-6666' } });
    expect(screen.queryByText(summary.identification.name)).not.toBeInTheDocument();
    let resolve; api.lookupEmergencySummary.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    fireEvent.click(button);
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    fireEvent.change(screen.getByLabelText('Patient emergency code'), { target: { value: initial.code } });
    resolve({ summary, access: { at: null } });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText(summary.identification.name)).not.toBeInTheDocument();
  });

  it('asks signed-out responders to sign in and displays no patient identity or medical information', async () => {
    identity.restoreSession.mockResolvedValue(null);
    render(<MemoryRouter><EmergencyAccessPage /></MemoryRouter>);
    await screen.findByText('Sign in using your own Sabi account');
    expect(api.lookupEmergencySummary).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Read-only emergency summary' })).not.toBeInTheDocument();
  });

  it('prefills then removes the code from the URL; denial never renders medical data', async () => {
    window.history.replaceState(null, '', '/emergency-access#code=' + initial.code);
    api.lookupEmergencySummary.mockRejectedValue(new Error('Emergency information is unavailable or your account is not authorised to access it.'));
    render(<MemoryRouter><EmergencyAccessPage /></MemoryRouter>);
    await screen.findByRole('button', { name: 'View emergency summary' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'View emergency summary' })).toBeEnabled());
    expect(screen.getByLabelText('Patient emergency code')).toHaveValue(initial.code);
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'View emergency summary' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('region', { name: 'Read-only emergency summary' })).not.toBeInTheDocument();
  });

  it('distinguishes unknown allergies from explicit no-known-allergies and warns about blood testing', () => {
    const summary = { identification: { name: 'Synthetic Patient' }, allergies: { state: 'UNKNOWN', items: [], verification: 'UNKNOWN' }, bloodGroup: { value: 'A+', verification: 'PATIENT_REPORTED' }, medications: { state: 'UNKNOWN', items: [], patientReported: [] }, conditions: { items: [] }, contacts: [], lastUpdatedAt: null };
    const { rerender } = render(<EmergencySummary summary={summary} access={{ at: null }} />);
    expect(screen.getByText(/Allergy information is unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm with clinical testing/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<EmergencySummary summary={{ ...summary, allergies: { state: 'NO_KNOWN_RECORDED', items: [], verification: 'PATIENT_REPORTED' } }} access={{ at: null }} />);
    expect(screen.getByText('No known allergies explicitly recorded.')).toBeInTheDocument();
  });
});
