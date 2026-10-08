import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getNotificationSettings: vi.fn(), updateNotificationSettings: vi.fn(), sendWhatsAppCode: vi.fn(), resendWhatsAppCode: vi.fn(), verifyWhatsAppCode: vi.fn(), turnOffWhatsApp: vi.fn(),
  listSchedules: vi.fn(), listScheduleSuggestions: vi.fn(), createSchedule: vi.fn(), updateSchedule: vi.fn(), stopSchedule: vi.fn(), dosesForDay: vi.fn(), recordDose: vi.fn(),
  listNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
}));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/notificationsApi', async (original) => ({ ...(await original()), ...api }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/pages/hospitals/hospitalShared', () => ({ PageShell: ({ children }) => <main>{children}</main> }));

const { NotificationSettingsPage } = await import('../../apps/telemedicine/packages/patient-portal/src/pages/notification-settings/NotificationSettingsPage.jsx');
const { MedicinesPage } = await import('../../apps/telemedicine/packages/patient-portal/src/pages/medicines/MedicinesPage.jsx');
const { NotificationsBell } = await import('../../apps/telemedicine/packages/patient-portal/src/notifications/NotificationsBell.jsx');

const base = {
  preferences: { whatsappEnabled: false, whatsappCategories: ['MEDICATION'], showMedicationDetails: false, timezone: 'Africa/Lagos', consentVersion: null, consentedAt: null },
  categories: ['MEDICATION', 'APPOINTMENT', 'CARE'],
  whatsapp: { available: true, registeredPhone: '+2348031234567', connection: null, pending: null },
};
const pending = { ...base, whatsapp: { ...base.whatsapp, pending: { phone: '+234 *** *** 4567', expiresAt: new Date(Date.now() + 600_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString(), attemptsLeft: 5 } } };
const linked = { ...base, preferences: { ...base.preferences, whatsappEnabled: true, consentedAt: '2026-10-08T10:00:00Z' }, whatsapp: { ...base.whatsapp, connection: { phone: '+234 *** *** 4567', verifiedAt: '2026-10-08T10:00:00Z' } } };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listNotifications.mockResolvedValue({ items: [] });
});
afterEach(cleanup);

describe('Settings → Notifications', () => {
  const show = () => render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);

  it('needs consent before sending a code, then verifies the number', async () => {
    api.getNotificationSettings.mockResolvedValue(base);
    api.sendWhatsAppCode.mockResolvedValue(pending);
    api.verifyWhatsAppCode.mockResolvedValue(linked);
    show();
    const phone = await screen.findByLabelText('WhatsApp number');
    expect(phone).toHaveValue('+2348031234567'); // registered number pre-filled
    const send = screen.getByRole('button', { name: 'Send code' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to receive Sabi Health notifications on WhatsApp/ }));
    fireEvent.click(send);
    await waitFor(() => expect(api.sendWhatsAppCode).toHaveBeenCalledWith('+2348031234567'));

    expect(await screen.findByText(/We sent a 6-digit code on WhatsApp/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '12a3456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    await waitFor(() => expect(api.verifyWhatsAppCode).toHaveBeenCalledWith('123456'));
    expect(await screen.findByRole('button', { name: 'Turn off WhatsApp' })).toBeInTheDocument();
    expect(screen.getByText('+234 *** *** 4567')).toBeInTheDocument();
  });

  it('shows the reason a code was refused', async () => {
    api.getNotificationSettings.mockResolvedValue(pending);
    api.verifyWhatsAppCode.mockRejectedValue(new Error('That code is not right. Check the message and try again.'));
    show();
    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right');
  });

  it('changes the number without dropping the current one, and turns WhatsApp off on request', async () => {
    api.getNotificationSettings.mockResolvedValue(linked);
    api.turnOffWhatsApp.mockResolvedValue(base);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Change number' }));
    expect(screen.getByText('Your current number keeps working until the new one is verified.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn off WhatsApp' }));
    await waitFor(() => expect(api.turnOffWhatsApp).toHaveBeenCalled());
    expect(await screen.findByLabelText('WhatsApp number')).toBeInTheDocument();
  });

  it('saves which updates go to WhatsApp and the medicine-name privacy choice', async () => {
    api.getNotificationSettings.mockResolvedValue(linked);
    api.updateNotificationSettings.mockImplementation(async (changes) => ({ ...linked, preferences: { ...linked.preferences, ...changes } }));
    show();
    fireEvent.click(await screen.findByRole('checkbox', { name: /Appointment updates/ }));
    await waitFor(() => expect(api.updateNotificationSettings).toHaveBeenCalledWith({ whatsappCategories: ['MEDICATION', 'APPOINTMENT'] }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Show medicine names/ }));
    await waitFor(() => expect(api.updateNotificationSettings).toHaveBeenLastCalledWith({ showMedicationDetails: true }));
  });

  it('says plainly when WhatsApp is not available yet', async () => {
    api.getNotificationSettings.mockResolvedValue({ ...base, whatsapp: { ...base.whatsapp, available: false } });
    show();
    expect(await screen.findByText(/WhatsApp notifications are not available yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument();
  });
});

