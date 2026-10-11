import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/identity/liveIdentity', () => ({ liveStepUpMfa: vi.fn(), liveApiRequest: vi.fn(), liveApiTextPost: vi.fn() }));
const api = vi.hoisted(() => ({ accessState: vi.fn(), tenants: vi.fn(), listPrescriptions: vi.fn() }));
vi.mock('./api.platform', async (original) => ({ ...(await original<typeof import('./api.platform')>()), ...api }));

import { CcProvider } from './kit';
import { AccessPage, NotBuiltPage, TenantsPage, isNotBuilt } from './PlatformPages';
import { PrescriptionsPage } from './ProductPages';

const wrap = (node: ReactNode, permissions: string[]) => render(<MemoryRouter><CcProvider me={{ id: 'me-1', name: 'Me', email: 'me@example.test', twoStepVerification: true, roles: ['SABI_SUPER_ADMIN'], permissions }}>{node}</CcProvider></MemoryRouter>);
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('roles & permissions', () => {
  it('offers grant/remove for other staff but never for yourself', async () => {
    api.accessState.mockResolvedValue({
      roles: [{ code: 'SABI_FINANCE', description: 'Finance', members: 1, permissions: [{ code: 'platform.finance.read', description: 'See money' }] }],
      staff: [
        { id: 'me-1', name: 'Me', email: 'me@example.test', accountStatus: 'ACTIVE', lastSignInAt: null, twoStepVerification: true, roles: ['SABI_SUPER_ADMIN'] },
        { id: 'u-2', name: 'Sade Support', email: 'sade@example.test', accountStatus: 'ACTIVE', lastSignInAt: null, twoStepVerification: false, roles: ['SABI_SUPPORT'] },
      ],
      grantable: ['SABI_SUPPORT', 'SABI_FINANCE'], note: 'Invite new staff from Internal users.',
    });
    wrap(<AccessPage />, ['platform.staff.invite']);
    const sade = (await screen.findByText('Sade Support')).closest('tr') as HTMLElement;
    expect(within(sade).getByRole('button', { name: /Grant/ })).toBeInTheDocument();
    expect(within(sade).getByRole('button', { name: /Remove/ })).toBeInTheDocument();
    expect(within(sade).getByText(/Off — blocked from data/)).toBeInTheDocument();
    const mine = screen.getByText('me@example.test').closest('tr') as HTMLElement;
    expect(within(mine).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Sabi OS customers', () => {
  it('shows subscription prices with the honest billing note', async () => {
    api.tenants.mockResolvedValue({ generatedAt: '2026-10-11T10:00:00Z', billingNote: 'Sabi does not yet invoice or collect Sabi OS subscriptions.', items: [{
      applicationId: 'a-1', reference: 'APP-1', organisation: { name: 'Test General Hospital', type: 'HOSPITAL' }, organizationId: 'o-1', activeMembers: 4, owner: 'owner@example.test',
      subscription: { package: 'EMR Pro', code: 'EMR', version: 2, billingCycle: 'Monthly', currency: 'NGN', priceMinor: 5_000_000 }, licence: { branches: 3, storageGb: 50, support: 'STANDARD' },
      entitlements: ['emr', 'billing'], provisioning: { state: 'LIVE', approvedAt: '2026-10-01T00:00:00Z', setupSentAt: null, setupDeadlineAt: null, liveAt: '2026-10-02T00:00:00Z' }, documents: { onboarding: [], applicationEvidence: 3 },
    }] });
    wrap(<TenantsPage view="subscriptions" />, ['platform.ops.read']);
    expect(await screen.findByText('₦50,000 / month')).toBeInTheDocument();
    expect(screen.getByText(/does not yet invoice/)).toBeInTheDocument();
  });

  it('says plainly when a section has no service behind it', () => {
    expect(isNotBuilt('/command-center/feature-flags')).toBe(true);
    expect(isNotBuilt('/command-center/roles')).toBe(false);
    render(<MemoryRouter><NotBuiltPage path="/command-center/invoices" /></MemoryRouter>);
    expect(screen.getByText(/does not invoice or collect subscriptions yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Subscriptions' })).toBeInTheDocument();
  });
});

describe('prescriptions', () => {
  it('lists prescriptions by stage without medicine names', async () => {
    api.listPrescriptions.mockResolvedValue({ items: [{ id: 'rx-1', reference: 'RX-1', status: 'ISSUED', createdAt: '2026-10-10T10:00:00Z', issuedAt: '2026-10-10T10:00:00Z', cancelledAt: null, patient: { id: 'p-1', patientId: 'SABI-1', name: 'Ada' }, doctor: { profileId: 'd-1', name: 'Dr Ife', specialty: null }, items: 2, pharmacyRequests: 1, orders: [], stage: 'QUOTES_REQUESTED' }], total: 1, page: 1, limit: 25, pages: 1 });
    wrap(<PrescriptionsPage path="/command-center/sabi-health/prescriptions" />, ['platform.ops.read']);
    expect(await screen.findByText('RX-1')).toBeInTheDocument();
    expect(screen.getByText('Quotes requested')).toBeInTheDocument();
  });
});
