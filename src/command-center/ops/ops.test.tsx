import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const stepUp = vi.fn(async () => ({}));
vi.mock('@/identity/liveIdentity', () => ({ liveStepUpMfa: (...args: unknown[]) => stepUp(...(args as [])), liveApiRequest: vi.fn(), liveApiTextPost: vi.fn() }));

const api = vi.hoisted(() => ({
  getDeliveryPricing: vi.fn(),
  createPricingVersion: vi.fn(),
  simulateDelivery: vi.fn(),
  cancelPricingVersion: vi.fn(),
  openPatientAccount: vi.fn(),
  openPatientClinical: vi.fn(),
  patientAccessHistory: vi.fn(),
  listRefunds: vi.fn(),
  refundAction: vi.fn(),
}));
vi.mock('./api', async (original) => ({ ...(await original<typeof import('./api')>()), ...api }));

import { ActionDialog, CcProvider } from './kit';
import { drillTo } from './routes';
import { zonedMidnight } from './OverviewPanels';
import DeliveryPricingPage from './DeliveryPricingPage';
import PatientsPage from './PatientsPage';
import FinancePage from './FinancePage';
import type { CcMe, PricingVersion } from './api';

const me = (permissions: string[], id = 'staff-1'): CcMe => ({ id, name: 'Staff', email: 'staff@example.test', twoStepVerification: true, roles: ['SABI_TEST'], permissions });
const wrap = (node: ReactNode, permissions: string[], path = '/command-center') => render(<MemoryRouter initialEntries={[path]}><CcProvider me={me(permissions)}>{node}</CcProvider></MemoryRouter>);

