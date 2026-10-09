import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ dosesForDay: vi.fn(), recordDose: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/notificationsApi', async (original) => ({ ...(await original()), ...api }));

const { MedicationsCard } = await import('../../apps/telemedicine/packages/patient-portal/src/pages/dashboard/components/MedicationsCard.jsx');

const dose = { id: 'd1', localTime: '08:00', status: 'NOT_CONFIRMED', confirmedAt: null, confirmedVia: null, medicine: { name: 'Synthetic Amlodipine', dosage: '5 mg', instructions: 'After food' } };
const evening = { ...dose, id: 'd2', localTime: '20:00', status: 'TAKEN', confirmedAt: '2026-10-08T19:05:00Z', confirmedVia: 'WHATSAPP', medicine: { name: 'Synthetic Metformin' } };
const show = () => render(<MemoryRouter><MedicationsCard /></MemoryRouter>);

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
afterEach(cleanup);

describe('dashboard Medications card', () => {
  it("lists today's doses and counts the ones still to take", async () => {
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', doses: [dose, evening] });
    show();
    expect(await screen.findByText('Synthetic Amlodipine')).toBeInTheDocument();
    expect(api.dosesForDay).toHaveBeenCalledWith();
    expect(screen.getByText('8:00 am · After food')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 remaining' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark as Taken' })).toHaveLength(1);
  });

  it('shows a dose confirmed on WhatsApp as taken', async () => {
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', doses: [evening] });
    show();
    expect(await screen.findByText('8:00 pm · Taken on WhatsApp')).toBeInTheDocument();
    expect(screen.getByLabelText('Taken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0 remaining' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Taken' })).not.toBeInTheDocument();
  });

  it('records a dose as taken', async () => {
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', doses: [dose] });
    api.recordDose.mockResolvedValue({ alreadyRecorded: false, dose: { ...dose, status: 'TAKEN', confirmedAt: '2026-10-08T07:05:00Z', confirmedVia: 'APP' } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as Taken' }));
    await waitFor(() => expect(api.recordDose).toHaveBeenCalledWith('d1', 'TAKEN'));
    expect(await screen.findByText('8:00 am · Taken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0 remaining' })).toBeInTheDocument();
  });

  it('links to My Medicines', async () => {
    api.dosesForDay.mockResolvedValue({ day: '2026-10-08', doses: [] });
    show();
    expect(await screen.findByText('No medications added yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Medicines' })).toHaveAttribute('href', '/medications');
  });
});