describe('My Medicines', () => {
  const dose = { id: 'd1', scheduleId: 's1', scheduledFor: '2026-10-08T07:00:00Z', localTime: '08:00', status: 'NOT_CONFIRMED', confirmedAt: null, confirmedVia: null, medicine: { name: 'Synthetic Amlodipine', dosage: '5 mg' }, reminder: { status: 'SCHEDULED' } };
  const schedule = { id: 's1', source: 'PATIENT', name: 'Synthetic Amlodipine', dosage: '5 mg', asNeeded: false, times: ['08:00'], status: 'ACTIVE', version: 1, endDate: null };
  const suggestion = { prescriptionItemId: 'p1', medicationName: 'Synthetic Amoxicillin', dosage: '500 mg', frequency: 'TWICE_DAILY', duration: '7 days', prescriber: 'Dr Synthetic', asNeeded: false, suggestedTimes: ['08:00', '20:00'], suggestedEndDate: '2026-10-14' };
  const show = () => render(<MemoryRouter><MedicinesPage /></MemoryRouter>);
  beforeEach(() => {
    api.getNotificationSettings.mockResolvedValue(base);
    api.listSchedules.mockResolvedValue([schedule]);
    api.listScheduleSuggestions.mockResolvedValue([suggestion]);
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', timezone: 'Africa/Lagos', doses: [dose] });
  });

  it('records a dose as taken', async () => {
    api.recordDose.mockResolvedValue({ alreadyRecorded: false, dose: { ...dose, status: 'TAKEN', confirmedAt: '2026-10-08T07:05:00Z', confirmedVia: 'APP' } });
    show();
    const row = (await screen.findByText('8:00 am')).closest('li');
    fireEvent.click(within(row).getByRole('button', { name: 'Taken' }));
    await waitFor(() => expect(api.recordDose).toHaveBeenCalledWith('d1', 'TAKEN'));
    expect(await within(row).findByText('Taken')).toHaveClass('sx-badge');
    expect(within(row).queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('shows a dose confirmed on WhatsApp as such', async () => {
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', doses: [{ ...dose, status: 'TAKEN', confirmedAt: '2026-10-08T07:05:00Z', confirmedVia: 'WHATSAPP' }] });
    show();
    expect(await screen.findByText(/on WhatsApp/)).toBeInTheDocument();
  });

  it('sets up a prescribed medicine with the suggested times', async () => {
    api.createSchedule.mockResolvedValue({});
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Set up reminders' }));
    await waitFor(() => expect(api.createSchedule).toHaveBeenCalledWith({ prescriptionItemId: 'p1', times: ['08:00', '20:00'], endDate: '2026-10-14' }));
  });

  it('adds a medicine the patient takes only when needed, without times', async () => {
    api.createSchedule.mockResolvedValue({});
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a medicine' }));
    const form = screen.getByRole('form', { name: 'Add a medicine' });
    fireEvent.change(within(form).getByLabelText('Medicine'), { target: { value: 'Synthetic Paracetamol' } });
    fireEvent.click(within(form).getByRole('checkbox', { name: /only when needed/ }));
    expect(within(form).queryByText('Times to take it')).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Save medicine' }));
    await waitFor(() => expect(api.createSchedule).toHaveBeenCalledWith({ name: 'Synthetic Paracetamol', dosage: null, instructions: null, asNeeded: true }));
  });

  it('invites the patient to turn on WhatsApp reminders', async () => {
    show();
    expect(await screen.findByRole('link', { name: /Turn on WhatsApp reminders/ })).toHaveAttribute('href', '/settings/notifications');
  });
});

describe('the bell', () => {
  it('shows Sabi notifications and opens their page', async () => {
    window.localStorage.clear();
    api.listNotifications.mockResolvedValue({ items: [{ id: 'n1', title: 'Time for your medicine', message: 'Synthetic Amlodipine (5 mg), your 8:00 am dose.', category: 'MEDICATION', isRead: false, createdAt: new Date().toISOString(), link: '/medications' }] });
    api.markNotificationRead.mockResolvedValue({});
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route path="/dashboard" element={<NotificationsBell />} /><Route path="/medications" element={<p>Medicines page</p>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByText('Time for your medicine'));
    expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(await screen.findByText('Medicines page')).toBeInTheDocument();
  });
});
