import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LiveCommandCenter from './LiveCommandCenter';

vi.mock('@/identity/liveIdentity', () => ({
  restoreLiveIdentity: vi.fn(async () => ({
    user: { id: 'user-1', email: 'admin@example.com', roles: [] },
    organizations: [], platformAssigned: true,
    platform: { roles: ['SABI_PLATFORM_ADMIN'], permissions: ['platform.onboarding.review', 'platform.staff.invite', 'platform.catalog.manage'] },
  })),
  liveListPlatformOrganizations: vi.fn(async () => ({ data: { items: [{ id: 'org-1', name: 'Test Hospital', type: 'HOSPITAL', status: 'ACTIVE', createdAt: '2026-09-23T00:00:00Z' }], nextPage: null } })),
  liveSignOut: vi.fn(async () => {}),
}));

vi.mock('@/identity/components/InvitationManager', () => ({ default: () => <div>Live invitation manager</div> }));
vi.mock('./LivePackagesPage', () => ({ default: () => <div>Live package management</div> }));
vi.mock('@/registration/livePlatform', () => ({ livePlatformApplications: vi.fn(async () => ({ data: { items: [], nextPage: null } })) }));

function mount(path = '/command-center') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/command-center/*" element={<LiveCommandCenter />} /></Routes></MemoryRouter>);
}

describe('live Command Center shell', () => {
  afterEach(cleanup);

  it('keeps the original navigation and shows only live registry data', async () => {
    mount();
    expect(await screen.findByText('Platform overview')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Command Center' })).toBeInTheDocument();
    expect(screen.getAllByText('Test Hospital').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tenant provisioning').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('link', { name: 'Packages' }));
    expect(await screen.findByText('Live package management')).toBeInTheDocument();
    expect(screen.queryByText('Live data not connected')).not.toBeInTheDocument();
  });

  it('preserves the live staff-invitation workflow inside the familiar shell', async () => {
    mount('/command-center/internal-users');
    expect(await screen.findByText('Live invitation manager')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Internal users' })).toBeInTheDocument());
  });
});
