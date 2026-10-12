import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcProvider } from './kit';
import { RuntimeSettingsPage, SubscriptionInvoicesPage } from './RuntimePages';
import RiderOperationsPage from './RiderOperationsPage';
import type { CcMe } from './api';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), request: vi.fn() }));
vi.mock('./api', async (original) => ({ ...await original(), ccGet: mocks.get, ccPost: mocks.post }));
vi.mock('./api.platform', () => ({ tenants: async () => ({ items: [] }) }));
vi.mock('@/identity/liveIdentity', () => ({ liveApiRequest: mocks.request, liveStepUpMfa: vi.fn() }));
function mount(ui: React.ReactNode, permissions: string[]) { return render(<MemoryRouter><CcProvider me={{ id: 'operator', permissions, roles: [], name: 'Operator' } as unknown as CcMe}>{ui}</CcProvider></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); });
describe('Command Centre operational configuration', () => {
  it('saves versioned settings with a reason instead of a local fixture', async () => {
    mocks.get.mockResolvedValue({ version: 3, supportEmail: 'support@sabihealth.org', infoEmail: 'info@sabihealth.org', trackingRetentionDays: 30, updatedAt: new Date().toISOString() });
    mocks.request.mockResolvedValue({ data: {} });
    mount(<RuntimeSettingsPage />, ['platform.ops.read', 'platform.settings.manage']);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit settings' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Reason/ }), { target: { value: 'Synthetic settings acceptance.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalled());
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toMatchObject({ expectedVersion: 3, trackingRetentionDays: 30, reason: 'Synthetic settings acceptance.' });
  });
  it('shows the private rider share only to authorised operations users', async () => {
    mocks.get.mockImplementation(async (path) => path.endsWith('/policy') ? { version: 1, published: false, riderShareBps: 8000, maxOpenAssignments: 1, maxPickupKm: 5, automaticDispatch: false, updatedAt: new Date().toISOString() } : { items: [], total: 0, pages: 1 });
    mount(<RiderOperationsPage />, ['platform.ops.read', 'platform.pricing.manage']);
    fireEvent.click(screen.getByRole('tab', { name: 'Pay & dispatch' }));
    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Set kilometre rates/ })).toHaveAttribute('href', '/command-center/sabi-health/delivery-pricing');
  });
  it('shows real invoice emptiness and no fabricated payment amounts', async () => {
    mocks.get.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
    mount(<SubscriptionInvoicesPage />, ['platform.finance.read']);
    expect(await screen.findByText('No subscription invoices yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Issue invoice' })).not.toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });
});
