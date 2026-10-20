import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiActionsPanel from '../../apps/telemedicine/packages/shared-portal/ai/AiActionsPanel.jsx';
afterEach(cleanup);
const target = { id: 'schedule-1', name: 'Existing medicine', remindersEnabled: true, timezone: 'Africa/Lagos', version: 7 };
const proposal = { id: 'proposal-1', scheduleId: target.id, enableReminders: false, status: 'PENDING', expiresAt: new Date(Date.now() + 600000).toISOString() };
describe('AI confirmed reminder actions', () => {
  it('previews a reminder-only change and writes it only after explicit confirmation', async () => {
    let applied = false;
    const receipt = { id: 'receipt-1', createdAt: new Date().toISOString(), result: { remindersEnabled: false, scheduleVersion: 8 } };
    const call = vi.fn(async (path: string, options?: { body?: unknown }) => {
      if (path === '/action-targets/reminders') return { items: [{ ...target, remindersEnabled: !applied, version: applied ? 8 : 7 }] };
      if (path === '/sessions/chat-1/actions') return { items: applied ? [{ ...proposal, status: 'APPLIED', receipt }] : [] };
      if (path.endsWith('/actions/reminders')) return proposal;
      if (path.endsWith('/confirm')) { expect(options?.body).toEqual({ confirm: true }); applied = true; return receipt; }
      throw new Error('Unexpected request');
    });
    render(<AiActionsPanel call={call} sessionId="chat-1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review turning off' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm reminder change' });
    expect(applied).toBe(false);
    const preview = call.mock.calls.find(([path]) => path.endsWith('/actions/reminders'));
    expect(preview?.[1]?.body).toEqual({ clientRequestId: expect.any(String), scheduleId: target.id, expectedVersion: 7, enableReminders: false });
    fireEvent.click(confirm);
    expect(await screen.findByText('Reminder notifications disabled')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Receipt receipt-');
  });
  it('cancels a preview without calling confirmation or changing treatment', async () => {
    let cancelled = false;
    const call = vi.fn(async (path: string) => path === '/action-targets/reminders' ? { items: [target] } : path.endsWith('/cancel') ? (cancelled = true, { cancelled: true }) : { items: cancelled ? [] : [proposal] });
    render(<AiActionsPanel call={call} sessionId="chat-1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel change' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('settings were not changed'));
    expect(call.mock.calls.some(([path]) => path.endsWith('/confirm'))).toBe(false);
  });
});