const version = (overrides: Partial<PricingVersion> = {}): PricingVersion => ({
  version: 3, state: 'ACTIVE', effectiveAt: '2026-10-01T09:00:00.000Z', createdAt: '2026-10-01T09:00:00.000Z', changeReason: 'Lagos launch', createdByName: 'Ops Admin',
  currency: 'NGN', platformFeeMinor: 0, deliveryRatePerKmMinor: 20_000, baseFeeMinor: 0, includedDistanceKm: 0, minimumFeeMinor: 0, maximumFeeMinor: null, maxDistanceKm: null,
  distanceMethod: 'STRAIGHT_LINE', roadFallbackToStraightLine: false, distanceRounding: 'EXACT', feeRoundingMinor: 1, bands: [], zones: [], restrictToZones: false,
  freeDeliveryThresholdMinor: null, smallOrderThresholdMinor: null, smallOrderFeeMinor: 0, surcharges: [], quoteTtlMinutes: 15, ...overrides,
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('formatting and links', () => {
  it('turns a local date in a time zone into the right instant', () => {
    expect(zonedMidnight('2026-10-11', 'Africa/Lagos').toISOString()).toBe('2026-10-10T23:00:00.000Z');
    expect(zonedMidnight('2026-10-11', 'UTC').toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });
  it('maps API drill-downs to Command Centre pages', () => {
    expect(drillTo({ section: 'orders', filter: { status: 'PAID' } })).toBe('/command-center/sabi-health/orders?status=PAID');
    expect(drillTo({ section: 'pharmacies', filter: { tab: 'listings' } })).toBe('/command-center/pharmacy-listings');
    expect(drillTo({ section: 'patients', filter: { id: 'u-1' } })).toBe('/command-center/sabi-health/patients/u-1');
    expect(drillTo({ section: 'nowhere' })).toBeNull();
  });
});

describe('reason dialog', () => {
  it('needs a reason, then asks for the authenticator when the server requires it, and retries', async () => {
    const run = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Recent multi-factor verification is required.'), { status: 403, code: 'MFA_REQUIRED' })).mockResolvedValueOnce({ ok: true });
    const onDone = vi.fn();
    render(<ActionDialog title="Approve settlement" confirm="Approve" run={run} onDone={onDone} onClose={vi.fn()} />);
    const confirm = screen.getByRole('button', { name: 'Approve' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Totals checked against orders' } });
    fireEvent.click(confirm);
    expect(await screen.findByText(/confirm with your authenticator/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Authenticator code/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: true }));
    expect(stepUp).toHaveBeenCalledWith('123456', false);
    expect(run).toHaveBeenLastCalledWith({ reason: 'Totals checked against orders' });
  });
});

describe('delivery pricing', () => {
  it('shows the rate in force and publishes a new version in kobo with a reason', async () => {
    api.getDeliveryPricing.mockResolvedValue({ active: version(), versions: [version()], routing: { roadConfigured: false, provider: null } });
    api.createPricingVersion.mockResolvedValue(version({ version: 4, deliveryRatePerKmMinor: 25_000 }));
    wrap(<DeliveryPricingPage />, ['platform.pricing.manage']);
    expect(await screen.findByText('₦200/km')).toBeInTheDocument();
    expect(screen.getByText('₦1,000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Rate per km/), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText(/Be specific/), { target: { value: 'Fuel prices rose in October' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish version' }));
    await waitFor(() => expect(api.createPricingVersion).toHaveBeenCalled());
    expect(api.createPricingVersion.mock.calls[0][0]).toMatchObject({ deliveryRatePerKmMinor: 25_000, reason: 'Fuel prices rose in October', bands: [], zones: [] });
    expect(api.createPricingVersion.mock.calls[0][0]).not.toHaveProperty('effectiveAt');
  });

  it('runs the simulator against the draft and shows the itemised quote', async () => {
    api.getDeliveryPricing.mockResolvedValue({ active: version(), versions: [], routing: { roadConfigured: false, provider: null } });
    api.simulateDelivery.mockResolvedValue({ draft: false, basedOnVersion: 3, quote: { feeMinor: 100_000, currency: 'NGN', distanceKm: 5, billableKm: 5, method: 'STRAIGHT_LINE', ratePerKmMinor: 20_000, zone: null, band: null, freeDelivery: false, pricingVersion: 3, quotedAt: '2026-10-11T10:00:00.000Z', lines: [{ code: 'DISTANCE', label: 'Distance 5 km × ₦200/km', amountMinor: 100_000 }] } });
    wrap(<DeliveryPricingPage />, ['platform.ops.read']);
    fireEvent.click(await screen.findByRole('button', { name: /Calculate/ }));
    expect(await screen.findByText('Distance 5 km × ₦200/km')).toBeInTheDocument();
    expect(api.simulateDelivery.mock.calls[0][0]).toMatchObject({ subtotalMinor: 300_000 });
    expect(api.simulateDelivery.mock.calls[0][0].rules).toBeUndefined();
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();
  });
});

describe('patient record', () => {
  it('asks for a purpose before opening, and never shows a current location', async () => {
    api.openPatientAccount.mockResolvedValue({
      account: { id: 'p-1', patientId: 'SABI-1', name: 'Ada Patient', email: 'ada@example.test', phone: null, dateOfBirth: null, accountStatus: 'ACTIVE', emailVerifiedAt: null, phoneVerifiedAt: null, lastSignInAt: null, twoStepVerification: false, roles: ['PATIENT'] },
      sessions: [], location: { current: null, note: 'Sabi does not track where patients are.', signIns: [] }, addresses: [],
      careCircle: { caregivers: [], caresFor: [], doctors: [], dependents: [], hospitals: [] }, orders: [], payments: [], consents: { platform: [], professionals: [], documentShares: [] }, cases: [], openedAt: '2026-10-11T10:00:00.000Z',
    });
    wrap(<PatientsPage path="/command-center/sabi-health/patients/p-1" />, ['platform.patients.read'], '/command-center/sabi-health/patients/p-1');
    const open = await screen.findByRole('button', { name: 'Open account' });
    expect(open).toBeDisabled();
    expect(api.openPatientAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Order or delivery issue' }));
    fireEvent.click(open);
    expect(await screen.findByText('Sabi does not track where patients are.')).toBeInTheDocument();
    expect(api.openPatientAccount).toHaveBeenCalledWith('p-1', 'Order or delivery issue');
  });

  it('explains when the role cannot see patients instead of showing an empty page', async () => {
    wrap(<PatientsPage path="/command-center/sabi-health/patients" />, ['platform.finance.read']);
    expect(await screen.findByText(/Patient records is not part of your role/)).toBeInTheDocument();
  });
});

describe('refund maker-checker', () => {
  it('does not offer approval to the person who proposed the refund', async () => {
    api.listRefunds.mockResolvedValue({ items: [{ id: 'r-1', status: 'PROPOSED', amountMinor: 250_000, currency: 'NGN', reason: 'Out of stock', createdAt: '2026-10-11T08:00:00.000Z', proposedAt: '2026-10-11T09:00:00.000Z', proposalNote: 'Full refund', decidedAt: null, decisionNote: null, submittedAt: null, provider: null, providerRefundReference: null, providerStatus: null, failureReason: null, evidenceNote: null, refundedAt: null, proposedByUserId: 'staff-1', proposedBy: 'Staff', decidedBy: null, evidenceRecordedBy: null, order: { id: 'o-1', reference: 'SHP-1', patient: { patientId: 'SABI-1', full_name: 'Ada' } }, pharmacy: 'Synthetic Pharmacy', fulfilmentStatus: 'UNABLE_TO_FULFILL' }], total: 1, page: 1, limit: 25, pages: 1 });
    wrap(<FinancePage />, ['platform.finance.read', 'platform.finance.approve'], '/command-center/sabi-health/payments?tab=refunds');
    const approve = await screen.findByRole('button', { name: /Approve/ });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute('title', 'You proposed this refund');
  });
});
