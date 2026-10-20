import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiOperationsPage from './AiOperationsPage';
import { CcProvider } from './kit';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./api', async (load) => ({ ...await load<typeof import('./api')>(), ccGet: get, ccPost: post }));
const overview = { generatedAt: '2026-10-20T10:00:00Z', policy: { version: 4, generationPaused: false }, providerConfigured: true, provider: 'vertex', model: 'synthetic-model', generationEnabled: true, counts: { QUEUED: 2, SUCCEEDED: 7 }, flagged: 1, oldestQueuedAt: null, limits: { userDailyRuns: 10, globalDailyRuns: 30, globalTotalRuns: 1000 } };
const me = { id: 'admin', name: 'Synthetic operator', email: 'operator@example.test', twoStepVerification: true, roles: ['SABI_PLATFORM_ADMIN'], permissions: ['platform.ops.read', 'platform.settings.manage', 'platform.audit.read'] };
afterEach(() => { cleanup(); get.mockReset(); post.mockReset(); });

describe('AI operations controls', () => {
  it('shows real queue state, explains allowances and requires a reason before pausing', async () => {
    get.mockImplementation(async (path: string) => path === '/ai/overview' ? overview : { items: [], total: 0 });
    post.mockResolvedValue({ version: 5, generationPaused: true });
    render(<CcProvider me={me}><AiOperationsPage /></CcProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause generation' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('button', { name: 'Pause generation' })).toBeDisabled();
    fireEvent.change(within(modal).getByRole('textbox'), { target: { value: 'Investigate provider errors' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Pause generation' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/ai/policy', { expectedVersion: 4, generationPaused: true, reason: 'Investigate provider errors' }));
    expect(screen.getByText(/Request allowances are not a dollar spending cap/)).toBeInTheDocument();
  });
  it('shows a restricted view without platform privileges', async () => {
    get.mockResolvedValue({ items: [], total: 0 });
    render(<CcProvider me={{ ...me, permissions: [] }}><AiOperationsPage /></CcProvider>);
    expect(screen.getByText(/AI operations/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause generation' })).not.toBeInTheDocument();
  });
});
